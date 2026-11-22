/* Home AI v2 — app */
(() => {
"use strict";
const VERSION = "2.2.0";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ icons */
const P = {
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  compose: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  spark: '<path d="M12 3l1.8 4.9L19 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="M21 15l-5-5L5 21"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  clip: '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  chat: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.4A8.5 8.5 0 1 1 21 12Z"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  restart: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const icon = (n, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[n] || ""}</svg>`;
function paintIcons(root = document) { $$("[data-ic]", root).forEach(el => { el.innerHTML = icon(el.dataset.ic); el.removeAttribute("data-ic"); }); }
const orbHTML = (cls = "asleep", extra = "") => `<div class="orb ${cls} ${extra}"><div class="ring"></div><div class="core"></div></div>`;

/* ------------------------------------------------------------------ storage & config */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const DEFAULT_URL = "https://pi.taild9cfe3.ts.net";
let cfg = Object.assign({ url: DEFAULT_URL, token: "", model: "auto", voice: "auto", autoSpeak: false }, LS.get("hai2", {}));
if (!LS.get("hai2")) {
  const old = LS.get("settings", {});
  if (old.token) cfg.token = old.token;
  if (old.url && !/arthur-pc/.test(old.url)) cfg.url = old.url;
}
const saveCfg = () => LS.set("hai2", cfg);
let CID = LS.get("cid"); if (!CID) { CID = Math.random().toString(36).slice(2, 12); LS.set("cid", CID); }
const base = () => cfg.url.trim().replace(/\/+$/, "");
const authH = () => (cfg.token ? { Authorization: "Bearer " + cfg.token } : {});

async function api(path, { method = "GET", body, headers = {}, signal, timeout = 20000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  if (signal) signal.addEventListener("abort", () => ac.abort());
  const opts = { method, headers: { ...authH(), ...headers }, signal: ac.signal, cache: "no-store" };
  if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
  try {
    const r = await fetch(base() + path, opts);
    let j = null; try { j = await r.json(); } catch {}
    if (!r.ok) { const e = new Error((j && j.error && j.error.message) || "Error " + r.status); e.status = r.status; e.code = j && j.error && j.error.code; throw e; }
    return j;
  } finally { clearTimeout(t); }
}

/* ------------------------------------------------------------------ state */
const st = {
  tab: "chat", status: null, online: null, chats: [], chatQuery: "",
  chat: null, msgs: [], streams: new Map(), pending: [], newPreset: "assistant",
  settings: null, presets: [], schedules: [], drops: [], home: null, busyAction: null,
};

/* ------------------------------------------------------------------ helpers */
let toastT;
function toast(msg, ms = 2800) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms); }
const short = id => id ? String(id).replace(/^pi:/, "").split("/").pop() : "";
const fmtBytes = b => { if (b == null) return "—"; const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return (b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)) + " " + u[i]; };
const fmtDur = s => { s = Math.max(0, Math.round(s)); if (s < 60) return "less than a minute"; const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
function ago(t) {
  const s = Date.now() / 1000 - t;
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + " min ago"; if (s < 86400) return Math.floor(s / 3600) + " h ago";
  const d = new Date(t * 1000); return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
const clock = t => new Date(t * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const isStandalone = () => navigator.standalone || matchMedia("(display-mode: standalone)").matches;
const coarse = matchMedia("(pointer:coarse)").matches;
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch {} ta.remove();
  }
  if (btn) { const o = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = o), 1200); }
}

/* ------------------------------------------------------------------ markdown */
function parts(m) {
  let r = m.reasoning || "", c = m.content || "";
  const s = c.indexOf("<think>");
  if (s >= 0) { const e = c.indexOf("</think>", s); if (e >= 0) { r += c.slice(s + 7, e); c = c.slice(0, s) + c.slice(e + 8); } else { r += c.slice(s + 7); c = c.slice(0, s); } }
  else { const e = c.indexOf("</think>"); if (e >= 0) { r += c.slice(0, e); c = c.slice(e + 8); } }
  return { r: r.trim(), c: c.replace(/^\s+/, "") };
}
function inline(s) {
  return s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function tex(src, display) {
  if (window.katex) {
    try { return katex.renderToString(src, { displayMode: display, throwOnError: false, output: "html", strict: "ignore" }); } catch {}
  }
  return esc(display ? "$$" + src + "$$" : "$" + src + "$");
}
function md(src) {
  const blocks = [], spans = [];
  src = src.replace(/```([^\n`]*)\n?([\s\S]*?)(```|$)/g, (_, lang, code) => {
    blocks.push(`<pre><div class="code-head"><span>${esc(lang.trim() || "code")}</span><button class="cp">Copy</button></div><code>${esc(code.replace(/\n$/, ""))}</code></pre>`);
    return "\n\u0000" + (blocks.length - 1) + "\u0000\n";
  });
  // protect inline code, then maths, from the markdown rules
  const keep = html => { spans.push(html); return "\u0001" + (spans.length - 1) + "\u0001"; };
  src = src.replace(/`([^`\n]+)`/g, (_, c) => keep("<code>" + esc(c) + "</code>"));
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => "\n\u0002" + keep(`<div class="math-block">${tex(m.trim(), true)}</div>`) + "\n");
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => "\n\u0002" + keep(`<div class="math-block">${tex(m.trim(), true)}</div>`) + "\n");
  src = src.replace(/\\\((.+?)\\\)/g, (_, m) => keep(tex(m, false)));
  src = src.replace(/(^|[^\\$\w])\$(?=\S)([^$\n]+?)(?<=\S)\$(?!\d)/g, (all, pre, m) => (/^[\d.,\s]+$/.test(m) ? all : pre + keep(tex(m, false))));
  const lines = esc(src).split("\n");
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) { out.push("<p>" + inline(para.join("<br>")) + "</p>"); para = []; } };
  const closeL = () => { if (list) { out.push("</" + list + ">"); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]; let m;
    if (/^\u0000\d+\u0000$/.test(ln.trim())) { flushP(); closeL(); out.push(ln.trim()); continue; }
    if (/^\u0002\u0001\d+\u0001$/.test(ln.trim())) { flushP(); closeL(); out.push(ln.trim().slice(1)); continue; }
    if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flushP(); closeL();
      const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => inline(c.trim()));
      let h = "<div class='tbl'><table><thead><tr>" + cells(ln).map(c => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>";
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { h += "<tr>" + cells(lines[i]).map(c => "<td>" + c + "</td>").join("") + "</tr>"; i++; }
      i--; out.push(h + "</tbody></table></div>"); continue;
    }
    if ((m = ln.match(/^\s*(#{1,6})\s+(.*)/))) { flushP(); closeL(); const lv = Math.min(4, Math.max(2, m[1].length + 1)); out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(ln)) { flushP(); closeL(); out.push("<hr>"); continue; }
    if ((m = ln.match(/^\s*&gt;\s?(.*)/))) { flushP(); closeL(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); continue; }
    if ((m = ln.match(/^\s*[-*•]\s+(.*)/))) { flushP(); if (list !== "ul") { closeL(); out.push("<ul>"); list = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }
    if ((m = ln.match(/^\s*(\d+)[.)]\s+(.*)/))) { flushP(); if (list !== "ol") { closeL(); out.push(m[1] !== "1" ? `<ol start="${+m[1]}">` : "<ol>"); list = "ol"; } out.push("<li>" + inline(m[2]) + "</li>"); continue; }
    if (ln.trim() === "") { flushP(); closeL(); continue; }
    closeL(); para.push(ln);
  }
  flushP(); closeL();
  return out.join("").replace(/\u0002/g, "").replace(/\u0001(\d+)\u0001/g, (_, i) => spans[+i]).replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
}

/* ------------------------------------------------------------------ tabs */
function setTab(t) {
  st.tab = t;
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "view-" + t));
  $$(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  if (t === "pc") { renderPC(); loadSchedules(); }
  if (t === "home") loadHome();
  if (t === "send") loadDrops();
  if (t === "settings") renderSettings();
  pollSoon();
}
$("#tabbar").addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) setTab(b.dataset.tab); });

/* ------------------------------------------------------------------ status polling */
let pollTimer = null;
async function poll() {
  clearTimeout(pollTimer);
  try {
    st.status = await api("/hub/status" + (document.hidden ? "" : "?active=1&cid=" + CID), { timeout: 8000 });
    st.online = true;
  } catch (e) {
    st.online = false; st.statusErr = e;
  }
  renderStatusBits();
  if (st.tab === "pc") renderPC();
  if (!document.hidden) pollTimer = setTimeout(poll, st.tab === "pc" ? 4000 : 9000);
}
function pollSoon() { clearTimeout(pollTimer); pollTimer = setTimeout(poll, 150); }
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { pollSoon(); resumeChat(); }
});

function pcInfo() {
  const s = st.status;
  if (!st.online) return { cls: "offline", dot: "off", title: "Can't reach your Pi", sub: "Check that Tailscale is on for this device." };
  const pc = s.pc;
  if (pc.state === "awake" && pc.lm) return { cls: "awake", dot: "awake", title: "Awake", sub: "" };
  if (pc.state === "awake") return { cls: "lmoff", dot: "waking", title: "Awake, LM Studio is starting", sub: "Chats will start as soon as it's ready." };
  if (pc.state === "waking") {
    const el = pc.waking_since ? s.time - pc.waking_since : 0;
    return { cls: "waking", dot: "waking", title: el > 90 ? "Still waking…" : "Waking up…", sub: mmss(el) + " of up to " + mmss(pc.wake_timeout) };
  }
  return { cls: "asleep", dot: "", title: "Asleep", sub: "Tap the orb to wake it" };
}

function renderStatusBits() {
  const i = pcInfo();
  $("#pcDot").className = "dot " + i.dot;
  $("#pcLineText").textContent = st.online ? (i.cls === "awake" ? "PC awake" + (st.status.game_mode ? ", game mode" : "") : i.cls === "asleep" ? "PC asleep" : i.cls === "waking" ? "PC waking…" : i.title) : "Pi offline";
  updateModelPill();
  if (!st.online && st.statusErr && st.statusErr.status === 401) $("#pcLineText").textContent = "Token rejected";
}
$("#pcLine").onclick = () => setTab("pc");

