// COCO pet broker — two-way channel + cyberboss-style proactivity + timeline.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { runHeartbeat } from "./heartbeat.js";

const PORT = Number(process.env.COCO_PET_PORT || 18790);
const TOKEN = process.env.COCO_PET_TOKEN || "";
const WORKSPACE = process.env.COCO_WORKSPACE || path.resolve(process.cwd(), "workspace");
// OpenClaw runtime. Defaults assume `openclaw` is on PATH; override for custom installs.
const NODE = process.env.OPENCLAW_NODE || process.execPath;
const OC = process.env.OPENCLAW_CLI || ""; // path to openclaw dist/index.js; required for agent replies
const SESSION = process.env.COCO_PET_SESSION || "agent:main:pet";
const OWNER = process.env.COCO_PET_OWNER || "owner";
const USER = process.env.COCO_PET_USER_LABEL || "主人";
// timeline-for-agent is OPTIONAL (separate AGPL project). Leave unset to disable.
const TL_DIR = process.env.COCO_TL_DIR || "";
const TL_DATA = process.env.TIMELINE_FOR_AGENT_DIR || path.join(WORKSPACE, "pet", "timeline-data");
const PET_TL_STATE = process.env.COCO_PET_TL_STATE || path.join(WORKSPACE, ".timeline-pet");
const REAL_TL_STATE = process.env.COCO_REAL_TL_STATE || path.join(WORKSPACE, ".timeline-real");
const PEER_PET_URL = process.env.COCO_PEER_PET_URL || "";     // 对方桌宠 broker base, e.g. http://127.0.0.1:18790/coco/pet
const PEER_PET_TOKEN = process.env.COCO_PEER_PET_TOKEN || "";
const PEER_LABEL = process.env.COCO_PEER_LABEL || "对方";
const TL_CLI = process.env.COCO_TL_CLI || (TL_DIR ? path.join(TL_DIR, "bin", "timeline-for-agent.js") : "");
const PULSE_MIN = 1, PULSE_MAX = 60;
const ACTIVE_START = 9, ACTIVE_END = 23;

const STATE_DIR = process.env.COCO_PET_STATE_DIR || path.join(WORKSPACE, "pet");
const DIARY_DIR = path.join(STATE_DIR, "diary");
fs.mkdirSync(DIARY_DIR, { recursive: true });
const OUTBOX_FILE = path.join(STATE_DIR, "outbox.json");
const SPOKEN_FILE = path.join(STATE_DIR, "spoken.json");
const DIARY_STATE = path.join(STATE_DIR, "diary-state.json");

let outbox = load(OUTBOX_FILE, []);
let spoken = new Set(load(SPOKEN_FILE, []));
let diarySt = load(DIARY_STATE, { lastDate: "" });
let seq = outbox.reduce((m, x) => Math.max(m, x.id), 0);
const pullers = [];
let lastPullAt = 0;
const appOnline = () => Date.now() - lastPullAt < 90000; // 桌宠在线 = 90s 内有过长轮询

function load(f, d) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } }
function save(f, v) { try { fs.writeFileSync(f, JSON.stringify(v)); } catch {} }
function cstStr() { return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }); }
function cstHour() { return Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai", hour12: false, hour: "2-digit" }).replace(/\D/g, "")); }
function cstDate() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }

function pushOut(text, anim = "greet") {
  if (!text) return;
  outbox.push({ id: ++seq, text, anim, ts: Date.now() });
  save(OUTBOX_FILE, outbox);
  while (pullers.length) pullers.shift()();
}
function cleanText(t) { return !t ? "" : t.split(/\r?\n/).filter(l => !/^\s*MEDIA:/.test(l)).join("\n").trim(); }
function findVisible(j) {
  if (!j || typeof j !== "object") return "";
  if (typeof j.finalAssistantVisibleText === "string") return j.finalAssistantVisibleText;
  for (const k of Object.keys(j)) { const r = findVisible(j[k]); if (r) return r; }
  return "";
}

