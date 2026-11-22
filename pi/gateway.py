#!/usr/bin/env python3
"""
Home AI gateway - runs on the Raspberry Pi.

Phone app  ->  (Tailscale)  ->  this gateway  ->  PC (LM Studio)
                                     |
                                     +-> wakes the PC with Wake-on-LAN when it's asleep
                                     +-> falls back to Ollama on the Pi if the PC won't wake
                                     +-> tells the PC helper to stay awake / go to sleep

Settings live in config.json next to this file.
"""
import asyncio
import json
import os
import socket
import subprocess
import time

from aiohttp import ClientSession, ClientTimeout, web

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULTS = {
    "listen_host": "127.0.0.1",
    "listen_port": 8080,
    "pc_url": "https://arthur-pc.taild9cfe3.ts.net",   # PC's tailscale serve address (LM Studio behind it)
    "pc_mac": "10:3D:1C:99:B0:E7",
    "broadcast": ["255.255.255.255", "192.168.0.255"],
    "wake_command": "",          # optional extra shell command to run on wake (e.g. an ESP32 relay)
    "wake_timeout": 90,          # seconds to wait for the PC to come up
    "keep_awake_minutes": 10,    # keep PC awake this long after the last phone activity
    "token": "",                 # optional: require this Bearer token (use your LM Studio token)
    "ollama_url": "http://127.0.0.1:11434",
    "fallback": True,            # answer with the Pi's model if the PC won't wake
    "fallback_model": "",        # "" = first Ollama model found
}
CFG_PATH = os.path.join(HERE, "config.json")
CFG = dict(DEFAULTS)
if os.path.exists(CFG_PATH):
    with open(CFG_PATH) as f:
        CFG.update(json.load(f))

PC = CFG["pc_url"].rstrip("/")
OLLAMA = CFG["ollama_url"].rstrip("/")

state = {
    "pc": "unknown",        # awake | asleep | waking
    "lm": False,            # LM Studio server answering
    "checked": 0.0,
    "waking_until": 0.0,
    "last_activity": 0.0,   # last time the phone used the PC
    "sleep_now": False,     # one-shot request for the PC helper
    "agent_seen": 0.0,      # last heartbeat from the PC helper
    "pi_models": [],
    "pi_checked": 0.0,
}
wake_lock = asyncio.Lock()

HOP = {"host", "content-length", "transfer-encoding", "connection", "keep-alive", "accept-encoding",
       "content-encoding", "origin", "referer", "upgrade", "te", "trailer", "proxy-authorization"}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ---------------------------------------------------------------- helpers
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    resp.headers["Access-Control-Max-Age"] = "600"
    return resp


def jerr(msg, status, code=None):
    return cors(web.json_response({"error": {"message": msg, "code": code}}, status=status))


def authed(request):
    tok = CFG.get("token") or ""
    return not tok or request.headers.get("Authorization", "") == "Bearer " + tok


def sse(obj):
    return ("data: " + json.dumps(obj) + "\n\n").encode()


def send_magic_packet():
    mac = bytes.fromhex(CFG["pc_mac"].replace(":", "").replace("-", ""))
    packet = b"\xff" * 6 + mac * 16
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        for addr in CFG["broadcast"]:
            for port in (9, 7):
                try:
                    s.sendto(packet, (addr, port))
                except OSError as e:
                    log("WoL send failed to", addr, e)


async def check_pc(session, max_age=3.0):
    """Is the PC up? Any HTTP answer from its tailscale serve means it's awake."""
    now = time.time()
    if now - state["checked"] < max_age:
        return state["pc"] == "awake"
    awake, lm = False, False
    try:
        async with session.get(PC + "/v1/models", timeout=ClientTimeout(total=2.5)) as r:
            awake = True
            lm = r.status not in (502, 503, 504)
    except Exception:
        awake = time.time() - state["agent_seen"] < 25   # helper heartbeat also counts
    state["checked"] = time.time()
    state["lm"] = lm
    if awake:
        if state["pc"] != "awake":
            log("PC is awake", "(LM Studio up)" if lm else "(LM Studio not answering)")
        state["pc"] = "awake"
        state["waking_until"] = 0
    else:
        state["pc"] = "waking" if time.time() < state["waking_until"] else "asleep"
    return awake