/* ------------------------------------------------------------------ chats list / drawer */
async function loadChats() {
  try { st.chats = await api("/hub/chats"); } catch { }
  renderChatList();
}
function chatListHTML() {
  const q = st.chatQuery.toLowerCase();
  const running = new Set(((st.status && st.status.running) || []).map(r => r.chat_id));
  const list = st.chats.filter(c => !q || (c.title || "").toLowerCase().includes(q) || (c.snippet || "").toLowerCase().includes(q));
  const legacy = legacyCount();
  let h = `<div class="chatlist-head"><label class="search">${icon("search", 'width="16" height="16"')}<input type="search" placeholder="Search chats" value="${esc(st.chatQuery)}" data-act="search"></label>
    <button class="btn sm primary" data-act="new" aria-label="New chat">${icon("plus")}</button></div>`;
  if (legacy) h += `<div class="migrate">This device still has <b>${legacy}</b> chat${legacy > 1 ? "s" : ""} from the old app. Move them to the Pi so they show up everywhere.<button class="btn sm" data-act="migrate">Move ${legacy} chat${legacy > 1 ? "s" : ""} to the Pi</button></div>`;
  h += `<div class="chatlist">`;
  if (!list.length) h += `<div class="list-note">${q ? "No chats match." : "No chats yet. Ask something and it shows up here, on every device."}</div>`;
  let lastGroup = "";
  for (const c of list) {
    const d = (Date.now() / 1000 - c.updated) < 86400 ? "Today" : (Date.now() / 1000 - c.updated) < 7 * 86400 ? "This week" : "Older";
    if (d !== lastGroup) { h += `<div class="group-label">${d}</div>`; lastGroup = d; }
    h += `<div class="citem ${st.chat && st.chat.id === c.id ? "on" : ""}">
      ${running.has(c.id) ? '<span class="live-dot" title="Answering"></span>' : ""}
      <button class="open" data-act="open" data-id="${c.id}"><span class="t">${esc(c.title || "New chat")}</span><span class="s">${esc(c.snippet || ago(c.updated))}</span></button>
      <button class="del" data-act="del" data-id="${c.id}" aria-label="Delete chat">${icon("trash", 'width="17" height="17"')}</button></div>`;
  }
  return h + "</div>";
}
function renderChatList() {
  const h = chatListHTML();
  $("#drawer").innerHTML = h;
  $("#chatListCol").innerHTML = h;
}
function chatListClick(e) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act;
  if (a === "open") { openChat(b.dataset.id); closeDrawer(); }
  if (a === "new") { newChat(); closeDrawer(); }
  if (a === "del") delChat(b.dataset.id);
  if (a === "migrate") migrate();
}
["#drawer", "#chatListCol"].forEach(s => {
  $(s).addEventListener("click", chatListClick);
  $(s).addEventListener("input", e => { if (e.target.dataset.act === "search") { st.chatQuery = e.target.value; const pos = e.target.selectionStart; renderChatList(); const inp = $(s + " input[type=search]"); if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); } } });
});
const openDrawer = () => { renderChatList(); document.body.classList.add("drawer-open"); };
const closeDrawer = () => document.body.classList.remove("drawer-open");
$("#menuBtn").onclick = openDrawer;
$("#scrim").onclick = closeDrawer;
$("#newChatBtn").onclick = () => newChat();

async function delChat(id) {
  if (!confirm("Delete this chat on all your devices?")) return;
  try { await api("/hub/chats/" + id, { method: "DELETE" }); } catch (e) { toast(e.message); return; }
  if (st.chat && st.chat.id === id) newChat();
  loadChats();
}

