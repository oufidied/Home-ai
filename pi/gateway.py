#!/usr/bin/env python3
"""
Home AI hub - runs on the Raspberry Pi.

    phone / laptop app  --(Tailscale)-->  this hub  -->  PC (LM Studio + PC helper)
                                             |
                                             +-- keeps all chats (SQLite) so every device sees them
                                             +-- runs answers in the background, so closing the app doesn't stop them
                                             +-- wakes the PC (Wake-on-LAN), waits up to 2.5 min
                                             +-- smart routing: quick questions -> Pi model, big ones -> PC
                                             +-- PC control: sleep / lock / restart / actions / game mode / schedules
                                             +-- send to PC / send to phone, push notifications, private voice
                                             +-- home hub for ESP32 devices (port 8090 on your home network)

Settings: config.json next to this file. Data: ./data/
"""
import asyncio
import base64
import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import time
import uuid
from datetime import datetime, timedelta
from urllib.parse import unquote

from aiohttp import ClientSession, ClientTimeout, web

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

VERSION = "2.1.0"
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
DROPS = os.path.join(DATA, "drops")
TMP = os.path.join(DATA, "tmp")
for d in (DATA, DROPS, TMP):
    os.makedirs(d, exist_ok=True)

DEFAULTS = {
    "listen_host": "127.0.0.1",
    "listen_port": 8080,
    "pc_url": "https://arthur-pc.taild9cfe3.ts.net",
    "pc_mac": "10:3D:1C:99:B0:E7",
    "broadcast": ["255.255.255.255", "192.168.0.255"],
    "wake_command": "",
    "ollama_url": "http://127.0.0.1:11434",
    "device_port": 8090,
    "device_key": "",
    "push_contact": "https://home-ai-ruby.vercel.app",
    "whisper_dir": "~/whisper.cpp",
    "whisper_model": "base",
}
CFG_PATH = os.path.join(HERE, "config.json")
CFG = dict(DEFAULTS)
if os.path.exists(CFG_PATH):
    with open(CFG_PATH) as f:
        CFG.update(json.load(f))
PC = CFG["pc_url"].rstrip("/")
OLLAMA = CFG["ollama_url"].rstrip("/")

SETTINGS_DEFAULT = {
    "smart_routing": True,
    "default_model": "",          # "" = whatever is loaded / first PC model
    "keep_awake_minutes": 15,
    "wake_timeout": 150,
    "notify_answers": True,
    "voice_language": "auto",
}
PRESETS_DEFAULT = [
    {"id": "assistant", "name": "Assistant", "icon": "✨", "model": "",
     "system": "You are Arthur's personal AI assistant, running on his own computers at home. Be clear, direct and concise. Use markdown when it helps."},
    {"id": "roblox", "name": "Roblox dev", "icon": "🎮", "model": "",
     "system": "You are an expert Roblox game developer. Write modern, idiomatic Luau (task.wait, task.spawn, typed Luau where it helps, no deprecated APIs). "
               "Say exactly where each script goes (ServerScriptService, StarterPlayerScripts, ReplicatedStorage...) and whether it is a Script, LocalScript or ModuleScript. "
               "Think about security: never trust the client, validate RemoteEvents on the server. Keep explanations short and practical."},
    {"id": "esp32", "name": "ESP32 & electronics", "icon": "🔌", "model": "",
     "system": "You are an embedded systems and electronics expert. Help with ESP32 (Arduino framework and ESP-IDF), sensors, relays, displays and wiring. "
               "Give exact pin numbers, voltage levels (3.3 V logic!), required resistors, and complete compilable code. Warn clearly about anything mains-powered or unsafe."},
    {"id": "quick", "name": "Quick answers", "icon": "⚡", "model": "",
     "system": "Answer in one to three short sentences. No preamble, no lists unless asked."},
]

FINAL = ("done", "error", "stopped")


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def now():
    return time.time()


def new_id():
    return uuid.uuid4().hex[:16]


# ================================================================== database
db = sqlite3.connect(os.path.join(DATA, "hub.db"), check_same_thread=False)
db.row_factory = sqlite3.Row
db.executescript("""
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS chats(id TEXT PRIMARY KEY, title TEXT, preset TEXT, created REAL, updated REAL);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, chat_id TEXT, role TEXT, content TEXT, reasoning TEXT,
    images TEXT, model TEXT, status TEXT, meta TEXT, created REAL);
CREATE INDEX IF NOT EXISTS idx_msg_chat ON messages(chat_id, created);
CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS schedules(id TEXT PRIMARY KEY, data TEXT);
CREATE TABLE IF NOT EXISTS drops(id TEXT PRIMARY KEY, dir TEXT, kind TEXT, text TEXT, filename TEXT, size INTEGER,
    mime TEXT, path TEXT, created REAL, delivered REAL, sent REAL);
CREATE TABLE IF NOT EXISTS push_subs(endpoint TEXT PRIMARY KEY, data TEXT, created REAL);
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, data TEXT, updated REAL);
CREATE TABLE IF NOT EXISTS readings(device TEXT, ts REAL, data TEXT);
CREATE INDEX IF NOT EXISTS idx_read ON readings(device, ts);
""")
db.commit()


def kv_get(k, default=None):
    r = db.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
    return json.loads(r["v"]) if r else default