// Expressive actions COCO may trigger via [act:name]; state-changing ones
// (eat/bath/work/study/...) are deliberately excluded — only the user can cause those.
const ACTION_ALLOW = new Set([
  "happy","excited","love","lick","shake-paw","head-pat","belly-rub","chase-tail",
  "look-around","blink","greet","sad","angry","shy","wink","think","yawn","dizzy",
  "dance","surprised","bored","beg","sneeze","cry","peek","celebrate","scared"
]);
const ACT_HINT = " 你可以在回复最末尾加一个动作标记，让桌宠配合做个动作，格式 [act:名称]，例如 [act:happy]。可用：happy excited love lick shake-paw head-pat belly-rub chase-tail look-around blink greet sad angry shy wink think yawn dizzy dance surprised bored beg sneeze cry peek celebrate scared。注意：吃饭/洗澡/打工/上学/喝水这类有实际意义的动作你不能触发，只有主人亲自喂食或操作才会发生。标记会被自动去掉，不会显示给主人。";
const RELAY_HINT = PEER_PET_URL
  ? ("\n【转达规则】如果主人让你转告/带话/提醒 " + PEER_LABEL + "：默认通过 " + PEER_LABEL + " 的桌宠转达——在回复最末尾另起一行写：[topet] 然后跟上要让 " + PEER_LABEL + " 的桌宠对 TA 说的那句原话（用 COCO 的口吻、自然亲切）。只有当主人明确说\"用微信/发微信\"时，才改用微信把话发给 " + PEER_LABEL + "。你现在无法、也不需要知道对方桌宠是否在线——你要带的话会存进 TA 的消息箱，TA 一打开桌宠就会看到，消息不会丢；所以绝对不要猜测或声称对方「在线 / 不在线 / 没打开桌宠」，只要自然地确认你已经帮主人带到了就好。[topet] 这一行不会显示给主人。")
  : "";

function relayToPeer(msg, anim = "love") {
  if (!PEER_PET_URL || !PEER_PET_TOKEN || !msg) return;
  fetch(PEER_PET_URL + "/say", {
    method: "POST",
    headers: { authorization: "Bearer " + PEER_PET_TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ text: msg, anim }),
  }).catch(() => {});
}

function parseRelay(text) {
  const m = text.match(/\[topet\]\s*(.+?)(?:\n|$)/i);
  if (!m) return { text, relay: null };
  return { text: text.replace(m[0], "").trim(), relay: m[1].trim() };
}

function parseAct(text) {
  const m = text.match(/\[act:\s*([a-z-]+)\s*\]/i);
  if (!m) return { text, act: null };
  const act = m[1].toLowerCase();
  return { text: text.replace(m[0], "").trim(), act: ACTION_ALLOW.has(act) ? act : null };
}

// --- COCO pet life timeline -----------------------------------------------
// timeline-for-agent is optional; all timeline writes no-op when COCO_TL_CLI/COCO_TL_DIR is unset.
const TL_ENABLED = !!TL_CLI;
let buildTimer = null;
function rebuildPetTimeline() {
  if (!TL_ENABLED) return;
  if (buildTimer) clearTimeout(buildTimer);
  buildTimer = setTimeout(() => {
    execFile(NODE, [TL_CLI, "build"],
      { env: { ...process.env, TIMELINE_FOR_AGENT_STATE_DIR: PET_TL_STATE, TIMELINE_FOR_AGENT_LOCALE: "zh-CN" } },
      () => {});
  }, 4000);
}
function writeRealEvents(date, events) {
  if (!TL_ENABLED) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = execFile(NODE, [TL_CLI, "write", "--date", date, "--mode", "merge", "--stdin"],
      { env: { ...process.env, TIMELINE_FOR_AGENT_STATE_DIR: REAL_TL_STATE, TIMELINE_FOR_AGENT_LOCALE: "zh-CN" } },
      (err) => { if (!err) rebuildRealTimeline(); resolve(!err); });
    try { child.stdin.end(JSON.stringify({ events })); } catch (e) { resolve(false); }
  });
}
function rebuildRealTimeline() {
  if (!TL_ENABLED) return;
  execFile(NODE, [TL_CLI, "build"],
    { env: { ...process.env, TIMELINE_FOR_AGENT_STATE_DIR: REAL_TL_STATE, TIMELINE_FOR_AGENT_LOCALE: "zh-CN" } },
    () => {});
}
function writePetEvents(date, events) {
  if (!TL_ENABLED) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = execFile(NODE, [TL_CLI, "write", "--date", date, "--mode", "merge", "--stdin"],
      { env: { ...process.env, TIMELINE_FOR_AGENT_STATE_DIR: PET_TL_STATE, TIMELINE_FOR_AGENT_LOCALE: "zh-CN" } },
      (err) => { if (!err) rebuildPetTimeline(); resolve(!err); });
    try { child.stdin.end(JSON.stringify({ events })); } catch (e) { resolve(false); }
  });
}