/* legacy (v1) chats stored on this device */
let legacyChats = null;
async function readLegacy() {
  if (LS.get("migrated")) return;
  try {
    const d = await new Promise((res, rej) => { const r = indexedDB.open("home-ai", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    legacyChats = await new Promise(res => { const r = d.transaction("kv").objectStore("kv").get("chats"); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
  } catch { legacyChats = []; }
  if (!legacyChats.length) legacyChats = LS.get("chats", []);
  legacyChats = (legacyChats || []).filter(c => c.messages && c.messages.length);
  renderChatList();
}
const legacyCount = () => (legacyChats && !LS.get("migrated") ? legacyChats.length : 0);
async function migrate() {
  try {
    const r = await api("/hub/chats/import", { method: "POST", body: { chats: legacyChats }, timeout: 60000 });
    LS.set("migrated", true); legacyChats = [];
    toast("Moved " + r.imported + " chats to the Pi");
    loadChats();
  } catch (e) { toast("Couldn't move chats: " + e.message); }
}

/* ------------------------------------------------------------------ chat view */
function presetById(id) { return st.presets.find(p => p.id === id) || st.presets[0] || { id: "assistant", name: "Assistant", icon: "✨" }; }
function newChat() {
  st.chat = null; st.msgs = []; st.pending = []; renderPending();
  history.replaceState(null, "", location.pathname);
  renderChat(); renderChatList();
  if (!coarse) $("#input").focus();
}
async function openChat(id, quiet) {
  try {
    const r = await api("/hub/chats/" + id);
    st.chat = r.chat; st.msgs = r.messages;
  } catch (e) { if (!quiet) toast(e.message); return; }
  renderChat(); renderChatList();
  st.msgs.filter(m => m.role === "assistant" && !["done", "error", "stopped"].includes(m.status)).forEach(m => attachStream(m.id));
}
async function resumeChat() {
  if (!st.chat) return;
  openChat(st.chat.id, true);
  loadChats();
}

function renderChat() {
  $("#chatTitle").textContent = st.chat ? (st.chat.title || "New chat") : "New chat";
  const pr = presetById(st.chat ? st.chat.preset : st.newPreset);
  $("#presetPillIcon").textContent = pr.icon || "✨";
  $("#presetPillText").textContent = pr.name;
  const box = $("#messages");
  if (!st.msgs.length) { box.innerHTML = helloHTML(); return; }
  box.innerHTML = "";
  st.msgs.forEach((m, i) => box.appendChild(msgEl(m, i === st.msgs.length - 1)));
  scrollBottom(true);
}

function helloHTML() {
  const name = "Arthur";
  const h = new Date().getHours();
  const greet = h < 5 ? "Late one, " + name + "?" : h < 12 ? "Morning, " + name + "." : h < 18 ? "What are we building, " + name + "?" : "Evening, " + name + ".";
  const i = pcInfo();
  const sub = !st.online ? "I can't reach your Pi right now." : i.cls === "awake" ? "Your PC is awake and ready." : i.cls === "asleep" ? (st.status && st.status.settings.smart_routing ? "Your PC is asleep. Quick questions go to the Pi; bigger ones wake the PC." : "Your PC is asleep. Sending a message wakes it.") : i.title;
  const chips = st.presets.map(p => `<button class="preset ${p.id === st.newPreset ? "on" : ""}" data-preset="${esc(p.id)}">${esc(p.icon || "")} ${esc(p.name)}</button>`).join("");
  const ideas = {
    roblox: ["Write a server script that gives players a coin every minute", "Why is my RemoteEvent firing twice?", "Make a smooth sliding door with TweenService"],
    esp32: ["Wire a BME280 to an ESP32 and read it", "Make a relay switch from a web page on ESP32", "Why does my ESP32 reset when the relay clicks?"],
    quick: ["What's 18 °C in Fahrenheit?", "Synonym for 'efficient'", "How many grams in an ounce?"],
  }[st.newPreset] || ["Explain how Wake-on-LAN works", "Plan a weather station with an ESP32", "Help me name my Roblox game"];
  return `<div class="hello">${orbHTML(i.cls)}<h2>${esc(greet)}</h2><p>${esc(sub)}</p>
    <div class="presets">${chips}</div>
    <div class="ideas">${ideas.map(t => `<button class="idea" data-idea="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>`;
}

function msgEl(m, isLast) {
  const el = document.createElement("div");
  el.className = "msg " + m.role;
  el.dataset.id = m.id;
  fillMsg(el, m, isLast);
  return el;
}
const FINAL = ["done", "error", "stopped"];
function fillMsg(el, m, isLast) {
  if (m.role === "user") {
    el.innerHTML = (m.images && m.images.length ? `<div class="imgs">${m.images.map(u => `<img src="${esc(u)}" alt="Photo you sent">`).join("")}</div>` : "") +
      (m.content ? `<div class="bubble">${esc(m.content)}</div>` : "");
    return;
  }
  const p = parts(m), meta = m.meta || {}, live = !FINAL.includes(m.status);
  el.classList.toggle("live", live && m.status === "generating");
  let h = "";
  if (m.model) {
    const pi = m.model.startsWith("pi:");
    h += `<div class="who"><span class="${pi ? "chip-pi" : "chip-pc"}">${pi ? "PI" : "PC"}</span>${esc(short(m.model))}</div>`;
  }
  if (meta.route_reason && meta.route === "pi") h += `<div class="reason">${esc(meta.route_reason)}</div>`;
  if (live && !p.c) h += stageHTML(m);
  if (p.r) {
    const thinking = live && !p.c;
    h += `<details class="think"${thinking ? " open" : ""}><summary>${thinking ? '<span class="shimmer">Thinking…</span>' : "Thought process"}</summary><div class="tb">${esc(p.r)}</div></details>`;
  }
  if (p.c) h += `<div class="md">${md(p.c)}</div>`;
  else if (m.status === "generating") h += `<div class="md"></div>`;
  if (m.status === "stopped") h += `<div class="stopped">Stopped.</div>`;
  if (m.status === "error") {
    const pis = (st.status && st.status.pi.models) || [];
    h += `<div class="errbox">${esc(meta.error || "Something went wrong.")}<div class="row">
      <button class="btn sm" data-act="retry">Try again</button>
      ${meta.error_code === "wake_failed" && pis.length ? `<button class="btn sm" data-act="ask-pi">Ask the Pi instead</button>` : ""}</div></div>`;
  }
  if (!live && m.status !== "error") {
    h += `<div class="msg-actions"><button data-act="copy">Copy</button><button data-act="listen">${speaking === m.id ? "Stop" : "Listen"}</button>`;
    if (isLast) h += `<button data-act="retry">Retry</button>`;
    if (isLast && meta.route === "pi" && !(cfg.model || "").startsWith("pi:")) h += `<button class="switch-to" data-act="ask-pc">Ask the PC instead</button>`;
    if (meta.tps) h += `<span class="tps">${meta.tps} tok/s</span>`;
    h += `</div>`;
  }
  el.innerHTML = h;
  const tb = el.querySelector(".tb"); if (tb && live) tb.scrollTop = tb.scrollHeight;
}
function stageHTML(m) {
  const meta = m.meta || {};
  if (m.status === "waking") {
    const to = (st.status && st.status.pc.wake_timeout) || 150;
    const el = wakeElapsed(m);
    const title = el < 90 ? "Waking your PC…" : "Still waking, giving it a bit longer…";
    const sub = el < 90 ? "PCs can take a minute or two. I'll answer as soon as it's up." : "Some wakes are slow. Hang on.";
    return `<div class="wakecard">${orbHTML("waking", "mini-orb")}<div class="wake-text"><b>${title}</b><small><span class="wake-t" data-id="${m.id}">${mmss(el)}</span> of up to ${mmss(to)}. ${sub}</small>
      <div class="wakebar"><i style="width:${Math.min(100, el / to * 100)}%"></i></div></div></div>`;
  }
  const label = { queued: "Sending…", routing: "Choosing where to answer…", loading: "Loading " + short(m.model) + " on your PC…", thinking: "Thinking…" }[m.status] || "Working…";
  return `<div class="stage"><span class="shimmer">${esc(label)}</span></div>`;
}
const wakeBase = new Map();
function wakeElapsed(m) {
  const b = wakeBase.get(m.id);
  const meta = m.meta || {};
  if (meta.waking_elapsed != null && (!b || b.el !== meta.waking_elapsed)) wakeBase.set(m.id, { el: meta.waking_elapsed, at: Date.now() });
  const c = wakeBase.get(m.id);
  return c ? c.el + (Date.now() - c.at) / 1000 : 0;
}
setInterval(() => {
  $$(".wake-t").forEach(s => {
    const m = st.msgs.find(x => x.id === s.dataset.id); if (!m || m.status !== "waking") return;
    const el = wakeElapsed(m), to = (st.status && st.status.pc.wake_timeout) || 150;
    s.textContent = mmss(el);
    const bar = s.closest(".wakecard").querySelector(".wakebar i"); if (bar) bar.style.width = Math.min(100, el / to * 100) + "%";
    const b = s.closest(".wakecard").querySelector("b"); if (b) b.textContent = el < 90 ? "Waking your PC…" : "Still waking, giving it a bit longer…";
  });
}, 1000);

function updateMsg(m) {
  const el = $(`#messages .msg[data-id="${m.id}"]`);
  if (!el) return;
  fillMsg(el, m, st.msgs[st.msgs.length - 1] === m);
  scrollBottom();
}

let nearBottom = true;
$("#messages").addEventListener("scroll", () => { const e = $("#messages"); nearBottom = e.scrollHeight - e.scrollTop - e.clientHeight < 90; });
function scrollBottom(force) { if (force || nearBottom) { const e = $("#messages"); e.scrollTop = e.scrollHeight; } }

$("#messages").addEventListener("click", e => {
  const cp = e.target.closest(".cp"); if (cp) { copyText(cp.closest("pre").querySelector("code").textContent, cp); return; }
  const pr = e.target.closest("[data-preset]"); if (pr) { st.newPreset = pr.dataset.preset; renderChat(); return; }
  const idea = e.target.closest("[data-idea]"); if (idea) { $("#input").value = idea.dataset.idea; autosize(); $("#input").focus(); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const m = st.msgs.find(x => x.id === b.closest(".msg").dataset.id); if (!m) return;
  const a = b.dataset.act;
  if (a === "copy") copyText(parts(m).c, b);
  if (a === "listen") toggleSpeak(m);
  if (a === "retry") regenerate(m.model && m.meta && m.meta.route === "pc" ? m.model : cfg.model, m.meta && m.meta.error_code === "wake_failed" ? "yes" : "ask");
  if (a === "ask-pc") regenerate("pc", "yes");
  if (a === "ask-pi") { const pis = st.status.pi.models; regenerate(pis[0], "yes"); }
});

/* ------------------------------------------------------------------ streaming */
function attachStream(id) {
  if (st.streams.has(id)) return;
  const ac = new AbortController();
  st.streams.set(id, ac);
  (async () => {
    try {
      const r = await fetch(base() + "/hub/messages/" + id + "/stream", { headers: authH(), signal: ac.signal, cache: "no-store" });
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      let frame = 0;
      const paint = () => { frame = 0; const m = st.msgs.find(x => x.id === id); if (m) updateMsg(m); };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = chunk.split("\n").find(l => l.startsWith("data:"));
          if (!line) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
          let m = st.msgs.find(x => x.id === id);
          if (ev.t === "snapshot") {
            if (m) Object.assign(m, ev.msg); else if (st.chat && ev.msg.chat_id === st.chat.id) { st.msgs.push(ev.msg); renderChat(); }
          } else if (ev.t === "state" && m) {
            m.status = ev.status; m.meta = ev.meta; if (ev.model) m.model = ev.model;
          } else if (ev.t === "delta" && m) {
            m.content += ev.c || ""; m.reasoning = (m.reasoning || "") + (ev.r || "");
          } else if (ev.t === "end") {
            if (m && !FINAL.includes(m.status)) m.status = "done";
            if (m) { updateMsg(m); onAnswerDone(m); }
            setSending(); loadChats();
            return;
          }
          if (!frame) frame = requestAnimationFrame(paint);
        }
      }
    } catch (e) { /* stream dropped (app in background) — resumeChat() reattaches */ }
    finally { st.streams.delete(id); setSending(); }
  })();
}
function onAnswerDone(m) {
  if (cfg.autoSpeak && m.status === "done" && !document.hidden) speak(m);
}
function runningMsg() { return st.msgs.find(m => m.role === "assistant" && !FINAL.includes(m.status)); }

/* ------------------------------------------------------------------ sending */
// Ask the hub to answer. If the PC would have to wake up, ask first.
function askWake(r) {
  return new Promise(resolve => {
    const pc = short(r.model) || "your PC's model";
    let h = `<div class="grab"></div><h3>Your PC is asleep</h3>
      <p class="muted small" style="margin:-6px 0 12px">This one needs the bigger model on your PC. Waking it takes a minute or two.</p>` +
      opt("wake", "⚡", "Wake the PC and use " + pc, "Answers with the big model once the PC is up") +
      (r.pi ? opt("pi", "🍓", "No, ask the Pi instead", short(r.pi) + " answers right away. The PC keeps sleeping.") : "") +
      opt("cancel", "✕", "No, cancel", "Nothing is sent");
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    openSheet(h, e => { const b = e.target.closest("[data-opt]"); if (!b) return; closeSheet(); finish(b.dataset.opt); });
    const obs = new MutationObserver(() => { if (!$("#sheet").classList.contains("open")) { obs.disconnect(); finish("cancel"); } });
    obs.observe($("#sheet"), { attributes: true, attributeFilter: ["class"] });
  });
}
async function postSend(body) {
  let r = await api("/hub/chats/" + st.chat.id + "/send", { method: "POST", body: { ...body, wake: body.wake || "ask" }, timeout: 30000 });
  if (r && r.needs_wake) {
    const choice = await askWake(r);
    if (choice === "cancel") return null;
    const again = choice === "pi" ? { ...body, model: r.pi, wake: "yes" } : { ...body, model: body.model && body.model !== "auto" ? body.model : "pc", wake: "yes" };
    r = await api("/hub/chats/" + st.chat.id + "/send", { method: "POST", body: again, timeout: 30000 });
  }
  return r;
}

async function sendMessage() {
  const text = $("#input").value.trim();
  if ((!text && !st.pending.length) || runningMsg()) return;
  stopRec();
  const mi = modelInfo(cfg.model);
  if (st.pending.length && mi && mi.vision === false) { toast(short(cfg.model) + " can't see images. Pick another model."); return; }
  const images = st.pending.slice();
  let created = false;
  try {
    if (!st.chat) {
      st.chat = await api("/hub/chats", { method: "POST", body: { preset: st.newPreset } });
      st.msgs = []; created = true;
    }
    const body = { content: text, images, model: cfg.model || "auto" };
    $("#input").value = ""; autosize(); st.pending = []; renderPending();
    $("#send").disabled = true;
    const r = await postSend(body);
    if (!r) {   // cancelled: put the message back
      $("#input").value = text; st.pending = images; renderPending(); autosize();
      if (created) { api("/hub/chats/" + st.chat.id, { method: "DELETE" }).catch(() => {}); st.chat = null; renderChat(); }
      return;
    }
    if (r.user) st.msgs.push(r.user);
    st.msgs.push(r.assistant);
    if (!st.chat.title && text) st.chat.title = text.slice(0, 60);
    nearBottom = true;
    renderChat(); setSending();
    attachStream(r.assistant.id);
    history.replaceState(null, "", "?chat=" + st.chat.id);
    loadChats();
  } catch (e) {
    toast(e.status === 409 ? "Still answering — wait a moment." : "Couldn't send: " + e.message, 4000);
    if (text && !$("#input").value) { $("#input").value = text; autosize(); }
  }
}
async function regenerate(model, wake) {
  if (!st.chat || runningMsg()) return;
  try {
    const r = await postSend({ regenerate: true, model: model || "auto", wake: wake || "ask" });
    if (!r) return;
    if (st.msgs.length && st.msgs[st.msgs.length - 1].role === "assistant") st.msgs.pop();
    st.msgs.push(r.assistant);
    renderChat(); setSending(); attachStream(r.assistant.id);
  } catch (e) { toast(e.message); }
}
async function stopAnswer() {
  const m = runningMsg(); if (!m) return;
  try { await api("/hub/messages/" + m.id + "/stop", { method: "POST" }); } catch {}
}
function setSending() {
  const busy = !!runningMsg();
  const s = $("#send");
  s.classList.toggle("stop", busy);
  s.innerHTML = busy ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>' : icon("up", 'stroke-width="2.5"');
  s.setAttribute("aria-label", busy ? "Stop" : "Send");
  updateSend();
}
function updateSend() { $("#send").disabled = !runningMsg() && !$("#input").value.trim() && !st.pending.length; }
$("#send").onclick = () => (runningMsg() ? stopAnswer() : sendMessage());
$("#input").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !coarse && !e.isComposing) { e.preventDefault(); sendMessage(); } });
function autosize() { const i = $("#input"); i.style.height = "auto"; i.style.height = Math.min(i.scrollHeight, 180) + "px"; updateSend(); }
$("#input").addEventListener("input", autosize);

/* images */
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", .85);
  } finally { URL.revokeObjectURL(url); }
}
function renderPending() {
  const box = $("#attachments"); box.innerHTML = "";
  st.pending.forEach((src, i) => {
    const t = document.createElement("div"); t.className = "thumb";
    t.innerHTML = `<img alt="Photo to send"><button aria-label="Remove photo">×</button>`;
    t.firstChild.src = src; t.lastChild.onclick = () => { st.pending.splice(i, 1); renderPending(); };
    box.appendChild(t);
  });
  updateSend();
}
$("#attachBtn").onclick = () => {
  const mi = modelInfo(cfg.model);
  if (mi && mi.vision === false) { toast(short(cfg.model) + " can't see images. Tap the model pill to pick a Vision model."); return; }
  $("#fileInput").click();
};
$("#fileInput").onchange = async e => {
  const files = [...e.target.files].slice(0, 4 - st.pending.length); e.target.value = "";
  for (const f of files) { try { st.pending.push(await shrink(f)); } catch { toast("Couldn't read that image."); } }
  renderPending();
};