def kv_set(k, v):
    db.execute("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, json.dumps(v)))
    db.commit()


def settings():
    s = dict(SETTINGS_DEFAULT)
    s.update(kv_get("settings", {}))
    return s


def presets():
    return kv_get("presets", PRESETS_DEFAULT)


def msg_row(r):
    return {
        "id": r["id"], "chat_id": r["chat_id"], "role": r["role"], "content": r["content"] or "",
        "reasoning": r["reasoning"] or "", "images": json.loads(r["images"] or "[]"), "model": r["model"] or "",
        "status": r["status"] or "done", "meta": json.loads(r["meta"] or "{}"), "created": r["created"],
    }


def save_msg(m):
    db.execute("""INSERT INTO messages(id,chat_id,role,content,reasoning,images,model,status,meta,created)
                  VALUES(?,?,?,?,?,?,?,?,?,?)
                  ON CONFLICT(id) DO UPDATE SET content=excluded.content, reasoning=excluded.reasoning,
                  model=excluded.model, status=excluded.status, meta=excluded.meta""",
               (m["id"], m["chat_id"], m["role"], m["content"], m.get("reasoning", ""), json.dumps(m.get("images", [])),
                m.get("model", ""), m.get("status", "done"), json.dumps(m.get("meta", {})), m["created"]))
    db.commit()


def chat_touch(chat_id):
    db.execute("UPDATE chats SET updated=? WHERE id=?", (now(), chat_id))
    db.commit()


# ================================================================== live state
S = {
    "pc": "unknown", "lm": False, "checked": 0.0,
    "waking_since": 0.0, "waking_until": 0.0, "sleeping_until": 0.0,
    "last_activity": 0.0, "agent_seen": 0.0, "agent": {},
    "metrics": None, "hist": [],
    "actions": [], "actions_error": None,
    "commands": [], "results": [],
    "pc_models": [], "pc_models_at": 0.0,
    "pi_models": [], "pi_checked": 0.0,
    "model_busy": None, "last_tps": None,
    "active": {},           # device id -> last time its app was open on screen
    "awake_since": 0.0,
}
JOBS = {}
SESSION = None


def touch():
    S["last_activity"] = now()


def agent_online():
    return now() - S["agent_seen"] < 20


def token():
    return kv_get("token", "")


def auth_headers():
    t = token()
    return {"Authorization": "Bearer " + t} if t else {}


# ================================================================== PC: status / wake
async def check_pc(max_age=3.0):
    t = now()
    if t - S["checked"] < max_age:
        return S["pc"] == "awake"
    # While the PC sleeps, leave it alone: network traffic can wake some PCs up.
    # The PC helper checks in by itself as soon as the PC wakes, so we'll know.
    if S["pc"] in ("asleep", "unknown") and t >= S["waking_until"] and not agent_online() and t - S["checked"] < 600 and S["checked"]:
        return False
    awake, lm = False, False
    try:
        async with SESSION.get(PC + "/v1/models", headers=auth_headers(), timeout=ClientTimeout(total=3)) as r:
            awake = True
            lm = r.status not in (502, 503, 504)
    except Exception:
        awake = agent_online() and t > S["sleeping_until"]
    S["checked"] = now()
    S["lm"] = lm
    if awake:
        if S["pc"] != "awake":
            log("PC awake", "(LM Studio up)" if lm else "(LM Studio not ready)")
            S["awake_since"] = now()
        S["pc"] = "awake"
        if lm:
            S["waking_until"] = 0
            S["waking_since"] = 0
    else:
        S["pc"] = "waking" if now() < S["waking_until"] else "asleep"
    return awake


def send_wol():
    try:
        mac = bytes.fromhex(CFG["pc_mac"].replace(":", "").replace("-", ""))
    except ValueError:
        log("Bad pc_mac in config.json")
        return
    packet = b"\xff" * 6 + mac * 16
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        for addr in CFG["broadcast"]:
            for port in (9, 7):
                try:
                    s.sendto(packet, (addr, port))
                except OSError as e:
                    log("WoL send failed", addr, e)


def start_wake():
    t = now()
    timeout = settings()["wake_timeout"]
    if t < S["waking_until"]:
        return
    log("Waking PC")
    send_wol()
    if CFG.get("wake_command"):
        subprocess.Popen(CFG["wake_command"], shell=True)
    S["waking_since"] = t
    S["waking_until"] = t + timeout
    S["sleeping_until"] = 0
    S["pc"] = "waking"
    touch()


async def ensure_pc(progress=None):
    """Wake the PC if needed and wait until LM Studio answers. Returns True when ready."""
    if await check_pc(0) and S["lm"]:
        return True
    start_wake()
    timeout = settings()["wake_timeout"]
    begin = S["waking_since"] or now()
    last_wol = now()
    while now() - begin < timeout:
        await asyncio.sleep(2)
        if now() - last_wol > 10 and S["pc"] != "awake":
            send_wol()
            last_wol = now()
        if await check_pc(1.5) and S["lm"]:
            return True
        if progress:
            await progress(now() - begin)
    S["waking_until"] = 0
    S["waking_since"] = 0
    await check_pc(0)
    return S["pc"] == "awake" and S["lm"]


# ================================================================== models
def parse_pc_models(j):
    out = []
    for m in j.get("models", []):
        if m.get("type") != "llm":
            continue
        inst = [i.get("id") for i in (m.get("loaded_instances") or [])]
        out.append({"id": m.get("key"), "name": m.get("display_name") or m.get("key"), "loaded": bool(inst),
                    "instances": inst, "vision": bool((m.get("capabilities") or {}).get("vision")),
                    "size": m.get("size_bytes"), "params": m.get("params_string"), "where": "pc"})
    return out


async def refresh_pc_models(force=False):
    if not force and now() - S["pc_models_at"] < 8:
        return S["pc_models"]
    if S["pc"] != "awake" or not S["lm"]:
        cached = kv_get("pc_models_cache", [])
        S["pc_models"] = [dict(m, loaded=False, instances=[]) for m in cached]
        return S["pc_models"]
    try:
        async with SESSION.get(PC + "/api/v1/models", headers=auth_headers(), timeout=ClientTimeout(total=5)) as r:
            if r.status == 200:
                S["pc_models"] = parse_pc_models(await r.json())
                S["pc_models_at"] = now()
                kv_set("pc_models_cache", [{k: m[k] for k in ("id", "name", "vision", "size", "params", "where")} for m in S["pc_models"]])
    except Exception as e:
        log("model list failed:", e)
    return S["pc_models"]


async def pi_models():
    if now() - S["pi_checked"] < 60 and S["pi_models"]:
        return S["pi_models"]
    try:
        async with SESSION.get(OLLAMA + "/api/tags", timeout=ClientTimeout(total=3)) as r:
            j = await r.json()
            S["pi_models"] = [m["name"] for m in j.get("models", []) if "embed" not in m["name"]]
    except Exception:
        S["pi_models"] = []
    S["pi_checked"] = now()
    return S["pi_models"]


def pick_pc_model():
    s = settings()
    if s["default_model"]:
        return s["default_model"]
    loaded = [m for m in S["pc_models"] if m["loaded"]]
    if loaded:
        return loaded[0]["id"]
    last = kv_get("last_pc_model")
    if last:
        return last
    return S["pc_models"][0]["id"] if S["pc_models"] else None


async def lm_post(path, body):
    async with SESSION.post(PC + path, json=body, headers=auth_headers(), timeout=ClientTimeout(total=600)) as r:
        j = await r.json(content_type=None)
        if r.status >= 400:
            raise RuntimeError((j.get("error") or {}).get("message") if isinstance(j.get("error"), dict) else str(j.get("error") or r.status))
        return j


async def unload_all(except_id=None):
    await refresh_pc_models(force=True)
    for m in S["pc_models"]:
        if m["id"] == except_id:
            continue
        for inst in m["instances"]:
            await lm_post("/api/v1/models/unload", {"instance_id": inst})


async def model_op(op, model_id):
    S["model_busy"] = {"id": model_id, "op": op, "since": now()}
    try:
        if op == "load":
            if not await ensure_pc():
                raise RuntimeError("PC didn't wake up")
            kv_set("game_mode", False)
            await unload_all(except_id=model_id)
            await refresh_pc_models(force=True)
            if not any(m["id"] == model_id and m["loaded"] for m in S["pc_models"]):
                r = await lm_post("/api/v1/models/load", {"model": model_id})
                add_result("model", "Loaded " + short(model_id), True, "in %ds" % round(r.get("load_time_seconds") or 0))
            kv_set("last_pc_model", model_id)
        else:
            await refresh_pc_models(force=True)
            m = next((m for m in S["pc_models"] if m["id"] == model_id), None)
            for inst in (m["instances"] if m else [model_id]):
                await lm_post("/api/v1/models/unload", {"instance_id": inst})
            add_result("model", "Unloaded " + short(model_id), True, "")
    except Exception as e:
        add_result("model", ("Load " if op == "load" else "Unload ") + short(model_id), False, str(e))
    finally:
        S["model_busy"] = None
        S["pc_models_at"] = 0
        await refresh_pc_models(force=True)


def short(mid):
    return (mid or "").replace("pi:", "").split("/")[-1]


# ================================================================== commands for the PC helper
def queue_cmd(ctype, **kw):
    c = {"id": new_id(), "type": ctype, "created": now(), **kw}
    S["commands"].append(c)
    return c


def add_result(kind, name, ok, message=""):
    S["results"].insert(0, {"id": new_id(), "kind": kind, "name": name, "ok": ok, "message": message, "at": now()})
    del S["results"][25:]


# ================================================================== push notifications
PUSH = {"ok": False, "public": "", "key_path": os.path.join(DATA, "vapid_private.pem")}
try:
    from py_vapid import Vapid
    from pywebpush import WebPushException, webpush
    from cryptography.hazmat.primitives import serialization

    if not os.path.exists(PUSH["key_path"]):
        v = Vapid()
        v.generate_keys()
        v.save_key(PUSH["key_path"])
    v = Vapid.from_file(PUSH["key_path"])
    raw = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    PUSH["public"] = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    PUSH["ok"] = True
except Exception as e:  # push is optional
    log("Push notifications disabled:", e)


def _send_one(sub, payload):
    """Returns (keep_subscription, error_or_None)."""
    try:
        webpush(subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]}, data=json.dumps(payload),
                vapid_private_key=PUSH["key_path"], vapid_claims={"sub": CFG["push_contact"]},
                ttl=3600, timeout=10, headers={"Urgency": "high"})
        return True, None
    except WebPushException as e:
        code = getattr(e.response, "status_code", None)
        detail = ""
        try:
            detail = e.response.text[:200]
        except Exception:
            pass
        log("push failed", code, detail or str(e)[:150])
        return code not in (404, 410), "%s %s" % (code, detail or str(e)[:150])
    except Exception as e:
        log("push failed", e)
        return True, str(e)[:150]


async def push(title, body, url="/", tag=None, skip_active=False):
    """Send a notification to every subscribed device. skip_active: not to devices that have the app open right now."""
    if not PUSH["ok"]:
        return {"sent": 0, "skipped": 0, "errors": ["push not available on the Pi"]}
    payload = {"title": title, "body": body[:180], "url": url, "tag": tag or new_id()}
    loop = asyncio.get_running_loop()
    out = {"sent": 0, "skipped": 0, "errors": []}
    for r in db.execute("SELECT endpoint, data FROM push_subs").fetchall():
        sub = json.loads(r["data"])
        if skip_active and sub.get("cid") and now() - S["active"].get(sub["cid"], 0) < 15:
            out["skipped"] += 1
            continue
        keep, error = await loop.run_in_executor(None, _send_one, sub, payload)
        if error:
            out["errors"].append(error)
        else:
            out["sent"] += 1
        if not keep:
            db.execute("DELETE FROM push_subs WHERE endpoint=?", (r["endpoint"],))
            db.commit()
    return out