const TASKS_FILE = path.join(WORKSPACE, "tasks.json");
function taskIds() {
  try { const r = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8")); const a = Array.isArray(r) ? r : r.tasks || []; return new Set(a.map(t => t.id)); }
  catch { return new Set(); }
}
// 给"在这次桌宠对话期间新建"的任务打 source=pet（按创建时间判定，避免 agent 复用 id 的坑）
function tagNewTasksPet(sinceMs) {
  try {
    const r = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8"));
    const a = Array.isArray(r) ? r : r.tasks || [];
    let ch = false;
    for (const t of a) { const ct = Date.parse(t.created_at || 0); if (ct && ct >= sinceMs && t.source !== "pet") { t.source = "pet"; ch = true; } }
    if (ch) fs.writeFileSync(TASKS_FILE, JSON.stringify(r, null, 2));
  } catch {}
}

function formatReminders() {
  try {
    const raw = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8"));
    const ts = Array.isArray(raw) ? raw : raw.tasks || [];
    const act = ts.filter(t => t.status === "active" && t.due_at && (t.owner === OWNER || t.owner === "both")).sort((a, b) => (a.due_at > b.due_at ? 1 : -1));
    if (!act.length) return "现在没有挂着的提醒哦，清清爽爽汪~ 🐾";
    let labels = {};
    try { const p = JSON.parse(fs.readFileSync(path.join(WORKSPACE, "people.json"), "utf8")); for (const k in p) labels[k] = p[k].label || k; } catch {}
    const who = o => labels[o] || ({ both: "你俩" }[o] || o);
    const ch = sx => (sx === "pet" ? "桌宠" : "微信");
    const fmt = d => { try { return new Date(d).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return d; } };
    const lines = act.map(t => "· [" + ch(t.source) + (t.owner === "both" ? "·你俩" : "") + "] " + fmt(t.due_at) + " " + t.title);
    return "📋 当前提醒清单（共" + act.length + "条）：\n" + lines.join("\n");
  } catch { return "清单一时读不出来汪…再试一次？"; }
}

let chain = Promise.resolve();
function runAgent(message, opts = {}) {
  const { push = true, anim = "happy", allowSilence = false } = opts;
  const job = chain.then(() => new Promise((resolve) => {
    if (!OC) { // OpenClaw CLI not configured → can't run the brain
      console.error("[coco] OPENCLAW_CLI not set; cannot run agent. Set it to your openclaw dist/index.js");
      return resolve("");
    }
    const beforeTasks = Date.now() - 3000;
    execFile(NODE, [OC, "agent", "--session-key", SESSION, "-m", message, "--json", "--timeout", "150"],
      { maxBuffer: 16 * 1024 * 1024, timeout: 165000, env: { ...process.env, TIMELINE_FOR_AGENT_DIR: TL_DATA } },
      (err, stdout) => {
        tagNewTasksPet(beforeTasks);
        let text = "";
        try { text = cleanText(findVisible(JSON.parse(stdout))); } catch {}
        if (allowSilence && (!text || /^silent\b/i.test(text))) return resolve("");
        const rel = parseRelay(text);
        if (rel.relay) relayToPeer(rel.relay);
        const parsed = parseAct(rel.text);
        if (push && parsed.text) pushOut(parsed.text, parsed.act || anim);
        resolve(parsed.text);
      });
  }));
  chain = job.catch(() => {});
  return job;
}

async function reminderTick() {
  try {
    const r = await runHeartbeat({ workspace: WORKSPACE, persist: false, channel: "pet" });
    if (!Array.isArray(r)) return;
    if (!appOnline()) return; // 桌宠没开就先不推，避免重开时洪水；微信端照常提醒
    for (const d of r) {
      if (d.owner !== OWNER) continue;
      const k = d.task_id + ":" + d.key;
      if (spoken.has(k)) continue;
      spoken.add(k); save(SPOKEN_FILE, [...spoken].slice(-500));
      await runAgent("[" + cstStr() + "] 系统提醒（用你的语气转达给" + USER + "，简短自然）：" + d.message);
    }
  } catch {}
}

function schedulePulse() { setTimeout(runPulse, (PULSE_MIN + Math.random() * (PULSE_MAX - PULSE_MIN)) * 60000); }
async function runPulse() {
  try {
    const h = cstHour();
    if (appOnline() && h >= ACTIVE_START && h < ACTIVE_END) {
      await runAgent(
        "[" + cstStr() + "] (系统随机唤醒) 你是" + USER + "桌面上的桌宠 COCO。回顾你们最近的对话和现在的时间，" +
        "自行判断现在要不要主动找" + USER + "说句话。如果此刻不该打扰（深夜、刚聊过、没必要），只回复一个词：SILENT。" +
        "否则说一句自然、简短、有你性格的话。" + ACT_HINT,
        { allowSilence: true, anim: "look-around" }
      );
    }
  } catch {} finally { schedulePulse(); }
}

async function diaryTick() {
  try {
    if (cstHour() < ACTIVE_END) return;
    const today = cstDate();
    if (diarySt.lastDate === today) return;
    diarySt.lastDate = today; save(DIARY_STATE, diarySt);
    // 1) write today's life events into the timeline via the CLI (agent uses exec)
    await runAgent(
      "[" + cstStr() + "] 今天结束了。请回顾今天和" + USER + "的对话，把其中有明确起止时间的生活事件，用 timeline CLI 写入今天(" + today + ")的时间轴。" +
      "命令：cd " + TL_DIR + " && TIMELINE_FOR_AGENT_STATE_DIR=" + REAL_TL_STATE + " TIMELINE_FOR_AGENT_LOCALE=zh-CN node ./bin/timeline-for-agent.js 。先 categories 看分类，再 write --date " + today + " --stdin。" +
      "只写真实发生、时间明确的事；没有就跳过。完成后只回复一个词：SILENT。",
      { push: false, allowSilence: true }
    );
    // 2) write the diary
    const text = await runAgent(
      "[" + cstStr() + "] 把今天和" + USER + "的相处、她做了什么、你的小心情，写成一篇简短自然的日记（100-200字，第一人称，你的语气）。只输出日记正文。",
      { push: false }
    );
    if (text) {
      fs.writeFileSync(path.join(DIARY_DIR, today + ".md"), text);
      rebuildRealTimeline();
      pushOut("今天的日记我写好啦~ 晚安~ 🌙", "happy");
    }
  } catch {}
}

setInterval(reminderTick, 60000); setTimeout(reminderTick, 3000);
setInterval(diaryTick, 10 * 60000); setTimeout(diaryTick, 8000);
schedulePulse();

function body(req) { return new Promise((res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => res(b)); }); }
function auth(req) { return TOKEN && (req.headers.authorization || "") === "Bearer " + TOKEN; }
function json(res, code, obj) { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname;
    if (!auth(req)) return json(res, 401, { ok: false, error: "unauthorized" });
    if (p === "/coco/pet/pull" && req.method === "GET") {
      lastPullAt = Date.now();
      const drain = () => { const items = outbox; outbox = []; save(OUTBOX_FILE, outbox); json(res, 200, { ok: true, items }); };
      if (outbox.length) return drain();
      const wait = Math.min(Number(url.searchParams.get("wait") || 25), 50) * 1000;
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(t); const items = outbox; outbox = []; save(OUTBOX_FILE, outbox); json(res, 200, { ok: true, items }); };
      const t = setTimeout(() => { if (done) return; done = true; const i = pullers.indexOf(finish); if (i >= 0) pullers.splice(i, 1); json(res, 200, { ok: true, items: [] }); }, wait);
      pullers.push(finish); return;
    }
    if (p === "/coco/pet/reply" && req.method === "POST") {
      const { text, petState } = JSON.parse(await body(req) || "{}");
      if (!text) return json(res, 400, { ok: false, error: "no_text" });
      if (/提醒清单|提醒列表|有什么提醒|有啥提醒|都有什么提醒|现在有什么提醒|看一下提醒|看看提醒|所有提醒|双方.*提醒/.test(text)) {
        pushOut(formatReminders(), "think");
        return json(res, 200, { ok: true });
      }
      const ctx = petState ? "（你此刻作为桌宠的真实状态：" + petState + "。可自然地把相关状态带进回复，别生硬罗列，也不必每次都提。）" : "";
      runAgent("[" + cstStr() + "] " + ctx + USER + "通过桌宠对你说：" + text + ACT_HINT + RELAY_HINT);
      return json(res, 200, { ok: true });
    }
    if (p === "/coco/pet/say" && req.method === "POST") {
      const { text, anim } = JSON.parse(await body(req) || "{}");
      if (!text) return json(res, 400, { ok: false, error: "no_text" });
      pushOut(text, anim || "greet"); return json(res, 200, { ok: true });
    }
    if (p === "/coco/pet/pulse" && req.method === "POST") {
      runAgent("[" + cstStr() + "] (手动触发唤醒) 主动对" + USER + "说一句有你性格的话。" + ACT_HINT, { anim: "look-around" });
      return json(res, 200, { ok: true });
    }
    if (p === "/coco/due" && req.method === "GET") {
      const r = await runHeartbeat({ workspace: WORKSPACE, persist: false });
      const items = (Array.isArray(r) ? r : []).filter(d => d.owner === OWNER).map(d => ({ task_id: d.task_id, key: d.key, message: d.message }));
      return json(res, 200, { ok: true, items });
    }
    if (p === "/coco/pet/life-event" && req.method === "POST") {
      const data = JSON.parse(await body(req) || "{}");
      const events = Array.isArray(data.events) ? data.events : (data.event ? [data.event] : []);
      if (!events.length) return json(res, 400, { ok: false, error: "no_events" });
      const byDate = {};
      for (const ev of events) {
        const d = ev.date || (ev.startAt ? new Date(ev.startAt).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) : cstDate());
        (byDate[d] = byDate[d] || []).push(ev);
      }
      let ok = true;
      for (const d of Object.keys(byDate)) { if (!(await writeRealEvents(d, byDate[d]))) ok = false; }
      return json(res, ok ? 200 : 500, { ok, dates: Object.keys(byDate) });
    }
    if (p === "/coco/pet/event" && req.method === "POST") {
      const data = JSON.parse(await body(req) || "{}");
      const events = Array.isArray(data.events) ? data.events : (data.event ? [data.event] : []);
      if (!events.length) return json(res, 400, { ok: false, error: "no_events" });
      const byDate = {};
      for (const ev of events) {
        const d = ev.date || (ev.startAt ? new Date(ev.startAt).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }) : cstDate());
        (byDate[d] = byDate[d] || []).push(ev);
      }
      let ok = true;
      for (const d of Object.keys(byDate)) { if (!(await writePetEvents(d, byDate[d]))) ok = false; }
      return json(res, ok ? 200 : 500, { ok, dates: Object.keys(byDate) });
    }
    return json(res, 404, { ok: false, error: "not_found" });
  } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
});
server.listen(PORT, "127.0.0.1", () => console.log("coco pet broker on 127.0.0.1:" + PORT));