/* ------------------------------------------------------------------ models */
function allModels() {
  const s = st.status; if (!s) return [];
  return [...(s.pc.models || []), ...(s.pi.models || []).map(id => ({ id, name: short(id), where: "pi", loaded: true, vision: false }))];
}
function modelInfo(id) {
  if (!id || id === "auto") return null;
  if (id === "pc") return null;
  return allModels().find(m => m.id === id) || null;
}
function updateModelPill() {
  const t = $("#modelPillText");
  if (!cfg.model || cfg.model === "auto") t.textContent = st.status && !st.status.settings.smart_routing ? "PC (default)" : "Auto";
  else t.textContent = (cfg.model.startsWith("pi:") ? "Pi: " : "") + short(cfg.model);
}
$("#modelPill").onclick = () => openModelSheet();
function openModelSheet() {
  const s = st.status;
  const smart = !s || s.settings.smart_routing;
  let h = `<div class="grab"></div><h3>Who answers?</h3>`;
  h += opt("auto", smart ? "✨" : "🖥️", smart ? "Auto (smart routing)" : "Your PC (default model)", smart ? "Quick questions go to the Pi instantly. Bigger ones wake your PC." : "Uses the PC's loaded or default model.", cfg.model === "auto" || !cfg.model);
  const pcs = s ? s.pc.models : [];
  if (pcs.length) {
    h += `<div class="opt-group">Your PC</div>`;
    pcs.forEach(m => h += opt(m.id, "🖥️", m.name || short(m.id), [m.params, m.size ? fmtBytes(m.size) : "", m.loaded ? "loaded" : "", m.vision ? "sees images" : ""].filter(Boolean).join(", "), cfg.model === m.id));
  }
  const pis = s ? s.pi.models : [];
  if (pis.length) {
    h += `<div class="opt-group">Raspberry Pi (always on, small)</div>`;
    pis.forEach(id => h += opt(id, "🍓", short(id), "Answers even when the PC sleeps", cfg.model === id));
  }
  if (!s) h += `<p class="hint">Can't reach the Pi right now.</p>`;
  h += `<p class="hint">Load or unload PC models in the PC tab.</p>`;
  openSheet(h, e => {
    const b = e.target.closest("[data-opt]"); if (!b) return;
    cfg.model = b.dataset.opt; saveCfg(); updateModelPill(); closeSheet();
    const mi = modelInfo(cfg.model);
    toast(cfg.model === "auto" ? "Auto: the hub picks" : mi && mi.where === "pc" && !mi.loaded ? short(cfg.model) + " loads when you send a message" : "Using " + short(cfg.model));
  });
}
function opt(id, ic, title, sub, on, extraCls = "") {
  return `<button class="opt ${on ? "on" : ""} ${extraCls}" data-opt="${esc(id)}"><span class="oi">${ic}</span><span class="ot"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${on ? icon("check", 'style="width:18px;height:18px;color:var(--violet)"') : ""}</button>`;
}

/* presets pill */
$("#presetPill").onclick = () => {
  const cur = st.chat ? st.chat.preset : st.newPreset;
  let h = `<div class="grab"></div><h3>Preset</h3>`;
  st.presets.forEach(p => h += opt(p.id, p.icon || "✨", p.name, (p.system || "").slice(0, 90) + ((p.system || "").length > 90 ? "…" : ""), p.id === cur));
  h += `<p class="hint">Edit presets in Settings.</p>`;
  openSheet(h, async e => {
    const b = e.target.closest("[data-opt]"); if (!b) return;
    closeSheet();
    if (st.chat) { st.chat.preset = b.dataset.opt; try { await api("/hub/chats/" + st.chat.id, { method: "PATCH", body: { preset: b.dataset.opt } }); } catch {} }
    else st.newPreset = b.dataset.opt;
    renderChat();
  });
};

/* ------------------------------------------------------------------ sheets */
let sheetHandler = null;
function openSheet(html, onClick) {
  $("#sheetCard").innerHTML = html; sheetHandler = onClick;
  $("#sheet").classList.add("open");
}
function closeSheet() { $("#sheet").classList.remove("open"); sheetHandler = null; }
$("#sheet").addEventListener("click", e => {
  if (e.target.id === "sheet" || e.target.closest("[data-close]")) { closeSheet(); return; }
  if (sheetHandler) sheetHandler(e);
});

/* ------------------------------------------------------------------ voice in */
let rec = null, recorder = null, recStream = null, recTimer = null;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function stopRec() {
  if (rec) { try { rec.stop(); } catch {} }
  if (recorder && recorder.state === "recording") recorder.stop();
}
$("#micBtn").onclick = async () => {
  if (rec || (recorder && recorder.state === "recording")) { stopRec(); return; }
  const usePi = cfg.voice !== "apple" && st.status && st.status.pi.voice && navigator.mediaDevices && window.MediaRecorder;
  if (usePi) return recordForPi();
  if (!SR) { toast("Use the 🎤 on your keyboard, or install private voice on the Pi (Settings).", 4200); return; }
  try {
    const r = new SR(); r.lang = navigator.language || "en-GB"; r.interimResults = true; r.continuous = true;
    const before = $("#input").value.trim();
    r.onresult = e => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; $("#input").value = (before ? before + " " : "") + t.trim(); autosize(); };
    r.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Voice typing is blocked here. Use the 🎤 on your keyboard.", 4000); };
    r.onend = () => { rec = null; $("#micBtn").classList.remove("rec"); $("#recBar").classList.add("hidden"); };
    r.start(); rec = r; $("#micBtn").classList.add("rec");
    $("#recText").textContent = "Listening (Apple dictation)… tap the mic to stop"; $("#recBar").classList.remove("hidden");
  } catch { toast("Couldn't start voice typing."); }
};
async function recordForPi() {
  try { recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast("Microphone permission was denied."); return; }
  const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
  const chunks = [];
  recorder = new MediaRecorder(recStream, type ? { mimeType: type } : undefined);
  recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
  const t0 = Date.now();
  $("#micBtn").classList.add("rec"); $("#recBar").classList.remove("hidden");
  recTimer = setInterval(() => { const s = (Date.now() - t0) / 1000; $("#recText").textContent = "Recording " + mmss(s) + " (private, on your Pi). Tap the mic to stop"; if (s > 120) stopRec(); }, 250);
  recorder.onstop = async () => {
    clearInterval(recTimer); recStream.getTracks().forEach(t => t.stop());
    $("#micBtn").classList.remove("rec");
    $("#recText").textContent = "Transcribing on your Pi…";
    try {
      const blob = new Blob(chunks, { type: recorder.mimeType || type || "audio/mp4" });
      const r = await fetch(base() + "/hub/voice", { method: "POST", headers: { ...authH(), "Content-Type": blob.type || "application/octet-stream" }, body: blob });
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || "Error");
      if (j.text) { const i = $("#input"); i.value = (i.value.trim() ? i.value.trim() + " " : "") + j.text; autosize(); i.focus(); }
      else toast("I didn't catch anything.");
    } catch (e) { toast("Transcription failed: " + e.message); }
    $("#recBar").classList.add("hidden"); recorder = null;
  };
  recorder.start();
}