# ================================================================== chat jobs
class Job:
    def __init__(self, msg):
        self.msg = msg
        self.subs = set()
        self.task = None
        self.saved = 0.0

    def publish(self, ev):
        for q in list(self.subs):
            q.put_nowait(ev)

    def state(self):
        m = self.msg
        self.publish({"t": "state", "status": m["status"], "meta": m["meta"], "model": m["model"]})

    def save(self, force=False):
        if force or now() - self.saved > 1.5:
            save_msg(self.msg)
            self.saved = now()


def build_history(chat_id, before):
    chat = db.execute("SELECT * FROM chats WHERE id=?", (chat_id,)).fetchone()
    pr = next((p for p in presets() if p["id"] == (chat["preset"] if chat else "")), presets()[0] if presets() else None)
    rows = db.execute("SELECT * FROM messages WHERE chat_id=? AND created<? ORDER BY created", (chat_id, before)).fetchall()
    msgs = [msg_row(r) for r in rows][-30:]
    out, img_budget = [], 2
    for m in reversed(msgs):
        if m["role"] == "assistant":
            if m["status"] == "error" and not m["content"]:
                continue
            out.insert(0, {"role": "assistant", "content": strip_think(m["content"])})
        else:
            if m["images"] and img_budget > 0:
                img_budget -= 1
                content = [{"type": "image_url", "image_url": {"url": u}} for u in m["images"]]
                if m["content"]:
                    content.insert(0, {"type": "text", "text": m["content"]})
                out.insert(0, {"role": "user", "content": content})
            else:
                out.insert(0, {"role": "user", "content": m["content"] + (" [earlier image not re-sent]" if m["images"] else "")})
    system = (pr or {}).get("system") or ""
    if system:
        out.insert(0, {"role": "system", "content": system})
    return out, pr