def start_wake():
    if time.time() < state["waking_until"]:
        return
    log("Waking PC", CFG["pc_mac"])
    send_magic_packet()
    if CFG.get("wake_command"):
        subprocess.Popen(CFG["wake_command"], shell=True)
    state["waking_until"] = time.time() + CFG["wake_timeout"]
    state["pc"] = "waking"
    state["sleep_now"] = False


async def wake_and_wait(session):
    """Wake the PC and wait until LM Studio answers. Returns True if it came up."""
    async with wake_lock:
        if await check_pc(session, 0) and state["lm"]:
            return True
        start_wake()
        deadline = time.time() + CFG["wake_timeout"]
        n = 0
        while time.time() < deadline:
            await asyncio.sleep(2)
            n += 1
            if n % 5 == 0:
                send_magic_packet()   # resend in case the first one was missed
            if await check_pc(session, 0) and state["lm"]:
                return True
        log("PC did not come up within", CFG["wake_timeout"], "s")
        return False


async def pi_models(session):
    if time.time() - state["pi_checked"] < 60:
        return state["pi_models"]
    try:
        async with session.get(OLLAMA + "/api/tags", timeout=ClientTimeout(total=3)) as r:
            j = await r.json()
            state["pi_models"] = [m["name"] for m in j.get("models", [])]
    except Exception:
        state["pi_models"] = []
    state["pi_checked"] = time.time()
    return state["pi_models"]


def touch():
    state["last_activity"] = time.time()


# ---------------------------------------------------------------- gateway endpoints
async def gw_status(request):
    if not authed(request):
        return jerr("Wrong token", 401)
    s = request.app["session"]
    await check_pc(s)
    if state["pc"] == "awake" and request.query.get("active") == "1":
        touch()   # app is open in the foreground: keep the PC awake
    return cors(web.json_response({
        "gateway": 1,
        "pc": state["pc"],
        "lm": state["lm"],
        "agent": time.time() - state["agent_seen"] < 25,
        "pi_models": await pi_models(s),
        "fallback": bool(CFG["fallback"]),
        "wake_timeout": CFG["wake_timeout"],
    }))


async def gw_wake(request):
    if not authed(request):
        return jerr("Wrong token", 401)
    s = request.app["session"]
    if not await check_pc(s, 0):
        start_wake()
    touch()
    return cors(web.json_response({"pc": state["pc"]}))


async def gw_sleep(request):
    if not authed(request):
        return jerr("Wrong token", 401)
    agent = time.time() - state["agent_seen"] < 25
    if not agent:
        return jerr("The PC helper isn't running, so the Pi can't put the PC to sleep.", 409, "no_agent")
    state["sleep_now"] = True
    state["last_activity"] = 0
    log("Sleep requested")
    return cors(web.json_response({"ok": True}))


async def gw_agent(request):
    """Heartbeat from the PC helper. Tells it whether to stay awake or sleep."""
    state["agent_seen"] = time.time()
    state["pc"] = "awake"
    state["waking_until"] = 0
    sleep_now = state["sleep_now"]
    state["sleep_now"] = False
    if sleep_now:
        state["agent_seen"] = 0      # it's about to go to sleep
        state["pc"] = "asleep"
        state["checked"] = time.time() + 10   # don't re-check for a bit while it shuts down
    keep = (time.time() - state["last_activity"]) < CFG["keep_awake_minutes"] * 60
    return web.json_response({"keep_awake": keep and not sleep_now, "sleep_now": sleep_now})