/* voice out */
let speaking = null;
const speakable = t => t.replace(/```[\s\S]*?(```|$)/g, " (code block) ").replace(/`([^`]+)`/g, "$1").replace(/[*_#>|]+/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
function stopSpeaking() { if ("speechSynthesis" in window) speechSynthesis.cancel(); const was = speaking; speaking = null; const m = st.msgs.find(x => x.id === was); if (m) updateMsg(m); }
function speak(m) {
  if (!("speechSynthesis" in window)) { toast("Read-aloud isn't supported here."); return; }
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(speakable(parts(m).c)); u.lang = navigator.language || "en-GB";
  u.onend = u.onerror = () => { if (speaking === m.id) { speaking = null; updateMsg(m); } };
  speaking = m.id; updateMsg(m); speechSynthesis.speak(u);
}
function toggleSpeak(m) { if (speaking === m.id) stopSpeaking(); else speak(m); }

/* ------------------------------------------------------------------ PC tab */
function renderPC() {
  const s = st.status, i = pcInfo();
  const orb = $("#pcOrb");
  orb.className = "orb " + i.cls;
  $("#pcState").textContent = st.online ? (i.cls === "awake" ? "Your PC is awake" : i.cls === "asleep" ? "Your PC is asleep" : i.title) : "Can't reach your Pi";
  let sub = i.sub;
  if (st.online && i.cls === "awake" && s.pc.awake_seconds != null) sub = "Awake for " + fmtDur(s.pc.awake_seconds) + (s.pc.agent_info && s.pc.agent_info.idle < 120 ? ", someone's at the desk" : "");
  else if (st.online && i.cls === "awake" && !s.pc.agent) sub = "The PC helper isn't connected, so stats and power buttons are off.";
  $("#pcSub").textContent = sub || " ";
  // power row
  const pw = $("#pcPower");
  if (st.online && (i.cls === "awake" || i.cls === "lmoff")) {
    pw.innerHTML = `<button class="btn sm" data-power="sleep">${icon("moon")}Sleep</button><button class="btn sm" data-power="lock">${icon("lock")}Lock</button><button class="btn sm" data-power="restart">${icon("restart")}Restart</button>`;
  } else if (st.online && i.cls === "asleep") {
    pw.innerHTML = `<button class="btn primary" data-power="wake">${icon("power")}Wake PC</button>`;
  } else pw.innerHTML = "";
  $("#pcBadge").classList.toggle("hidden", !(st.online && i.cls === "waking"));
  if (!st.online) { ["#shortcuts", "#stats", "#modelsCard", "#piStats", "#resultsCard"].forEach(x => $(x).innerHTML = `<div class="card faint small">Waiting for the Pi…</div>`); $("#gameCard").innerHTML = ""; return; }

  // game mode
  const gm = s.game_mode;
  const gc = $("#gameCard"); gc.classList.toggle("on", gm);
  gc.innerHTML = `<div class="gicon">🎮</div><div class="tx"><b>Game mode</b><small>${gm ? "AI models are unloaded so your GPU is all yours. Auto answers go to the Pi." : "Unloads the AI models to free your RTX 3070 before you play."}</small></div>
    <label class="switch"><input type="checkbox" id="gameToggle" ${gm ? "checked" : ""} aria-label="Game mode"><span></span></label>`;
  $("#gameToggle").onchange = async e => { try { await api("/hub/game", { method: "POST", body: { on: e.target.checked } }); toast(e.target.checked ? "Game mode on. Have fun 🎮" : "Game mode off"); } catch (er) { toast(er.message); } pollSoon(); };

  // shortcuts
  const acts = s.pc.actions || [];
  $("#shortcutsNote").textContent = s.pc.actions_error ? "" : acts.length ? "Wakes the PC first if needed" : "";
  if (s.pc.actions_error) $("#shortcuts").innerHTML = `<div class="card badline">${esc(s.pc.actions_error)}</div>`;
  else if (!acts.length) $("#shortcuts").innerHTML = `<div class="card faint small">${s.pc.agent ? "No shortcuts yet. Add them in C:\\HomeAI\\actions.json on your PC." : "Shortcuts show up here once the PC helper has connected (wake the PC once)."}</div>`;
  else $("#shortcuts").innerHTML = `<div class="shortcuts">${acts.map(a => `<button class="shortcut ${st.busyAction === a.id ? "busy" : ""}" data-action="${esc(a.id)}"><span class="ic">${esc(a.icon || "▶️")}</span><b>${esc(a.name)}</b><small>${esc(a.description || "")}</small></button>`).join("")}</div>`;

  // open apps
  const apps = s.pc.apps || [];
  $("#appsNote").textContent = apps.length ? apps.length + " open" : "";
  $("#appsCard").innerHTML = !s.pc.agent ? `<div class="faint small">${i.cls === "awake" ? "Waiting for the PC helper…" : "Shows what's open while the PC is awake."}</div>`
    : !apps.length ? `<div class="faint small">No apps open.</div>`
    : apps.map(a => `<div class="mrow"><span class="appic">${appIcon(a)}</span><div class="mn"><b>${esc(a.name)}</b><small class="title">${esc(a.title)}</small></div>
        <button class="btn sm" data-app-close="${esc(a.pid)}">Close</button></div>`).join("");

  // stats
  const mt = s.pc.metrics;
  if (!mt) $("#stats").innerHTML = `<div class="card faint small">${i.cls === "awake" ? "Waiting for the PC helper…" : "Live stats appear while the PC is awake."}</div>`;
  else {
    const g = (mt.gpus || [])[0];
    const hist = s.pc.hist || [];
    let h = `<div class="stats">`;
    if (g) {
      h += `<div class="stat"><div class="k"><span>GPU temp</span></div><div class="v">${g.temp != null ? Math.round(g.temp) : "—"}<small>°C</small></div>${spark(hist.map(x => x.gpu_temp), 30, 90, g.temp > 80)}</div>`;
      h += `<div class="stat"><div class="k"><span>GPU load</span></div><div class="v">${g.util != null ? Math.round(g.util) : "—"}<small>%</small></div>${spark(hist.map(x => x.gpu), 0, 100)}</div>`;
      const vp = g.mem_total ? g.mem_used / g.mem_total * 100 : 0;
      h += `<div class="stat wide"><div class="k"><span>VRAM</span><span>${fmtBytes(g.mem_used)} of ${fmtBytes(g.mem_total)}</span></div><div class="bar ${vp > 92 ? "hot" : ""}"><i style="width:${vp}%"></i></div><div class="sub">${esc(g.name || "")}${g.power != null ? ", drawing " + Math.round(g.power) + " W" : ""}</div></div>`;
    }
    h += `<div class="stat"><div class="k"><span>CPU</span></div><div class="v">${mt.cpu != null ? mt.cpu : "—"}<small>%</small></div>${spark(hist.map(x => x.cpu), 0, 100)}</div>`;
    const rp = mt.ram_total ? mt.ram_used / mt.ram_total * 100 : 0;
    h += `<div class="stat"><div class="k"><span>RAM</span></div><div class="v">${Math.round(rp)}<small>%</small></div><div class="sub">${fmtBytes(mt.ram_used)} of ${fmtBytes(mt.ram_total)}</div>${spark(hist.map(x => x.ram), 0, 100)}</div>`;
    if (mt.disks && mt.disks.length) {
      h += `<div class="stat wide">${mt.disks.map(d => { const up = d.total ? (d.total - d.free) / d.total * 100 : 0; return `<div class="disk"><div class="spread"><span>${esc(d.name)} ${esc(d.label || "")}</span><span class="faint">${fmtBytes(d.free)} free</span></div><div class="bar ${up > 92 ? "hot" : ""}"><i style="width:${up}%"></i></div></div>`; }).join("")}</div>`;
    }
    h += `</div>`;
    $("#stats").innerHTML = h;
  }
  $("#statsNote").textContent = s.pc.last_tps ? "Last answer: " + s.pc.last_tps + " tok/s" : "";

  // models
  const models = s.pc.models || [], busy = s.pc.model_busy;
  $("#modelsNote").textContent = busy ? (busy.op === "load" ? "Loading " : "Unloading ") + short(busy.id) + "…" : "";
  if (!models.length) $("#modelsCard").innerHTML = `<div class="faint small">${i.cls === "awake" ? "No models found in LM Studio." : "Wake the PC once to see its models."}</div>`;
  else $("#modelsCard").innerHTML = [...models].sort((a, b) => b.loaded - a.loaded).map(m => `<div class="mrow"><div class="mn"><b>${esc(m.name || short(m.id))}${m.loaded ? '<span class="tag on">Loaded</span>' : ""}${m.vision ? '<span class="tag vis">Vision</span>' : ""}</b><small>${esc([m.params, m.size ? fmtBytes(m.size) : ""].filter(Boolean).join(", ") || m.id)}</small></div>
    <button class="btn sm ${m.loaded ? "" : "primary"}" data-model-op="${m.loaded ? "unload" : "load"}" data-id="${esc(m.id)}" ${busy ? "disabled" : ""}>${busy && busy.id === m.id ? (busy.op === "load" ? "Loading…" : "Unloading…") : m.loaded ? "Unload" : "Load"}</button></div>`).join("") +
    `<p class="hint">Loading a model unloads the others first, so your VRAM doesn't run out.</p>`;

  // pi
  const ps = s.pi.stats || {};
  $("#piStats").innerHTML = `<div class="stats">
    <div class="stat"><div class="k"><span>Pi temp</span></div><div class="v">${ps.temp != null ? Math.round(ps.temp) : "—"}<small>°C</small></div></div>
    <div class="stat"><div class="k"><span>Pi RAM</span></div><div class="v">${ps.ram_total ? Math.round(ps.ram_used / ps.ram_total * 100) : "—"}<small>%</small></div><div class="sub">${fmtBytes(ps.ram_used)} of ${fmtBytes(ps.ram_total)}</div></div>
    <div class="stat wide"><div class="k"><span>Up for ${ps.uptime ? fmtDur(ps.uptime) : "—"}</span><span>${ps.disk_total ? fmtBytes(ps.disk_total - ps.disk_used) + " free" : ""}</span></div>
      <div class="sub">Models: ${(s.pi.models || []).map(short).join(", ") || "none"}. Voice: ${s.pi.voice ? "installed" : "not installed"}. Notifications: ${s.pi.push ? "ready" : "off"}.</div></div></div>`;

  // results
  const res = s.results || [];
  $("#resultsCard").innerHTML = res.length ? res.map(r => `<div class="r"><span class="${r.ok ? "ok" : "bad"}">${r.ok ? "✓" : "✕"}</span><span>${esc(r.name)}${r.message ? ` <span class="faint">${esc(r.message)}</span>` : ""}</span><span class="tm">${ago(r.at)}</span></div>`).join("") : `<div class="faint small">Nothing yet.</div>`;
}
const APP_ICONS = { robloxstudiobeta: "🧱", robloxplayerbeta: "🎮", claude: "✳️", chrome: "🌐", msedge: "🌐", firefox: "🦊", opera: "🌐", brave: "🦁",
  code: "🧑‍💻", explorer: "📁", spotify: "🎵", discord: "💬", steam: "🎮", "lm studio": "🧠", windowsterminal: "⌨️", powershell: "⌨️", cmd: "⌨️",
  notepad: "📝", whatsapp: "💬", obs64: "🎥", photoshop: "🎨", "adobe premiere pro": "🎬", arduino: "🔌", "arduino ide": "🔌", blender: "🧊", vlc: "🎞️" };
function appIcon(a) { return APP_ICONS[(a.proc || "").toLowerCase()] || APP_ICONS[(a.name || "").toLowerCase()] || "🪟"; }

function spark(vals, lo, hi, hot) {
  const v = vals.filter(x => x != null);
  if (v.length < 3) return "";
  const n = vals.length, W = 100, H = 30;
  const pts = vals.map((x, i) => x == null ? null : [i / (n - 1) * W, H - (Math.max(lo, Math.min(hi, x)) - lo) / (hi - lo) * (H - 4) - 2]).filter(Boolean);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const col = hot ? "var(--coral)" : "var(--cyan)";
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}

$("#pcPage").addEventListener("click", async e => {
  const pw = e.target.closest("[data-power]");
  if (pw) return power(pw.dataset.power);
  const sc = e.target.closest("[data-action]");
  if (sc) {
    st.busyAction = sc.dataset.action; renderPC();
    try {
      const r = await api("/hub/pc/action", { method: "POST", body: { id: sc.dataset.action } });
      toast(r.waking ? "Waking your PC, then running it…" : "Sent to your PC");
    } catch (er) { toast(er.message); }
    setTimeout(() => { st.busyAction = null; renderPC(); }, 3000);
    pollSoon(); return;
  }
  const ac = e.target.closest("[data-app-close]");
  if (ac) {
    const app = ((st.status && st.status.pc.apps) || []).find(a => String(a.pid) === ac.dataset.appClose);
    if (!app) return;
    openSheet(`<div class="grab"></div><h3>Close ${esc(app.name)}?</h3><p class="muted small" style="margin:-6px 0 12px">${esc(app.title)}</p>` +
      opt("close", "👋", "Close", "Like clicking the X. If there's unsaved work, it may wait for you on the PC.") +
      opt("force", "⛔", "Force close", "Closes it immediately. Unsaved work is lost.", false, "danger") +
      `<button class="btn" data-close style="width:100%;margin-top:10px">Cancel</button>`,
      async ev => {
        const b = ev.target.closest("[data-opt]"); if (!b) return; closeSheet();
        try { await api("/hub/pc/app/close", { method: "POST", body: { pid: app.pid, force: b.dataset.opt === "force" } }); toast(b.dataset.opt === "force" ? "Force-closing " + app.name : "Closing " + app.name); }
        catch (er) { toast(er.message); }
        setTimeout(pollSoon, 6000);
      });
    return;
  }
  const mo = e.target.closest("[data-model-op]");
  if (mo) {
    try { await api("/hub/models", { method: "POST", body: { op: mo.dataset.modelOp, id: mo.dataset.id } }); toast(mo.dataset.modelOp === "load" ? "Loading… big models take up to a minute" : "Unloading…"); }
    catch (er) { toast(er.message); }
    pollSoon(); return;
  }
  const sd = e.target.closest("[data-sched]");
  if (sd) {
    const id = sd.dataset.id;
    if (sd.dataset.sched === "del") { await api("/hub/schedules/" + id, { method: "DELETE" }).catch(() => {}); }
    else { try { await api("/hub/schedules/" + id, { method: "PATCH", body: { enabled: sd.checked } }); } catch (er) { toast(er.message); } }
    loadSchedules();
  }
});
$("#orbBtn").onclick = () => {
  const i = pcInfo();
  if (!st.online) return poll();
  if (i.cls === "asleep") return power("wake");
  if (i.cls === "waking") { toast("Already waking — hang on"); return; }
  openSheet(`<div class="grab"></div><h3>Your PC</h3>` +
    opt("sleep", "🌙", "Sleep", "Comes back with everything still open. The Pi can wake it.") +
    opt("lock", "🔒", "Lock", "Locks the screen. Apps keep running.") +
    opt("restart", "🔁", "Restart", "After a restart the PC sits at the login screen until you log in.") +
    `<button class="btn" data-close style="width:100%;margin-top:10px">Cancel</button>`,
    e => { const b = e.target.closest("[data-opt]"); if (b) { closeSheet(); power(b.dataset.opt); } });
};
$("#pcRefresh").onclick = () => { poll(); loadSchedules(); };
async function power(a) {
  if (a === "restart" && !confirm("Restart your PC? It'll stop at the login screen until someone logs in.")) return;
  try {
    await api("/hub/pc/power", { method: "POST", body: { action: a } });
    toast({ wake: "Waking your PC… this can take a minute or two", sleep: "Your PC is going to sleep 💤", lock: "Locked 🔒", restart: "Restarting…" }[a]);
  } catch (e) { toast(e.message, 4500); }
  pollSoon();
}