def plain(t):
    t = re.sub(r"```[\s\S]*?(```|$)", " ", t)
    t = re.sub(r"[#*_`>|]+", " ", t)
    t = re.sub(r"-{3,}", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def strip_think(c):
    c = re.sub(r"<think>[\s\S]*?</think>", "", c or "")
    if "</think>" in c:
        c = c.split("</think>", 1)[1]
    return c.strip()


COMPLEX_RE = re.compile(r"\b(code|script|lua|luau|python|javascript|function|error|bug|debug|fix|explain|why|how (do|does|can|to)|write|essay|"
                        r"analy[sz]e|compare|plan|design|step[- ]by[- ]step|esp32|arduino|wiring|circuit|math|calculate|solve|"
                        r"summari[sz]e|translate|review|optimi[sz]e|create|build|program|algorithm|homework|proof)\b", re.I)
SIMPLE_RE = re.compile(r"^(hi|hey|hello|yo|thanks|thank you|ok|okay|cool|nice|good (morning|night|evening)|what time|what day|"
                       r"what('s| is) the (date|time)|how are you|who are you)\b", re.I)


async def classify(text, chat_id):
    """True = simple enough for the Pi."""
    prev = db.execute("SELECT meta FROM messages WHERE chat_id=? AND role='assistant' ORDER BY created DESC LIMIT 1", (chat_id,)).fetchone()
    if prev and json.loads(prev["meta"] or "{}").get("route") == "pc":
        return False, "Continuing on your PC"
    t = text.strip()
    if len(t) > 280 or t.count("\n") > 3 or "```" in t:
        return False, "Long question, so your PC answered"
    if COMPLEX_RE.search(t):
        return False, "Bigger question, so your PC answered"
    if len(t) <= 60 and SIMPLE_RE.search(t):
        return True, "Quick question, so the Pi answered right away"
    models = await pi_models()
    if not models:
        return False, ""
    prompt = ("Decide if a very small AI model can answer this message well in one or two sentences "
              "(greetings, small talk, a simple fact, a quick definition or unit conversion = SIMPLE; anything needing reasoning, "
              "code, detail or expertise = COMPLEX).\nMessage: \"" + t[:400] + "\"\nReply with exactly one word: SIMPLE or COMPLEX.")
    try:
        async with SESSION.post(OLLAMA + "/api/generate", json={"model": models[0], "prompt": prompt, "stream": False,
                                                                "options": {"num_predict": 4, "temperature": 0}},
                                timeout=ClientTimeout(total=10)) as r:
            ans = (await r.json()).get("response", "").upper()
            if "SIMPLE" in ans:
                return True, "Quick question, so the Pi answered right away"
    except Exception as e:
        log("classify failed:", e)
    return False, "Bigger question, so your PC answered"


async def route(req_model, text, has_images, chat_id):
    pis = await pi_models()
    if req_model and req_model.startswith("pi:"):
        return "pi", req_model[3:], ""
    if req_model and req_model not in ("auto", "pc"):
        return "pc", req_model, ""
    if req_model == "pc":
        return "pc", None, ""
    if kv_get("game_mode", False) and pis and not has_images:
        return "pi", pis[0], "Game mode is on, so the Pi answered"
    if not settings()["smart_routing"] or not pis:
        return "pc", None, ""
    if has_images:
        return "pc", None, "Has a photo, so your PC answered"
    await check_pc()
    if S["pc"] == "awake" and S["lm"]:
        return "pc", None, ""
    simple, why = await classify(text, chat_id)
    if simple:
        return "pi", pis[0], why
    return "pc", None, why


async def stream_openai(job, url, body, headers, retries=0):
    """Stream an OpenAI-style chat completion into job.msg. Returns True on success."""
    m = job.msg
    attempt = 0
    while True:
        attempt += 1
        try:
            async with SESSION.post(url, json=body, headers=headers,
                                    timeout=ClientTimeout(total=None, sock_connect=15, sock_read=900)) as r:
                if r.status in (502, 503, 504) and attempt <= retries:
                    await asyncio.sleep(3)
                    continue
                if r.status != 200:
                    txt = await r.text()
                    try:
                        j = json.loads(txt)
                        err = j.get("error")
                        txt = err.get("message") if isinstance(err, dict) else (err or txt)
                    except ValueError:
                        pass
                    raise RuntimeError("%s (HTTP %d)" % (str(txt)[:300], r.status))
                buf = b""
                t0, n = now(), 0
                async for chunk in r.content.iter_any():
                    buf += chunk
                    while b"\n" in buf:
                        line, buf = buf.split(b"\n", 1)
                        line = line.strip()
                        if not line.startswith(b"data:"):
                            continue
                        data = line[5:].strip()
                        if not data or data == b"[DONE]":
                            continue
                        try:
                            j = json.loads(data)
                        except ValueError:
                            continue
                        if j.get("error"):
                            e = j["error"]
                            raise RuntimeError(e.get("message") if isinstance(e, dict) else str(e))
                        ch = (j.get("choices") or [{}])[0]
                        d = ch.get("delta") or {}
                        r_add = d.get("reasoning_content") or (d.get("reasoning") if isinstance(d.get("reasoning"), str) else "") or ""
                        c_add = d.get("content") or ""
                        if r_add or c_add:
                            if m["status"] != "generating":
                                m["status"] = "generating"
                                job.state()
                                t0 = now()
                            n += 1
                            m["reasoning"] += r_add
                            m["content"] += c_add
                            job.publish({"t": "delta", "c": c_add, "r": r_add})
                            job.save()
                            if n % 40 == 0:
                                touch()
                el = max(now() - t0, 0.001)
                m["meta"]["tokens"] = n
                m["meta"]["tps"] = round(n / el, 1) if n > 5 else None
                return True
        except (asyncio.CancelledError, RuntimeError):
            raise
        except Exception as e:
            if attempt <= retries:
                await asyncio.sleep(3)
                continue
            raise RuntimeError("Lost connection: " + str(e))


async def run_job(job, req_model, pre_reason=None):
    m = job.msg
    meta = m["meta"]
    chat_id = m["chat_id"]
    try:
        hist, preset = build_history(chat_id, m["created"])
        last_user = next((x for x in reversed(hist) if x["role"] == "user"), {"content": ""})
        text = last_user["content"] if isinstance(last_user["content"], str) else " ".join(
            p.get("text", "") for p in last_user["content"] if p.get("type") == "text")
        has_images = isinstance(last_user["content"], list) and any(p.get("type") == "image_url" for p in last_user["content"])
        if not req_model and preset and preset.get("model"):
            req_model = preset["model"]
        m["status"] = "routing"
        job.state()
        target, model, reason = await route(req_model, text, has_images, chat_id)
        meta["route"] = target
        if reason or pre_reason:
            meta["route_reason"] = reason or pre_reason

        if target == "pc":
            touch()
            if not (await check_pc(0) and S["lm"]):
                m["status"] = "waking"
                meta["waking_since"] = S["waking_since"] or now()
                job.state()

                async def progress(elapsed):
                    meta["waking_elapsed"] = round(elapsed)
                    job.state()

                if not await ensure_pc(progress):
                    meta["error_code"] = "wake_failed"
                    raise RuntimeError("Your PC didn't wake up after %d seconds. It might be fully shut down, or the Wi-Fi didn't pass the wake signal."
                                       % settings()["wake_timeout"])
                meta.pop("waking_elapsed", None)
            touch()
            await refresh_pc_models(force=True)
            model = model or pick_pc_model()
            if not model:
                raise RuntimeError("No models found on your PC.")
            m["model"] = model
            info = next((x for x in S["pc_models"] if x["id"] == model), None)
            if kv_get("game_mode", False):
                kv_set("game_mode", False)   # using the PC model ends game mode
            m["status"] = "loading" if (info and not info["loaded"]) else "thinking"
            job.state()
            # strip images if the model can't see them
            if info and not info["vision"]:
                for x in hist:
                    if isinstance(x["content"], list):
                        x["content"] = " ".join(p.get("text", "") for p in x["content"] if p.get("type") == "text") + " [image omitted: this model can't see images]"
            await stream_openai(job, PC + "/v1/chat/completions", {"model": model, "messages": hist, "stream": True},
                                auth_headers(), retries=4)
            kv_set("last_pc_model", model)
            S["last_tps"] = meta.get("tps")
        else:
            m["model"] = "pi:" + model
            m["status"] = "thinking"
            job.state()
            for x in hist:
                if isinstance(x["content"], list):
                    x["content"] = " ".join(p.get("text", "") for p in x["content"] if p.get("type") == "text") + " [image omitted]"
            await stream_openai(job, OLLAMA + "/v1/chat/completions", {"model": model, "messages": hist, "stream": True}, {})
        if not strip_think(m["content"]) and not m["reasoning"]:
            raise RuntimeError("The model didn't return an answer (it may have run out of context - try a new chat).")
        m["status"] = "done"
    except asyncio.CancelledError:
        m["status"] = "stopped"
    except Exception as e:
        m["status"] = "error"
        meta["error"] = str(e)
        log("job error:", e)
    finally:
        meta["finished"] = now()
        job.save(force=True)
        chat_touch(chat_id)
        job.state()
        job.publish({"t": "end"})
        JOBS.pop(m["id"], None)
        if m["status"] in ("done", "error") and settings()["notify_answers"]:
            chat = db.execute("SELECT title FROM chats WHERE id=?", (chat_id,)).fetchone()
            body = strip_think(m["content"]) if m["status"] == "done" else ("⚠️ " + meta.get("error", "Something went wrong"))
            asyncio.ensure_future(push((chat["title"] if chat else None) or "Home AI", plain(body) or "Answer ready",
                                       "/?chat=" + chat_id, "chat-" + chat_id, skip_active=True))


def start_job(chat_id, req_model, reason=None):
    t = now()
    msg = {"id": new_id(), "chat_id": chat_id, "role": "assistant", "content": "", "reasoning": "", "images": [],
           "model": "", "status": "queued", "meta": {}, "created": t}
    save_msg(msg)
    job = Job(msg)
    JOBS[msg["id"]] = job
    job.task = asyncio.ensure_future(run_job(job, req_model, reason))
    return msg


# ================================================================== helpers for HTTP
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Filename, X-Wake"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    resp.headers["Access-Control-Max-Age"] = "600"
    return resp


def J(obj, status=200):
    return web.json_response(obj, status=status)


def err(msg, status=400, code=None):
    return J({"error": {"message": msg, "code": code}}, status)


@web.middleware
async def mw(request, handler):
    if request.method == "OPTIONS":
        return cors(web.Response(status=204))
    a = request.headers.get("Authorization", "")
    if a.startswith("Bearer ") and request.path.startswith("/hub/") and len(a) > 12 and a[7:] != token():
        kv_set("token", a[7:])   # remember the LM Studio token the app uses
    try:
        resp = await handler(request)
    except web.HTTPException as e:
        resp = err(e.reason or str(e), e.status)
    except Exception as e:
        log("error on", request.path, repr(e))
        resp = err(str(e), 500)
    if not resp.prepared:
        cors(resp)
    return resp


async def body_json(request):
    try:
        return await request.json()
    except Exception:
        return {}


# ================================================================== /hub: status
def pi_stats():
    st = {}
    try:
        st["temp"] = round(int(open("/sys/class/thermal/thermal_zone0/temp").read()) / 1000, 1)
    except Exception:
        st["temp"] = None
    try:
        mem = {}
        for line in open("/proc/meminfo"):
            k, v = line.split(":")
            mem[k] = int(v.split()[0])
        st["ram_total"] = mem["MemTotal"] * 1024
        st["ram_used"] = (mem["MemTotal"] - mem.get("MemAvailable", mem["MemFree"])) * 1024
    except Exception:
        pass
    try:
        st["load"] = round(os.getloadavg()[0], 2)
        st["cores"] = os.cpu_count()
        st["uptime"] = float(open("/proc/uptime").read().split()[0])
        du = shutil.disk_usage("/")
        st["disk_total"], st["disk_used"] = du.total, du.used
    except Exception:
        pass
    return st


def voice_paths():
    d = os.path.expanduser(CFG["whisper_dir"])
    exe = next((p for p in (os.path.join(d, "build/bin/whisper-cli"), os.path.join(d, "build/bin/main")) if os.path.exists(p)), None)
    model = os.path.join(d, "models", "ggml-%s.bin" % CFG["whisper_model"])
    ok = bool(exe) and os.path.exists(model) and shutil.which("ffmpeg")
    return ok, exe, model


async def hub_status(request):
    await check_pc()
    if request.query.get("active") == "1":
        cid = request.query.get("cid")
        if cid:
            S["active"][cid[:40]] = now()
        if S["pc"] == "awake":
            touch()
    await refresh_pc_models()
    pis = await pi_models()
    queued_drops = db.execute("SELECT COUNT(*) c FROM drops WHERE dir='to_pc' AND delivered IS NULL").fetchone()["c"]
    return J({
        "hub": VERSION,
        "pc": {
            "state": S["pc"], "lm": S["lm"],
            "waking_since": S["waking_since"] or None,
            "wake_timeout": settings()["wake_timeout"],
            "agent": agent_online(), "agent_info": S["agent"],
            "metrics": S["metrics"] if agent_online() else None,
            "hist": S["hist"][-72:] if agent_online() else [],
            "actions": S["actions"], "actions_error": S["actions_error"],
            "models": S["pc_models"], "model_busy": S["model_busy"],
            "last_tps": S["last_tps"],
            "awake_seconds": ((S["metrics"] or {}).get("awake_seconds") if agent_online() and S["metrics"] else None)
                             or (round(now() - S["awake_since"]) if S["pc"] == "awake" and S["awake_since"] else None),
            "queued_drops": queued_drops,
        },
        "pi": {"models": ["pi:" + x for x in pis], "stats": pi_stats(), "voice": bool(voice_paths()[0]),
               "push": PUSH["ok"]},
        "game_mode": kv_get("game_mode", False),
        "settings": settings(),
        "results": S["results"][:10],
        "running": [{"id": j.msg["id"], "chat_id": j.msg["chat_id"], "status": j.msg["status"]} for j in JOBS.values()],
        "time": now(),
    })


# ================================================================== /hub: chats
async def chats_list(request):
    rows = db.execute("""SELECT c.*, (SELECT content FROM messages m WHERE m.chat_id=c.id AND m.role='assistant'
                         ORDER BY created DESC LIMIT 1) AS last FROM chats c ORDER BY updated DESC LIMIT 300""").fetchall()
    return J([{"id": r["id"], "title": r["title"], "preset": r["preset"], "updated": r["updated"],
               "snippet": plain(strip_think(r["last"] or ""))[:90]} for r in rows])


async def chat_create(request):
    b = await body_json(request)
    cid = new_id()
    t = now()
    db.execute("INSERT INTO chats(id,title,preset,created,updated) VALUES(?,?,?,?,?)",
               (cid, b.get("title") or "", b.get("preset") or "assistant", t, t))
    db.commit()
    return J({"id": cid, "title": b.get("title") or "", "preset": b.get("preset") or "assistant", "updated": t})


async def chat_get(request):
    cid = request.match_info["id"]
    c = db.execute("SELECT * FROM chats WHERE id=?", (cid,)).fetchone()
    if not c:
        return err("Chat not found", 404)
    rows = db.execute("SELECT * FROM messages WHERE chat_id=? ORDER BY created", (cid,)).fetchall()
    msgs = []
    for r in rows:
        m = msg_row(r)
        if m["id"] in JOBS:
            m = dict(JOBS[m["id"]].msg)
        msgs.append(m)
    return J({"chat": {"id": c["id"], "title": c["title"], "preset": c["preset"], "updated": c["updated"]}, "messages": msgs})


async def chat_patch(request):
    cid = request.match_info["id"]
    b = await body_json(request)
    if "title" in b:
        db.execute("UPDATE chats SET title=? WHERE id=?", (b["title"][:120], cid))
    if "preset" in b:
        db.execute("UPDATE chats SET preset=? WHERE id=?", (b["preset"], cid))
    db.commit()
    return J({"ok": True})


async def chat_delete(request):
    cid = request.match_info["id"]
    for j in list(JOBS.values()):
        if j.msg["chat_id"] == cid and j.task:
            j.task.cancel()
    db.execute("DELETE FROM messages WHERE chat_id=?", (cid,))
    db.execute("DELETE FROM chats WHERE id=?", (cid,))
    db.commit()
    return J({"ok": True})


async def chats_delete_all(request):
    for j in list(JOBS.values()):
        if j.task:
            j.task.cancel()
    db.execute("DELETE FROM messages")
    db.execute("DELETE FROM chats")
    db.commit()
    return J({"ok": True})


async def chat_send(request):
    cid = request.match_info["id"]
    c = db.execute("SELECT * FROM chats WHERE id=?", (cid,)).fetchone()
    if not c:
        return err("Chat not found", 404)
    b = await body_json(request)
    if any(j.msg["chat_id"] == cid for j in JOBS.values()):
        return err("Still answering the last message", 409)
    req_model = b.get("model") or "auto"
    reason = None
    if b.get("wake") != "yes":
        # Work out who would answer. If that's the PC and it's asleep, ask the app first.
        if b.get("regenerate"):
            lu = db.execute("SELECT content, images FROM messages WHERE chat_id=? AND role='user' ORDER BY created DESC LIMIT 1", (cid,)).fetchone()
            q_text, q_imgs = (lu["content"] if lu else ""), (json.loads(lu["images"] or "[]") if lu else [])
        else:
            q_text, q_imgs = (b.get("content") or "").strip(), b.get("images") or []
        rm = req_model
        if rm == "auto":
            pr = next((p for p in presets() if p["id"] == c["preset"]), None)
            if pr and pr.get("model"):
                rm = pr["model"]
        target, model, reason = await route(rm, q_text, bool(q_imgs), cid)
        if target == "pc":
            await check_pc()
            if S["pc"] not in ("awake", "waking"):
                await refresh_pc_models()
                pis = await pi_models()
                return J({"needs_wake": True, "model": model or pick_pc_model(), "reason": reason or "",
                          "pi": ("pi:" + pis[0]) if pis else None})
            req_model = model or "pc"
        else:
            req_model = "pi:" + model
    elif req_model == "auto":
        req_model = "pc"
    user = None
    if b.get("regenerate"):
        last = db.execute("SELECT id, role FROM messages WHERE chat_id=? ORDER BY created DESC LIMIT 1", (cid,)).fetchone()
        if last and last["role"] == "assistant":
            db.execute("DELETE FROM messages WHERE id=?", (last["id"],))
            db.commit()
    else:
        text = (b.get("content") or "").strip()
        images = b.get("images") or []
        if not text and not images:
            return err("Empty message")
        user = {"id": new_id(), "chat_id": cid, "role": "user", "content": text, "reasoning": "", "images": images[:4],
                "model": "", "status": "done", "meta": {}, "created": now()}
        save_msg(user)
        if not c["title"]:
            title = re.sub(r"\s+", " ", text)[:60] if text else "📷 Image"
            db.execute("UPDATE chats SET title=? WHERE id=?", (title, cid))
            db.commit()
    touch()
    msg = start_job(cid, req_model, reason)
    chat_touch(cid)
    return J({"user": user, "assistant": msg})


async def msg_stop(request):
    j = JOBS.get(request.match_info["id"])
    if j and j.task:
        j.task.cancel()
    return J({"ok": True})


async def msg_stream(request):
    mid = request.match_info["id"]
    resp = cors(web.StreamResponse(headers={"Content-Type": "text/event-stream", "Cache-Control": "no-cache",
                                            "X-Accel-Buffering": "no"}))
    await resp.prepare(request)

    async def send(ev):
        await resp.write(("data: " + json.dumps(ev) + "\n\n").encode())

    job = JOBS.get(mid)
    if not job:
        r = db.execute("SELECT * FROM messages WHERE id=?", (mid,)).fetchone()
        if r:
            await send({"t": "snapshot", "msg": msg_row(r)})
        await send({"t": "end"})
        return resp
    q = asyncio.Queue()
    job.subs.add(q)
    try:
        await send({"t": "snapshot", "msg": job.msg})
        while True:
            try:
                ev = await asyncio.wait_for(q.get(), 15)
            except asyncio.TimeoutError:
                await resp.write(b": ping\n\n")
                continue
            evs = [ev]
            while not q.empty():
                evs.append(q.get_nowait())
            out, c, r = [], "", ""
            for e in evs:
                if e["t"] == "delta":
                    c += e["c"]
                    r += e["r"]
                    continue
                if c or r:
                    out.append({"t": "delta", "c": c, "r": r})
                    c, r = "", ""
                out.append(e)
            if c or r:
                out.append({"t": "delta", "c": c, "r": r})
            for e in out:
                await send(e)
            if any(e["t"] == "end" for e in out):
                break
    except (ConnectionResetError, asyncio.CancelledError):
        pass
    finally:
        job.subs.discard(q)
    return resp


async def chats_import(request):
    b = await body_json(request)
    n = 0
    for ch in (b.get("chats") or [])[:200]:
        cid = new_id()
        t = ch.get("updated") or now()
        db.execute("INSERT INTO chats(id,title,preset,created,updated) VALUES(?,?,?,?,?)",
                   (cid, (ch.get("title") or "Imported chat")[:120], "assistant", t, t))
        base_t = t - len(ch.get("messages", [])) - 1
        for i, mm in enumerate(ch.get("messages", [])):
            if mm.get("role") not in ("user", "assistant"):
                continue
            save_msg({"id": new_id(), "chat_id": cid, "role": mm["role"], "content": mm.get("content") or "",
                      "reasoning": mm.get("reasoning") or "", "images": (mm.get("images") or [])[:4],
                      "model": mm.get("model") or "", "status": "done", "meta": {"imported": True}, "created": base_t + i})
        n += 1
    db.commit()
    return J({"imported": n})


# ================================================================== /hub: settings & presets
async def settings_get(request):
    return J({"settings": settings(), "presets": presets()})


async def settings_put(request):
    b = await body_json(request)
    if "settings" in b:
        s = settings()
        for k, v in b["settings"].items():
            if k in SETTINGS_DEFAULT:
                s[k] = v
        s["wake_timeout"] = max(30, min(600, int(s["wake_timeout"])))
        s["keep_awake_minutes"] = max(1, min(240, int(s["keep_awake_minutes"])))
        kv_set("settings", s)
    if "presets" in b and isinstance(b["presets"], list):
        kv_set("presets", b["presets"][:20])
    return J({"settings": settings(), "presets": presets()})


# ================================================================== /hub: PC control
async def pc_power(request):
    b = await body_json(request)
    a = b.get("action")
    if a == "wake":
        await check_pc(0)
        if S["pc"] != "awake":
            start_wake()
        touch()
        return J({"ok": True, "state": S["pc"]})
    if a in ("sleep", "lock", "restart"):
        if not agent_online():
            return err("The PC helper isn't connected, so the Pi can't do that. Is the PC awake and the helper installed?", 409, "no_agent")
        queue_cmd(a)
        if a in ("sleep", "restart"):
            S["last_activity"] = 0
            S["sleeping_until"] = now() + (30 if a == "sleep" else 15)
        return J({"ok": True})
    return err("Unknown action")


async def pc_action(request):
    b = await body_json(request)
    aid = b.get("id")
    act = next((a for a in S["actions"] if a.get("id") == aid), None)
    if not act and agent_online():
        return err("That action isn't in the PC's actions.json", 404)
    await check_pc(0)
    if S["pc"] != "awake":
        start_wake()
    touch()
    queue_cmd("action", action=aid, name=(act or {}).get("name", aid))
    return J({"ok": True, "waking": S["pc"] != "awake"})


async def pc_clipboard(request):
    if not agent_online():
        return err("The PC is asleep or the helper isn't running.", 409)
    queue_cmd("get_clipboard")
    return J({"ok": True})


async def game_mode(request):
    b = await body_json(request)
    on = bool(b.get("on"))
    kv_set("game_mode", on)
    if on:
        await check_pc(0)
        if S["pc"] == "awake" and S["lm"]:
            try:
                await unload_all()
                add_result("game", "Game mode on", True, "AI models unloaded - your GPU is free")
            except Exception as e:
                add_result("game", "Game mode on", False, "Couldn't unload models: " + str(e))
        else:
            add_result("game", "Game mode on", True, "")
        S["pc_models_at"] = 0
    else:
        add_result("game", "Game mode off", True, "")
    return J({"game_mode": on})


async def models_op(request):
    b = await body_json(request)
    if S["model_busy"]:
        return err("Already busy with " + short(S["model_busy"]["id"]), 409)
    op, mid = b.get("op"), b.get("id")
    if op not in ("load", "unload") or not mid:
        return err("Bad request")
    asyncio.ensure_future(model_op(op, mid))
    return J({"ok": True})


# ================================================================== schedules
def compute_next(s, after):
    if s["kind"] == "once":
        return s["at"] if s["at"] > after else None
    try:
        tz = ZoneInfo(s.get("tz") or "Europe/London") if ZoneInfo else None
    except Exception:
        tz = None
    hh, mm = [int(x) for x in s["time"].split(":")]
    base = datetime.fromtimestamp(after, tz)
    for d in range(0, 9):
        day = base + timedelta(days=d)
        if day.weekday() not in s.get("days", list(range(7))):
            continue
        cand = day.replace(hour=hh, minute=mm, second=0, microsecond=0)
        if cand.timestamp() > after:
            return cand.timestamp()
    return None


def schedules_all():
    return [json.loads(r["data"]) for r in db.execute("SELECT data FROM schedules").fetchall()]


def schedule_save(s):
    db.execute("INSERT INTO schedules(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", (s["id"], json.dumps(s)))
    db.commit()


async def schedules_list(request):
    return J(sorted(schedules_all(), key=lambda s: s.get("next") or 9e12))


async def schedules_create(request):
    b = await body_json(request)
    s = {"id": new_id(), "label": (b.get("label") or "")[:60], "action": b.get("action") or "wake",
         "action_id": b.get("action_id"), "kind": "repeat" if b.get("time") else "once",
         "at": b.get("at"), "time": b.get("time"), "days": b.get("days") or list(range(7)),
         "tz": b.get("tz") or "Europe/London", "enabled": True, "last_run": None}
    if s["kind"] == "once" and not s["at"]:
        return err("Pick a time")
    s["next"] = compute_next(s, now())
    if not s["next"]:
        return err("That time is in the past")
    schedule_save(s)
    return J(s)


async def schedules_patch(request):
    sid = request.match_info["id"]
    b = await body_json(request)
    r = db.execute("SELECT data FROM schedules WHERE id=?", (sid,)).fetchone()
    if not r:
        return err("Not found", 404)
    s = json.loads(r["data"])
    if "enabled" in b:
        s["enabled"] = bool(b["enabled"])
        if s["enabled"]:
            s["next"] = compute_next(s, now())
            if not s["next"]:
                return err("That time is in the past")
    schedule_save(s)
    return J(s)


async def schedules_delete(request):
    db.execute("DELETE FROM schedules WHERE id=?", (request.match_info["id"],))
    db.commit()
    return J({"ok": True})


async def run_schedule(s):
    log("Schedule:", s.get("label") or s["action"])
    a = s["action"]
    title = s.get("label") or "Scheduled"
    if a == "wake":
        start_wake()
        await push("⏰ " + title, "Waking your PC now.", "/?tab=pc", "sched")
    elif a == "sleep":
        if agent_online():
            queue_cmd("sleep")
            S["last_activity"] = 0
            S["sleeping_until"] = now() + 30
        await push("⏰ " + title, "Putting your PC to sleep.", "/?tab=pc", "sched")
    elif a == "action":
        start_wake()
        act = next((x for x in S["actions"] if x.get("id") == s.get("action_id")), {})
        queue_cmd("action", action=s.get("action_id"), name=act.get("name", s.get("action_id")))
        await push("⏰ " + title, "Waking your PC and running " + act.get("name", "your action") + ".", "/?tab=pc", "sched")


async def scheduler():
    while True:
        try:
            t = now()
            for s in schedules_all():
                if not s.get("enabled") or not s.get("next") or s["next"] > t:
                    continue
                if t - s["next"] < 600:     # skip runs missed by more than 10 min (Pi was off)
                    await run_schedule(s)
                    s["last_run"] = t
                if s["kind"] == "once":
                    s["enabled"] = False
                    s["next"] = None
                else:
                    s["next"] = compute_next(s, t + 60)
                schedule_save(s)
            # drop stale commands
            S["commands"] = [c for c in S["commands"] if t - c["created"] < 900]
        except Exception as e:
            log("scheduler error:", e)
        await asyncio.sleep(15)


# ================================================================== drops (send to PC / phone)
def drop_row(r):
    return {"id": r["id"], "dir": r["dir"], "kind": r["kind"], "text": r["text"], "filename": r["filename"],
            "size": r["size"], "mime": r["mime"], "created": r["created"], "delivered": r["delivered"]}


def safe_name(n):
    n = os.path.basename(unquote(n or "file"))
    n = re.sub(r"[^\w.\- ()]+", "_", n).strip() or "file"
    return n[:120]


async def drops_list(request):
    rows = db.execute("SELECT * FROM drops ORDER BY created DESC LIMIT 150").fetchall()
    return J([drop_row(r) for r in rows])


async def drops_create(request):
    did = new_id()
    t = now()
    if (request.content_type or "").startswith("application/json"):
        b = await body_json(request)
        text = (b.get("text") or "").strip()
        if not text:
            return err("Nothing to send")
        db.execute("INSERT INTO drops(id,dir,kind,text,size,created) VALUES(?,?,?,?,?,?)",
                   (did, "to_pc", "text", text[:100000], len(text), t))
        wake = b.get("wake")
    else:
        name = safe_name(request.headers.get("X-Filename", "file"))
        path = os.path.join(DROPS, did + "_" + name)
        size = 0
        with open(path, "wb") as f:
            async for chunk in request.content.iter_chunked(65536):
                size += len(chunk)
                if size > 500 * 1024 * 1024:
                    f.close()
                    os.remove(path)
                    return err("File too big (max 500 MB)", 413)
                f.write(chunk)
        db.execute("INSERT INTO drops(id,dir,kind,filename,size,mime,path,created) VALUES(?,?,?,?,?,?,?,?)",
                   (did, "to_pc", "file", name, size, request.content_type or "application/octet-stream", path, t))
        wake = request.headers.get("X-Wake") == "1"
    db.commit()
    if wake:
        await check_pc(0)
        if S["pc"] != "awake":
            start_wake()
    touch()
    return J(drop_row(db.execute("SELECT * FROM drops WHERE id=?", (did,)).fetchone()))


async def drop_file(request):
    r = db.execute("SELECT * FROM drops WHERE id=?", (request.match_info["id"],)).fetchone()
    if not r or not r["path"] or not os.path.exists(r["path"]):
        return err("Not found", 404)
    resp = web.FileResponse(r["path"])
    disp = "inline" if (r["mime"] or "").startswith(("image/", "video/", "application/pdf", "text/")) else "attachment"
    resp.headers["Content-Disposition"] = '%s; filename="%s"' % (disp, r["filename"])
    if r["mime"]:
        resp.headers["Content-Type"] = r["mime"]
    return resp


async def drop_delete(request):
    r = db.execute("SELECT * FROM drops WHERE id=?", (request.match_info["id"],)).fetchone()
    if r and r["path"] and os.path.exists(r["path"]):
        os.remove(r["path"])
    db.execute("DELETE FROM drops WHERE id=?", (request.match_info["id"],))
    db.commit()
    return J({"ok": True})


def add_drop_to_phone(kind, text=None, filename=None, path=None, size=0, mime=None):
    did = new_id()
    db.execute("INSERT INTO drops(id,dir,kind,text,filename,size,mime,path,created,delivered) VALUES(?,?,?,?,?,?,?,?,?,?)",
               (did, "to_phone", kind, text, filename, size, mime, path, now(), now()))
    db.commit()
    return did


# ================================================================== push endpoints
async def push_key(request):
    return J({"ok": PUSH["ok"], "key": PUSH["public"]})


async def push_subscribe(request):
    b = await body_json(request)
    sub = b.get("subscription") or {}
    if not sub.get("endpoint") or not sub.get("keys"):
        return err("Bad subscription")
    sub = {"endpoint": sub["endpoint"], "keys": sub["keys"], "cid": (b.get("cid") or "")[:40]}
    db.execute("INSERT INTO push_subs(endpoint,data,created) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET data=excluded.data",
               (sub["endpoint"], json.dumps(sub), now()))
    db.commit()
    return J({"ok": True})


async def push_unsubscribe(request):
    b = await body_json(request)
    db.execute("DELETE FROM push_subs WHERE endpoint=?", ((b.get("subscription") or {}).get("endpoint", ""),))
    db.commit()
    return J({"ok": True})


async def push_test(request):
    n = db.execute("SELECT COUNT(*) c FROM push_subs").fetchone()["c"]
    if not n:
        return err("No device has turned on notifications yet", 404)
    r = await push("Home AI 🔔", "Notifications are working!", "/", "test")
    return J({"ok": not r["errors"], "devices": n, "sent": r["sent"], "errors": r["errors"]})


# ================================================================== voice (whisper.cpp on the Pi)
VOICE_LOCK = asyncio.Lock()


async def voice(request):
    ok, exe, model = voice_paths()
    if not ok:
        return err("Private voice isn't installed on the Pi yet (run voice-setup.sh).", 501)
    data = await request.read()
    if len(data) > 25 * 1024 * 1024:
        return err("Recording too long", 413)
    vid = new_id()
    src, wav = os.path.join(TMP, vid + ".in"), os.path.join(TMP, vid + ".wav")
    with open(src, "wb") as f:
        f.write(data)
    try:
        async with VOICE_LOCK:
            p = await asyncio.create_subprocess_exec("ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ar", "16000", "-ac", "1",
                                                     "-c:a", "pcm_s16le", wav)
            await asyncio.wait_for(p.wait(), 60)
            if p.returncode != 0:
                return err("Couldn't read the recording", 400)
            lang = settings().get("voice_language") or "auto"
            p = await asyncio.create_subprocess_exec(exe, "-m", model, "-f", wav, "-l", lang, "-nt", "-np", "-t", str(os.cpu_count() or 4),
                                                     stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
            out, _ = await asyncio.wait_for(p.communicate(), 120)
        text = re.sub(r"\s+", " ", out.decode("utf-8", "ignore")).strip()
        text = re.sub(r"^\[.*?\]\s*", "", text)
        if text in ("[BLANK_AUDIO]", "(silence)"):
            text = ""
        return J({"text": text})
    finally:
        for p_ in (src, wav):
            if os.path.exists(p_):
                os.remove(p_)


# ================================================================== home devices
def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.168.0.1", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


async def home_get(request):
    devs = []
    for r in db.execute("SELECT * FROM devices ORDER BY updated DESC").fetchall():
        d = json.loads(r["data"])
        d["updated"] = r["updated"]
        d["online"] = now() - r["updated"] < max(120, 3 * d.get("interval", 30))
        d["desired"] = kv_get("relays_" + r["id"], {})
        devs.append(d)
    return J({"devices": devs, "device_key": CFG["device_key"], "ip": lan_ip(), "port": CFG["device_port"]})


async def home_relay(request):
    b = await body_json(request)
    did, name = b.get("device"), b.get("relay")
    if not did or not name:
        return err("Bad request")
    desired = kv_get("relays_" + did, {})
    desired[name] = bool(b.get("on"))
    kv_set("relays_" + did, desired)
    return J({"desired": desired})


async def home_history(request):
    did, key = request.query.get("device"), request.query.get("key")
    since = now() - float(request.query.get("hours", 24)) * 3600
    pts = []
    for r in db.execute("SELECT ts, data FROM readings WHERE device=? AND ts>? ORDER BY ts", (did, since)).fetchall():
        v = json.loads(r["data"]).get(key)
        if isinstance(v, (int, float)):
            pts.append([r["ts"], v])
    return J(pts)


async def device_report(request):
    """Called by ESP32 devices on the home network (port 8090)."""
    if CFG.get("device_key") and request.headers.get("X-Key") != CFG["device_key"]:
        return err("Wrong device key", 401)
    b = await body_json(request)
    did = re.sub(r"[^\w\-]", "", str(b.get("id") or ""))[:40]
    if not did:
        return err("Missing id")
    old = db.execute("SELECT data FROM devices WHERE id=?", (did,)).fetchone()
    d = json.loads(old["data"]) if old else {}
    d.update({"id": did, "name": b.get("name") or did, "kind": b.get("kind") or "sensor",
              "readings": b.get("readings") or {}, "units": b.get("units") or d.get("units") or {},
              "relays": b.get("relays") or {}, "interval": int(b.get("interval") or 30), "ip": request.remote})
    t = now()
    db.execute("INSERT INTO devices(id,data,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated=excluded.updated",
               (did, json.dumps(d), t))
    last = db.execute("SELECT MAX(ts) m FROM readings WHERE device=?", (did,)).fetchone()["m"] or 0
    if d["readings"] and t - last > 300:
        db.execute("INSERT INTO readings(device,ts,data) VALUES(?,?,?)", (did, t, json.dumps(d["readings"])))
        db.execute("DELETE FROM readings WHERE ts<?", (t - 30 * 86400,))
    db.commit()
    return J({"ok": True, "relays": kv_get("relays_" + did, {})})


# ================================================================== PC helper endpoints
async def agent_poll(request):
    b = await body_json(request)
    t = now()
    first = not agent_online()
    S["agent_seen"] = t
    S["agent"] = {"version": b.get("version"), "host": b.get("host"), "idle": b.get("idle_seconds")}
    if t > S["sleeping_until"]:
        if S["pc"] != "awake":
            S["awake_since"] = t
        S["pc"] = "awake"
    if first:
        log("PC helper connected")
        S["checked"] = 0
    mt = b.get("metrics")
    if mt:
        mt["at"] = t
        S["metrics"] = mt
        g = (mt.get("gpus") or [{}])[0] if mt.get("gpus") else {}
        S["hist"].append({"t": round(t), "cpu": mt.get("cpu"), "ram": round(100 * mt["ram_used"] / mt["ram_total"]) if mt.get("ram_total") else None,
                          "gpu": g.get("util"), "gpu_temp": g.get("temp"), "vram": round(100 * g["mem_used"] / g["mem_total"]) if g.get("mem_total") else None})
        del S["hist"][:-180]
    if "actions" in b:
        S["actions"] = b.get("actions") or []
        S["actions_error"] = b.get("actions_error")
    # what to send down
    cmds = S["commands"]
    S["commands"] = []
    sleeping = any(c["type"] in ("sleep", "restart") for c in cmds)
    for r in db.execute("SELECT * FROM drops WHERE dir='to_pc' AND delivered IS NULL AND (sent IS NULL OR sent<?) ORDER BY created",
                        (t - 120,)).fetchall():
        cmds.insert(0, {"id": "drop-" + r["id"], "type": "drop", "drop_id": r["id"], "kind": r["kind"], "text": r["text"],
                        "filename": r["filename"], "size": r["size"]})
        db.execute("UPDATE drops SET sent=? WHERE id=?", (t, r["id"]))
    db.commit()
    keep = (t - S["last_activity"] < settings()["keep_awake_minutes"] * 60) or bool(JOBS) or bool(S["model_busy"]) or bool(cmds)
    if sleeping:
        keep = False
        S["agent_seen"] = 0
        S["pc"] = "asleep"
        S["checked"] = t + 10
    return J({"keep_awake": keep, "commands": cmds, "interval": 5})


async def agent_result(request):
    b = await body_json(request)
    cid = b.get("id", "")
    if cid.startswith("drop-"):
        if b.get("ok"):
            db.execute("UPDATE drops SET delivered=? WHERE id=?", (now(), cid[5:]))
            db.commit()
        else:
            add_result("drop", "Send to PC", False, b.get("message", ""))
        return J({"ok": True})
    if "clipboard" in b:
        txt = b.get("clipboard") or ""
        if txt:
            add_drop_to_phone("text", text=txt[:100000], size=len(txt))
            await push("📋 PC clipboard", txt[:120], "/?tab=send", "clip")
        add_result("clipboard", "PC clipboard", bool(txt), "" if txt else "The clipboard is empty or not text")
        return J({"ok": True})
    add_result(b.get("type") or "action", b.get("name") or "Action", bool(b.get("ok")), b.get("message", ""))
    if not b.get("ok"):
        await push("⚠️ " + (b.get("name") or "Action") + " failed", b.get("message", ""), "/?tab=pc", "action")
    return J({"ok": True})


async def agent_file(request):
    r = db.execute("SELECT * FROM drops WHERE id=?", (request.match_info["id"],)).fetchone()
    if not r or not r["path"]:
        return err("Not found", 404)
    return web.FileResponse(r["path"])


async def agent_upload(request):
    name = safe_name(request.headers.get("X-Filename", "file"))
    did_path = os.path.join(DROPS, new_id() + "_" + name)
    size = 0
    with open(did_path, "wb") as f:
        async for chunk in request.content.iter_chunked(65536):
            size += len(chunk)
            f.write(chunk)
    import mimetypes
    mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
    add_drop_to_phone("file", filename=name, path=did_path, size=size, mime=mime)
    await push("📥 From your PC", name, "/?tab=send", "drop")
    return J({"ok": True})


async def gw_agent_compat(request):
    """Old PC helper (v1) support."""
    S["agent_seen"] = now()
    if now() > S["sleeping_until"]:
        S["pc"] = "awake"
    sleep_now = any(c["type"] == "sleep" for c in S["commands"])
    S["commands"] = [c for c in S["commands"] if c["type"] != "sleep"]
    keep = now() - S["last_activity"] < settings()["keep_awake_minutes"] * 60 or bool(JOBS)
    if sleep_now:
        S["agent_seen"] = 0
        S["pc"] = "asleep"
        S["checked"] = now() + 10
    return J({"keep_awake": keep and not sleep_now, "sleep_now": sleep_now})


# ================================================================== raw proxy to LM Studio (for other tools)
HOP = {"host", "content-length", "transfer-encoding", "connection", "keep-alive", "accept-encoding",
       "content-encoding", "origin", "referer", "upgrade", "te", "trailer"}


async def proxy(request):
    if not request.path.startswith(("/v1/", "/api/v0/", "/api/v1/")):
        return err("Not found", 404)
    await check_pc()
    if not (S["pc"] == "awake" and S["lm"]):
        if request.method != "POST":
            return err("Your PC is asleep." if S["pc"] != "awake" else "LM Studio isn't running.", 503, "pc_asleep")
        if not await ensure_pc():
            return err("Your PC didn't wake up.", 504, "wake_failed")
    touch()
    body = await request.read()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    async with SESSION.request(request.method, PC + str(request.rel_url), headers=headers, data=body,
                               timeout=ClientTimeout(total=None, sock_connect=10, sock_read=900)) as up:
        resp = web.StreamResponse(status=up.status)
        for k, v in up.headers.items():
            if k.lower() not in HOP and not k.lower().startswith("access-control-"):
                resp.headers[k] = v
        cors(resp)
        await resp.prepare(request)
        try:
            async for chunk in up.content.iter_any():
                await resp.write(chunk)
            await resp.write_eof()
        except (ConnectionResetError, asyncio.CancelledError):
            pass
    return resp


# ================================================================== app setup
async def on_startup(app):
    global SESSION
    SESSION = ClientSession()
    # any answer that was mid-way when the hub restarted
    db.execute("UPDATE messages SET status='error', meta=json_set(COALESCE(meta,'{}'),'$.error','Interrupted (the Pi restarted)') "
               "WHERE status NOT IN ('done','error','stopped')")
    db.commit()
    app["tasks"] = [asyncio.ensure_future(scheduler())]
    # device server for ESP32s on the home network
    dev = web.Application(middlewares=[mw])
    dev.router.add_post("/home/report", device_report)
    dev.router.add_get("/", lambda r: J({"home_ai_hub": VERSION}))
    runner = web.AppRunner(dev)
    await runner.setup()
    try:
        await web.TCPSite(runner, "0.0.0.0", int(CFG["device_port"])).start()
        log("Device port", CFG["device_port"], "open on the home network")
    except OSError as e:
        log("Couldn't open device port:", e)
    app["dev_runner"] = runner


async def on_cleanup(app):
    for t in app["tasks"]:
        t.cancel()
    await app["dev_runner"].cleanup()
    await SESSION.close()


def make_app():
    app = web.Application(middlewares=[mw], client_max_size=600 * 1024 * 1024)
    r = app.router
    r.add_get("/hub/status", hub_status)
    r.add_get("/hub/chats", chats_list)
    r.add_post("/hub/chats", chat_create)
    r.add_delete("/hub/chats", chats_delete_all)
    r.add_post("/hub/chats/import", chats_import)
    r.add_get("/hub/chats/{id}", chat_get)
    r.add_patch("/hub/chats/{id}", chat_patch)
    r.add_delete("/hub/chats/{id}", chat_delete)
    r.add_post("/hub/chats/{id}/send", chat_send)
    r.add_get("/hub/messages/{id}/stream", msg_stream)
    r.add_post("/hub/messages/{id}/stop", msg_stop)
    r.add_get("/hub/settings", settings_get)
    r.add_put("/hub/settings", settings_put)
    r.add_post("/hub/pc/power", pc_power)
    r.add_post("/hub/pc/action", pc_action)
    r.add_post("/hub/pc/clipboard", pc_clipboard)
    r.add_post("/hub/game", game_mode)
    r.add_post("/hub/models", models_op)
    r.add_get("/hub/schedules", schedules_list)
    r.add_post("/hub/schedules", schedules_create)
    r.add_patch("/hub/schedules/{id}", schedules_patch)
    r.add_delete("/hub/schedules/{id}", schedules_delete)
    r.add_get("/hub/drops", drops_list)
    r.add_post("/hub/drops", drops_create)
    r.add_get("/hub/drops/{id}/file", drop_file)
    r.add_delete("/hub/drops/{id}", drop_delete)
    r.add_get("/hub/push/key", push_key)
    r.add_post("/hub/push/subscribe", push_subscribe)
    r.add_post("/hub/push/unsubscribe", push_unsubscribe)
    r.add_post("/hub/push/test", push_test)
    r.add_post("/hub/voice", voice)
    r.add_get("/hub/home", home_get)
    r.add_post("/hub/home/relay", home_relay)
    r.add_get("/hub/home/history", home_history)
    r.add_post("/agent/poll", agent_poll)
    r.add_post("/agent/result", agent_result)
    r.add_get("/agent/file/{id}", agent_file)
    r.add_post("/agent/upload", agent_upload)
    r.add_get("/gw/agent", gw_agent_compat)
    r.add_get("/gw/status", lambda req: J({"gateway": 1, "hub": VERSION, "pc": S["pc"], "lm": S["lm"]}))
    r.add_route("*", "/{tail:.*}", proxy)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == "__main__":
    log("Home AI hub", VERSION, "on", CFG["listen_host"], CFG["listen_port"], "-> PC", PC)
    web.run_app(make_app(), host=CFG["listen_host"], port=int(CFG["listen_port"]), print=None)