# ---------------------------------------------------------------- Ollama (Pi) models
async def to_ollama(request, data, note=None):
    s = request.app["session"]
    models = await pi_models(s)
    model = str(data.get("model") or "")
    model = model[3:] if model.startswith("pi:") else (CFG.get("fallback_model") or (models[0] if models else ""))
    if not model:
        return jerr("No model available on the Pi (is Ollama running?)", 503)
    msgs = []
    for m in data.get("messages", []):
        c = m.get("content")
        if isinstance(c, list):
            text = " ".join(p.get("text", "") for p in c if p.get("type") == "text")
            if any(p.get("type") == "image_url" for p in c):
                text += " [image omitted: the Pi model can't see images]"
            c = text
        msgs.append({"role": m.get("role", "user"), "content": c or ""})
    payload = {"model": model, "messages": msgs, "stream": True}

    resp = cors(web.StreamResponse(status=200, headers={"Content-Type": "text/event-stream", "Cache-Control": "no-cache"}))
    await resp.prepare(request)
    try:
        if note:
            await resp.write(sse({"choices": [{"index": 0, "delta": {"content": note}}]}))
        async with s.post(OLLAMA + "/v1/chat/completions", json=payload,
                          timeout=ClientTimeout(total=None, sock_connect=5)) as r:
            if r.status != 200:
                txt = (await r.text())[:300]
                await resp.write(sse({"error": {"message": "Pi model error: " + txt}}))
            else:
                async for chunk in r.content.iter_any():
                    await resp.write(chunk)
    except (ConnectionResetError, asyncio.CancelledError):
        return resp
    except Exception as e:
        try:
            await resp.write(sse({"error": {"message": "Pi model error: " + str(e)}}))
        except Exception:
            pass
    try:
        await resp.write_eof()
    except Exception:
        pass
    return resp


# ---------------------------------------------------------------- proxy to the PC
async def proxy(request):
    if request.method == "OPTIONS":
        return cors(web.Response(status=204))
    if not authed(request):
        return jerr("Wrong token", 401)
    s = request.app["session"]
    body = await request.read()
    is_chat = request.method == "POST" and request.path in ("/v1/chat/completions", "/api/v1/chat", "/v1/responses")

    data = None
    if is_chat:
        try:
            data = json.loads(body or b"{}")
        except ValueError:
            data = None
        if data is not None and str(data.get("model", "")).startswith("pi:"):
            return await to_ollama(request, data)

    if not (await check_pc(s) and state["lm"]):
        if request.method != "POST":
            # don't wake the PC just because the app is polling
            if state["pc"] == "awake":
                return jerr("Your PC is on, but LM Studio's server isn't running.", 502, "lm_off")
            return jerr("Your PC is asleep.", 503, "pc_asleep")
        if not await wake_and_wait(s):
            if is_chat and data is not None and CFG["fallback"] and await pi_models(s):
                fm = CFG.get("fallback_model") or state["pi_models"][0]
                return await to_ollama(request, data, note="*(Your PC didn't wake up, so the Pi answered with " + fm + ".)*\n\n")
            return jerr("Your PC didn't wake up.", 504, "wake_failed")

    touch()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    try:
        upstream = await s.request(request.method, PC + str(request.rel_url), headers=headers, data=body,
                                   timeout=ClientTimeout(total=None, sock_connect=10, sock_read=600))
    except Exception as e:
        state["checked"] = 0
        return jerr("Couldn't reach your PC: " + str(e), 502)

    async with upstream:
        resp = web.StreamResponse(status=upstream.status)
        for k, v in upstream.headers.items():
            kl = k.lower()
            if kl not in HOP and not kl.startswith("access-control-"):
                resp.headers[k] = v
        cors(resp)
        await resp.prepare(request)
        try:
            last = time.time()
            async for chunk in upstream.content.iter_any():
                await resp.write(chunk)
                if time.time() - last > 30:   # long answers keep the PC awake
                    touch()
                    last = time.time()
            await resp.write_eof()
        except (ConnectionResetError, asyncio.CancelledError):
            pass   # phone pressed stop / went away; closing upstream stops generation
    touch()
    return resp


# ---------------------------------------------------------------- app
async def on_startup(app):
    app["session"] = ClientSession()


async def on_cleanup(app):
    await app["session"].close()


def make_app():
    app = web.Application(client_max_size=64 * 1024 * 1024)
    app.router.add_get("/gw/status", gw_status)
    app.router.add_post("/gw/wake", gw_wake)
    app.router.add_post("/gw/sleep", gw_sleep)
    app.router.add_get("/gw/agent", gw_agent)
    app.router.add_route("*", "/{tail:.*}", proxy)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == "__main__":
    log("Home AI gateway on", CFG["listen_host"], CFG["listen_port"], "-> PC", PC)
    web.run_app(make_app(), host=CFG["listen_host"], port=CFG["listen_port"], print=None)