/* schedules */
async function loadSchedules() {
  try { st.schedules = await api("/hub/schedules"); } catch { st.schedules = []; }
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const actName = s => s.action === "wake" ? "Wake PC" : s.action === "sleep" ? "Sleep PC" : "Run " + (((st.status && st.status.pc.actions) || []).find(a => a.id === s.action_id) || { name: s.action_id }).name;
  const desc = s => s.kind === "once" ? (s.next ? new Date(s.next * 1000).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "Done") :
    (s.days.length === 7 ? "Every day" : s.days.length === 5 && s.days.every(d => d < 5) ? "Weekdays" : s.days.slice().sort().map(d => DAYS[d]).join(", "));
  $("#schedCard").innerHTML = st.schedules.length ? st.schedules.map(s => `<div class="sched ${s.enabled ? "" : "off"}">
      <div class="when">${s.kind === "once" ? (s.at ? clock(s.at) : "—") : esc(s.time)}</div>
      <div class="tx"><b>${esc(s.label || actName(s))}</b><small>${esc(desc(s))}${s.label ? ", " + esc(actName(s)) : ""}</small></div>
      <label class="switch"><input type="checkbox" data-sched="toggle" data-id="${s.id}" ${s.enabled ? "checked" : ""} aria-label="On or off"><span></span></label>
      <button class="ibtn" data-sched="del" data-id="${s.id}" aria-label="Delete">${icon("trash", 'width="18" height="18"')}</button></div>`).join("")
    : `<div class="faint small">Nothing scheduled. Add a wake-up for when your tokens reset, or every school morning.</div>`;
}
$("#addSchedule").onclick = () => {
  const acts = (st.status && st.status.pc.actions) || [];
  const sched = { mode: "once", plus: 60, action: "wake", days: [0, 1, 2, 3, 4] };
  const render = () => {
    let h = `<div class="grab"></div><h3>Schedule</h3>
      <div class="field"><span class="label">What</span><div class="chips">
        <button class="chip ${sched.action === "wake" ? "on" : ""}" data-s-action="wake">Wake PC</button>
        ${acts.map(a => `<button class="chip ${sched.action === "action:" + a.id ? "on" : ""}" data-s-action="action:${esc(a.id)}">${esc(a.icon || "")} ${esc(a.name)}</button>`).join("")}
        <button class="chip ${sched.action === "sleep" ? "on" : ""}" data-s-action="sleep">Sleep PC</button></div></div>
      <div class="field"><span class="label">When</span><div class="seg"><button class="${sched.mode === "once" ? "on" : ""}" data-s-mode="once">Once</button><button class="${sched.mode === "repeat" ? "on" : ""}" data-s-mode="repeat">Repeat</button></div></div>`;
    if (sched.mode === "once") {
      h += `<div class="field"><div class="chips">${[30, 60, 120, 180].map(m => `<button class="chip ${sched.plus === m ? "on" : ""}" data-s-plus="${m}">In ${m < 60 ? m + " min" : m / 60 + " h"}</button>`).join("")}
        <button class="chip ${sched.plus === 0 ? "on" : ""}" data-s-plus="0">Pick a time</button></div></div>`;
      if (sched.plus === 0) h += `<div class="field"><input type="datetime-local" id="sAt" class="input"></div>`;
      else h += `<p class="hint">At ${new Date(Date.now() + sched.plus * 60000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.</p>`;
    } else {
      h += `<div class="field"><input type="time" id="sTime" class="input" value="07:30"></div>
        <div class="field"><div class="days">${["M", "T", "W", "T", "F", "S", "S"].map((d, i) => `<button class="${sched.days.includes(i) ? "on" : ""}" data-s-day="${i}" aria-label="Day ${i + 1}">${d}</button>`).join("")}</div></div>`;
    }
    h += `<div class="field"><label class="label" for="sLabel">Name (optional)</label><input id="sLabel" class="input" placeholder="Tokens reset"></div>
      <button class="btn primary" id="sSave" style="width:100%">Save schedule</button>`;
    const keep = { at: $("#sAt") && $("#sAt").value, time: $("#sTime") && $("#sTime").value, label: $("#sLabel") && $("#sLabel").value };
    $("#sheetCard").innerHTML = h;
    if (keep.at && $("#sAt")) $("#sAt").value = keep.at;
    if (keep.time && $("#sTime")) $("#sTime").value = keep.time;
    if (keep.label) $("#sLabel").value = keep.label;
  };
  openSheet("", async e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.sAction) { sched.action = t.dataset.sAction; render(); }
    else if (t.dataset.sMode) { sched.mode = t.dataset.sMode; render(); }
    else if (t.dataset.sPlus != null) { sched.plus = +t.dataset.sPlus; render(); }
    else if (t.dataset.sDay != null) { const d = +t.dataset.sDay; sched.days = sched.days.includes(d) ? sched.days.filter(x => x !== d) : [...sched.days, d]; render(); }
    else if (t.id === "sSave") {
      const body = { label: $("#sLabel").value.trim(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
      if (sched.action.startsWith("action:")) { body.action = "action"; body.action_id = sched.action.slice(7); } else body.action = sched.action;
      if (sched.mode === "once") {
        if (sched.plus) body.at = Date.now() / 1000 + sched.plus * 60;
        else { const v = $("#sAt").value; if (!v) { toast("Pick a date and time"); return; } body.at = new Date(v).getTime() / 1000; }
      } else {
        body.time = $("#sTime").value; body.days = sched.days;
        if (!body.time || !sched.days.length) { toast("Pick a time and at least one day"); return; }
      }
      try { await api("/hub/schedules", { method: "POST", body }); closeSheet(); toast("Scheduled ⏰"); loadSchedules(); }
      catch (er) { toast(er.message); }
    }
  });
  render();
};

/* ------------------------------------------------------------------ Home tab */
async function loadHome() {
  try { st.home = await api("/hub/home"); } catch { st.home = null; }
  renderHome();
}
$("#homeRefresh").onclick = loadHome;
function renderHome() {
  const hm = st.home, devs = (hm && hm.devices) || [];
  let h = "";
  if (!devs.length) h += `<div class="section" style="margin-top:12px"><div class="wip-banner"><div class="ic">🛠️</div><div><b>Work in progress</b>
    <p>Your Pi is already listening for ESP32 devices. As soon as your weather station or a sensor reports in, it shows up here live. Nothing is connected yet.</p></div></div></div>`;
  if (devs.length) {
    h += `<div class="section" style="margin-top:12px"><h2>Devices</h2><div class="devices">` + devs.map(d => {
      const icn = { weather: "🌦️", relay: "💡", sensor: "📟" }[d.kind] || "📟";
      const rd = Object.entries(d.readings || {}).map(([k, v]) => `<div class="reading"><div class="k">${esc(k)}</div><div class="v">${typeof v === "number" ? (Math.round(v * 10) / 10) : esc(v)}<small>${esc((d.units || {})[k] || "")}</small></div></div>`).join("");
      const rl = Object.keys(d.relays || {}).map(r => { const on = r in (d.desired || {}) ? d.desired[r] : d.relays[r]; return `<div class="relay"><span>${esc(r)}</span><label class="switch"><input type="checkbox" data-relay="${esc(r)}" data-dev="${esc(d.id)}" ${on ? "checked" : ""} aria-label="${esc(r)}"><span></span></label></div>`; }).join("");
      return `<div class="device"><div class="dh"><span class="ic">${icn}</span><b>${esc(d.name)}</b><span class="dot ${d.online ? "awake" : "off"}" title="${d.online ? "Online" : "Offline"}"></span></div>
        <div class="readings">${rd || '<span class="faint small">No readings</span>'}</div>${rl}<div class="hint">Last seen ${ago(d.updated)}</div></div>`;
    }).join("") + `</div></div>`;
  }
  const planned = [
    ["🌦️", "Weather station", ["Outside", "°C"], ["Humidity", "%"], ["Pressure", "hPa"], ["Rain", "mm"]],
    ["🛏️", "Room", ["Temperature", "°C"], ["Humidity", "%"], ["Light", "lx"], ["Noise", "dB"]],
  ];
  const have = new Set(devs.map(d => d.kind));
  const todo = planned.filter(p => !(p[1] === "Weather station" && have.has("weather")));
  if (todo.length) {
    h += `<div class="section"><h2>Planned <small>not running yet</small></h2><div class="devices">` + todo.map(p => `<div class="device planned"><div class="dh"><span class="ic">${p[0]}</span><b>${p[1]}</b><span class="tag wip">In progress</span></div>
      <div class="readings">${p.slice(2).map(([k, u]) => `<div class="reading"><div class="k">${k}</div><div class="v">--<small>${u}</small></div></div>`).join("")}</div></div>`).join("") +
      `<div class="device planned"><div class="dh"><span class="ic">💡</span><b>Switches</b><span class="tag wip">In progress</span></div><p class="faint small" style="margin:0">Relays on your ESP32s (desk lamp, fan, heater) will get on/off switches here.</p></div></div></div>`;
  }
  if (hm) h += `<div class="section"><h2>Connect a device</h2><div class="card"><dl class="kv">
      <dt>Address</dt><dd>http://${esc(hm.ip || "PI-IP")}:${esc(hm.port)}/home/report</dd>
      <dt>Device key</dt><dd>${esc(hm.device_key || "(none)")}</dd></dl>
      <p class="hint">Your ESP32 sends a small JSON report every 30 seconds (readings and relay states) and gets back what the relays should be. There's a ready-to-flash example in the files: <a href="/pi/esp32/home_device.ino" target="_blank" rel="noopener">home_device.ino</a>.</p></div></div>`;
  else h += `<div class="section"><div class="card faint small">Can't reach the Pi.</div></div>`;
  $("#homePage").innerHTML = h;
}
$("#homePage").addEventListener("change", async e => {
  const r = e.target.closest("[data-relay]"); if (!r) return;
  try { await api("/hub/home/relay", { method: "POST", body: { device: r.dataset.dev, relay: r.dataset.relay, on: r.checked } }); toast("Sent. The device picks it up on its next check-in."); }
  catch (er) { toast(er.message); }
});

/* ------------------------------------------------------------------ Send tab */
async function loadDrops() {
  try { st.drops = await api("/hub/drops"); } catch { st.drops = []; }
  renderDrops();
}
$("#sendRefresh").onclick = loadDrops;
function renderDrops() {
  const list = st.drops;
  $("#dropList").innerHTML = list.length ? list.map(d => {
    const out = d.dir === "to_pc";
    const file = d.kind === "file";
    const url = base() + "/hub/drops/" + d.id + "/file";
    const status = out ? (d.delivered ? "Delivered" : '<span class="wait">Waiting for the PC</span>') : "From your PC";
    return `<div class="drop"><div class="dir ${out ? "out" : "in"}">${icon(out ? "up" : "down")}</div><div class="body">
      ${file ? `<div class="fname">${esc(d.filename)}</div>${(d.mime || "").startsWith("image/") && !out ? `<img class="prev" src="${esc(url)}" alt="">` : ""}` : `<div class="text">${esc(d.text)}</div>`}
      <div class="meta">${status}, ${ago(d.created)}${file ? ", " + fmtBytes(d.size) : ""}</div></div>
      <div class="acts">${file ? (out ? "" : `<a href="${esc(url)}" target="_blank" rel="noopener">Open</a>`) : `<button data-copy="${d.id}">Copy</button>`}<button data-del="${d.id}" aria-label="Delete">${icon("x", 'width="15" height="15"')}</button></div></div>`;
  }).join("") : `<div class="faint small">Nothing sent yet. Links, text, photos and files show up here, both ways.</div>`;
}
$("#dropList").addEventListener("click", async e => {
  const c = e.target.closest("[data-copy]"); if (c) { const d = st.drops.find(x => x.id === c.dataset.copy); if (d) copyText(d.text, c); return; }
  const d = e.target.closest("[data-del]"); if (d) { await api("/hub/drops/" + d.dataset.del, { method: "DELETE" }).catch(() => {}); loadDrops(); }
});
$("#dropSend").onclick = async () => {
  const text = $("#dropText").value.trim(); if (!text) { toast("Type or paste something first"); return; }
  try { await api("/hub/drops", { method: "POST", body: { text, wake: $("#dropWake").checked } }); $("#dropText").value = ""; toast(isPcAwake() ? "Sent. It's on your PC's clipboard in a few seconds." : "Saved. It'll arrive when your PC wakes."); loadDrops(); }
  catch (e) { toast(e.message); }
};
const isPcAwake = () => st.status && st.status.pc.state === "awake" && st.status.pc.agent;
$("#dropFileBtn").onclick = () => $("#dropFile").click();
$("#dropFile").onchange = async e => {
  const files = [...e.target.files]; e.target.value = "";
  for (const f of files) {
    const bar = $("#upbar"); bar.classList.remove("hidden"); bar.firstChild.style.width = "0";
    try {
      await new Promise((res, rej) => {
        const x = new XMLHttpRequest();
        x.open("POST", base() + "/hub/drops");
        Object.entries(authH()).forEach(([k, v]) => x.setRequestHeader(k, v));
        x.setRequestHeader("Content-Type", f.type || "application/octet-stream");
        x.setRequestHeader("X-Filename", encodeURIComponent(f.name));
        if ($("#dropWake").checked) x.setRequestHeader("X-Wake", "1");
        x.upload.onprogress = ev => { if (ev.lengthComputable) bar.firstChild.style.width = (ev.loaded / ev.total * 100) + "%"; };
        x.onload = () => (x.status < 300 ? res() : rej(new Error("Upload failed (" + x.status + ")")));
        x.onerror = () => rej(new Error("Upload failed"));
        x.send(f);
      });
      toast("Sent " + f.name);
    } catch (er) { toast(er.message); }
    bar.classList.add("hidden");
  }
  loadDrops();
};
$("#getClip").onclick = async () => {
  try { await api("/hub/pc/clipboard", { method: "POST" }); toast("Asking your PC…"); setTimeout(loadDrops, 6500); setTimeout(loadDrops, 12000); }
  catch (e) { toast(e.message); }
};

/* ------------------------------------------------------------------ Settings */
async function loadSettings() {
  try { const r = await api("/hub/settings"); st.settings = r.settings; st.presets = r.presets; } catch {}
}
let saveT;
function saveHubSettings(patch) {
  st.settings = Object.assign({}, st.settings, patch);
  clearTimeout(saveT);
  saveT = setTimeout(async () => { try { const r = await api("/hub/settings", { method: "PUT", body: { settings: st.settings } }); st.settings = r.settings; pollSoon(); } catch (e) { toast("Couldn't save: " + e.message); } }, 400);
}
let presetT;
function savePresets() {
  clearTimeout(presetT);
  presetT = setTimeout(async () => { try { await api("/hub/settings", { method: "PUT", body: { presets: st.presets } }); renderChat(); } catch (e) { toast("Couldn't save presets: " + e.message); } }, 600);
}
async function renderSettings() {
  await loadSettings();
  const s = st.settings || {};
  const pcModels = (st.status && st.status.pc.models) || [];
  const piModels = (st.status && st.status.pi.models) || [];
  const modelOpts = (sel, autoLabel) => `<option value="">${autoLabel}</option>` + pcModels.map(m => `<option value="${esc(m.id)}" ${sel === m.id ? "selected" : ""}>PC: ${esc(m.name || short(m.id))}</option>`).join("") + piModels.map(id => `<option value="${esc(id)}" ${sel === id ? "selected" : ""}>Pi: ${esc(short(id))}</option>`).join("");
  let h = "";
  h += `<div class="section" style="margin-top:12px"><h2>Connection</h2><div class="card">
    <div class="field"><label for="setUrl">Pi address</label><input id="setUrl" class="input" type="url" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(cfg.url)}"></div>
    <div class="field"><label for="setToken">LM Studio API token</label><input id="setToken" class="input" type="password" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(cfg.token)}"><div class="hint">Saved only on this device. The Pi uses it to talk to LM Studio.</div></div>
    <div class="row"><button class="btn sm" id="setTest">Test and save</button><span id="setTestOut" class="small"></span></div></div></div>`;
  h += `<div class="section"><h2>Notifications</h2><div class="card" id="notifCard"><div class="faint small">Checking…</div></div></div>`;
  h += `<div class="section"><h2>Answers</h2><div class="card">
    <div class="toggle-row"><div class="tx"><b>Smart routing</b><small>When your PC is asleep, quick questions are answered by the Pi straight away and bigger ones wake the PC. When the PC is awake, it always answers.</small></div><label class="switch"><input type="checkbox" id="setSmart" ${s.smart_routing ? "checked" : ""}><span></span></label></div>
    <div class="toggle-row"><div class="tx"><b>Notify me when an answer is ready</b><small>Only when the app isn't open.</small></div><label class="switch"><input type="checkbox" id="setNotify" ${s.notify_answers ? "checked" : ""}><span></span></label></div>
    <div class="toggle-row"><div class="tx"><b>Read answers aloud</b><small>On this device, using its built-in voice.</small></div><label class="switch"><input type="checkbox" id="setSpeak" ${cfg.autoSpeak ? "checked" : ""}><span></span></label></div>
    <div class="field" style="margin-top:8px"><label for="setDefault">Default PC model</label><select id="setDefault">${modelOpts(s.default_model, "Whatever is loaded")}</select></div></div></div>`;
  h += `<div class="section"><h2>Voice input</h2><div class="card">
    <div class="field"><span class="label">Engine</span><div class="seg" id="setVoice"><button data-v="auto" class="${cfg.voice !== "apple" ? "on" : ""}">Private (on your Pi)</button><button data-v="apple" class="${cfg.voice === "apple" ? "on" : ""}">Apple dictation</button></div>
    <div class="hint">${st.status && st.status.pi.voice ? "Private voice is installed: your recordings never leave your home." : "Private voice isn't installed on the Pi yet. Run <code>bash ~/home-ai-gateway/voice-setup.sh</code> on the Pi (takes about 10 minutes). Until then the mic uses Apple dictation."}</div></div>
    <div class="field"><label for="setLang">Language</label><select id="setLang">${[["auto", "Detect automatically"], ["en", "English"], ["fr", "French"]].map(([v, l]) => `<option value="${v}" ${s.voice_language === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div></div>`;
  h += `<div class="section"><h2>Presets <button id="addPreset">Add</button></h2><div class="card" id="presetList">${st.presets.map((p, i) => `<div class="preset-edit" data-i="${i}">
      <div class="ph"><input class="input emoji" value="${esc(p.icon || "")}" data-f="icon" aria-label="Emoji"><input class="input name" value="${esc(p.name)}" data-f="name" aria-label="Name"><button class="ibtn" data-del-preset="${i}" aria-label="Delete preset">${icon("trash", 'width="18" height="18"')}</button></div>
      <textarea class="input" rows="3" data-f="system" aria-label="Instructions">${esc(p.system || "")}</textarea>
      <select class="input" data-f="model" aria-label="Model">${modelOpts(p.model, "Model: same as chat")}</select></div>`).join("")}</div></div>`;
  h += `<div class="section"><h2>PC</h2><div class="card">
    <div class="field"><label for="setKeep">Keep the PC awake after you use it (minutes)</label><input id="setKeep" class="input" type="number" min="1" max="240" value="${esc(s.keep_awake_minutes)}"><div class="hint">After that, Windows' own sleep timer takes over.</div></div>
    <div class="field" style="margin-bottom:0"><label for="setWake">Wait for the PC to wake (seconds)</label><input id="setWake" class="input" type="number" min="30" max="600" value="${esc(s.wake_timeout)}"></div></div></div>`;
  h += `<div class="section"><h2>About</h2><div class="card small">
    <div class="spread"><span class="muted">App</span><span>${VERSION}</span></div>
    <div class="spread" style="margin-top:6px"><span class="muted">Pi hub</span><span>${st.status ? esc(st.status.hub) : "—"}</span></div>
    <div class="spread" style="margin-top:6px"><span class="muted">PC helper</span><span>${st.status && st.status.pc.agent_info && st.status.pc.agent_info.version ? esc(st.status.pc.agent_info.version) : "not connected"}</span></div>
    <div class="row" style="margin-top:14px"><button class="btn sm" id="reloadApp">Reload app</button><button class="btn sm danger" id="wipeAll">Delete all chats</button></div></div></div>`;
  h += `<div class="section"><h2>Emergency shutdown</h2><div class="card" id="emergCard"><div class="faint small">Checking…</div></div></div>`;
  $("#settingsPage").innerHTML = h;
  renderNotif();
  renderEmergency();
}
$("#settingsPage").addEventListener("change", e => {
  const t = e.target;
  if (t.id === "setSmart") saveHubSettings({ smart_routing: t.checked });
  if (t.id === "setNotify") saveHubSettings({ notify_answers: t.checked });
  if (t.id === "setSpeak") { cfg.autoSpeak = t.checked; saveCfg(); }
  if (t.id === "setDefault") saveHubSettings({ default_model: t.value });
  if (t.id === "setLang") saveHubSettings({ voice_language: t.value });
  if (t.id === "setKeep") saveHubSettings({ keep_awake_minutes: +t.value || 15 });
  if (t.id === "setWake") saveHubSettings({ wake_timeout: +t.value || 150 });
  if (t.dataset.f === "model") { const i = +t.closest(".preset-edit").dataset.i; st.presets[i].model = t.value; savePresets(); }
});
$("#settingsPage").addEventListener("input", e => {
  const f = e.target.dataset.f; if (!f || f === "model") return;
  const i = +e.target.closest(".preset-edit").dataset.i; st.presets[i][f] = e.target.value; savePresets();
});
$("#settingsPage").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.id === "setTest") {
    cfg.url = $("#setUrl").value.trim() || DEFAULT_URL; if (!/^https?:\/\//.test(cfg.url)) cfg.url = "https://" + cfg.url;
    cfg.token = $("#setToken").value.trim(); saveCfg();
    $("#setTestOut").className = "small"; $("#setTestOut").textContent = "Testing…";
    try { const s = await api("/hub/status", { timeout: 8000 }); $("#setTestOut").className = "okline"; $("#setTestOut").textContent = "Connected to hub " + s.hub + ". PC is " + s.pc.state + "."; st.status = s; st.online = true; loadChats(); }
    catch (er) { $("#setTestOut").className = "badline"; $("#setTestOut").textContent = er.name === "AbortError" ? "Can't reach the Pi. Is Tailscale on?" : er.message; }
  }
  if (t.dataset.v) { cfg.voice = t.dataset.v; saveCfg(); $$("#setVoice button").forEach(b => b.classList.toggle("on", b === t)); }
  if (t.id === "addPreset") { st.presets.push({ id: "p" + Date.now().toString(36), name: "New preset", icon: "💡", system: "", model: "" }); savePresets(); renderSettings(); }
  if (t.dataset.delPreset != null) { if (st.presets.length <= 1) { toast("Keep at least one preset"); return; } if (confirm("Delete this preset?")) { st.presets.splice(+t.dataset.delPreset, 1); savePresets(); renderSettings(); } }
  if (t.id === "reloadApp") location.reload();
  if (t.id === "wipeAll") { if (confirm("Delete ALL chats on every device? This can't be undone.")) { await api("/hub/chats", { method: "DELETE" }).catch(er => toast(er.message)); newChat(); loadChats(); toast("All chats deleted"); } }
  if (t.id === "notifOn") enableNotifications();
  if (t.id === "emGo") emergencySheet();
  if (t.id === "emChange") renderEmergency(true);
  if (t.id === "emSet") {
    const n1 = $("#emNew").value, n2 = $("#emNew2").value;
    if (n1 !== n2) { toast("The two passwords don't match"); return; }
    try { await api("/hub/emergency/password", { method: "POST", body: { new: n1, current: $("#emCur") ? $("#emCur").value : "" } }); toast("Emergency password saved 🔒"); renderEmergency(); }
    catch (er) { toast(er.message); }
  }
  if (t.id === "notifTest") {
    try {
      const r = await api("/hub/push/test", { method: "POST", timeout: 30000 });
      if (r.errors && r.errors.length) toast("Delivery failed: " + r.errors[0], 8000);
      else toast("Sent to " + r.sent + " device" + (r.sent === 1 ? "" : "s") + ". Lock your phone to see it.", 4000);
    } catch (er) { toast(er.message, 5000); }
  }
});

/* ------------------------------------------------------------------ emergency shutdown */
async function renderEmergency(showChange) {
  const box = $("#emergCard"); if (!box) return;
  let e;
  try { e = await api("/hub/emergency"); } catch { box.innerHTML = `<div class="faint small">Can't reach the Pi.</div>`; return; }
  if (!e.set) {
    box.innerHTML = `<p class="small muted" style="margin:0 0 12px">Shuts down your PC and your Raspberry Pi in one go. Set a password first so nobody can do it by accident.</p>
      <div class="field"><label for="emNew">New password</label><input id="emNew" class="input" type="password" autocomplete="new-password"></div>
      <div class="field"><label for="emNew2">Type it again</label><input id="emNew2" class="input" type="password" autocomplete="new-password"></div>
      <button class="btn sm" id="emSet">Set password</button>`;
    return;
  }
  box.innerHTML = `<p class="small muted" style="margin:0 0 12px">Shuts down your PC right away, then the Raspberry Pi. Needs your emergency password.</p>
    <button class="btn red" id="emGo" style="width:100%">Emergency shutdown</button>
    <div style="margin-top:12px">${showChange ? `
      <div class="field"><label for="emCur">Current password</label><input id="emCur" class="input" type="password" autocomplete="current-password"></div>
      <div class="field"><label for="emNew">New password</label><input id="emNew" class="input" type="password" autocomplete="new-password"></div>
      <div class="field"><label for="emNew2">Type it again</label><input id="emNew2" class="input" type="password" autocomplete="new-password"></div>
      <button class="btn sm" id="emSet">Change password</button>
      <p class="hint">Forgot it? On the Pi run: <code>touch ~/home-ai-gateway/reset-password && sudo systemctl restart home-ai-gateway</code></p>`
      : `<button class="linkbtn" id="emChange">Change password</button>`}</div>`;
}
function emergencySheet() {
  const h = `<div class="grab"></div><h3>Emergency shutdown</h3>
    <div class="emerg-warn">Your PC shuts down <b>immediately</b>: unsaved work is lost (Roblox keeps what Team Create auto-saved).
      Then the Raspberry Pi turns off. <b>To bring the Pi back you'll have to unplug it and plug it back in.</b> Until then this app, waking the PC and your home devices won't work.</div>
    <div class="toggle-row"><div class="tx"><b>Shut down the PC</b></div><label class="switch"><input type="checkbox" id="emPc" checked><span></span></label></div>
    <div class="toggle-row"><div class="tx"><b>Shut down the Raspberry Pi</b></div><label class="switch"><input type="checkbox" id="emPi" checked><span></span></label></div>
    <div class="field" style="margin-top:10px"><label for="emPw">Emergency password</label><input id="emPw" class="input" type="password" autocomplete="current-password"></div>
    <button class="btn red" id="emConfirm" style="width:100%">Shut it all down</button>
    <button class="btn" data-close style="width:100%;margin-top:8px">Cancel</button>`;
  openSheet(h, async e => {
    const b = e.target.closest("#emConfirm"); if (!b) return;
    const pc = $("#emPc").checked, pi = $("#emPi").checked;
    if (!pc && !pi) { toast("Pick at least one"); return; }
    b.disabled = true; b.textContent = "Shutting down…";
    try {
      const r = await api("/hub/emergency", { method: "POST", body: { password: $("#emPw").value, pc, pi } });
      closeSheet();
      toast([r.pc ? "PC: " + r.pc : "", r.pi ? "Pi: " + r.pi : ""].filter(Boolean).join(". ") + ". Bye 👋", 7000);
    } catch (er) { b.disabled = false; b.textContent = "Shut it all down"; toast(er.message, 4500); }
  });
  setTimeout(() => $("#emPw") && $("#emPw").focus(), 100);
}

/* ------------------------------------------------------------------ notifications */
let swReg = null;
async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try { swReg = await navigator.serviceWorker.register("sw.js"); } catch (e) { console.warn("SW failed", e); }
  navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.url) handleUrl(e.data.url); });
}
async function renderNotif() {
  const box = $("#notifCard"); if (!box) return;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  let h;
  if (!supported) h = /iPhone|iPad/.test(navigator.userAgent) && !isStandalone() ? `<div class="small muted">Open Home AI from your home screen icon (not Safari) to turn on notifications.</div>` : `<div class="small muted">This browser can't receive notifications.</div>`;
  else if (st.status && !st.status.pi.push) h = `<div class="small muted">Notifications aren't set up on the Pi. Re-run the Pi installer.</div>`;
  else {
    let sub = null; try { const reg = swReg || await navigator.serviceWorker.ready; sub = await reg.pushManager.getSubscription(); } catch {}
    h = sub && Notification.permission === "granted"
      ? `<div class="spread"><span class="okline">On for this device</span><button class="btn sm" id="notifTest">Send a test</button></div><div class="hint">You'll get pinged when answers finish while you're away, when schedules run, and when your PC sends you something.</div>`
      : Notification.permission === "denied" ? `<div class="small badline">Notifications are blocked for Home AI. Turn them on in iPhone Settings › Notifications › Home AI.</div>`
      : `<div class="spread"><span class="small muted">Get pinged when an answer is ready, even with the app closed.</span><button class="btn sm primary" id="notifOn">Turn on</button></div>`;
  }
  box.innerHTML = h;
}
async function refreshPushSub() {
  try {
    if (!("PushManager" in window) || Notification.permission !== "granted") return;
    const reg = swReg || await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await api("/hub/push/subscribe", { method: "POST", body: { subscription: sub.toJSON(), cid: CID } });
  } catch {}
}
function b64ToBytes(b64) { const p = "=".repeat((4 - b64.length % 4) % 4); const s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...s].map(c => c.charCodeAt(0))); }
async function enableNotifications() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Notifications weren't allowed"); renderNotif(); return; }
    const { key } = await api("/hub/push/key");
    const reg = swReg || await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    await api("/hub/push/subscribe", { method: "POST", body: { subscription: sub.toJSON(), cid: CID } });
    toast("Notifications on 🔔");
  } catch (e) { toast("Couldn't turn on notifications: " + e.message, 4500); }
  renderNotif();
}

/* ------------------------------------------------------------------ onboarding & boot */
function showOnboard(msg) {
  $$(".view").forEach(v => v.classList.remove("on"));
  $("#view-onboard").classList.add("on");
  $("#tabbar").classList.add("hidden");
  $("#obUrl").value = cfg.url; $("#obToken").value = cfg.token;
  $("#obMsg").textContent = msg || "";
}
$("#obGo").onclick = async () => {
  cfg.url = $("#obUrl").value.trim() || DEFAULT_URL; if (!/^https?:\/\//.test(cfg.url)) cfg.url = "https://" + cfg.url;
  cfg.token = $("#obToken").value.trim(); saveCfg();
  $("#obMsg").textContent = "Connecting…";
  try { await api("/hub/status", { timeout: 8000 }); $("#tabbar").classList.remove("hidden"); boot(); }
  catch (e) { $("#obMsg").textContent = e.name === "AbortError" || e.message === "Failed to fetch" || e instanceof TypeError ? "Can't reach the Pi. Check the address and that Tailscale is on." : e.message; }
};

function handleUrl(u) {
  const q = new URL(u, location.href).searchParams;
  if (q.get("tab")) setTab(q.get("tab"));
  if (q.get("chat")) { setTab("chat"); openChat(q.get("chat")); }
}

function fitViewport() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--app-h", h + "px");
  window.scrollTo(0, 0);
}
if (window.visualViewport) visualViewport.addEventListener("resize", () => { fitViewport(); scrollBottom(); });
window.addEventListener("resize", fitViewport);

async function boot() {
  paintIcons();
  fitViewport();
  if (!cfg.token) { showOnboard(); return; }
  setTab("chat");
  await Promise.all([poll(), loadSettings()]);
  if (st.online === false && st.statusErr && st.statusErr.status !== 401) { /* keep the app usable, status shows offline */ }
  renderChat(); updateModelPill(); setSending();
  loadChats(); readLegacy(); registerSW().then(refreshPushSub);
  if (location.search) handleUrl(location.href);
}
window.addEventListener("katex-ready", () => { if (st.msgs.length) renderChat(); });
paintIcons();
boot();
})();
