// local-brain.js — fully-local backend (no server required).
// Exposes the same interface as link.js so brain.js can swap it in transparently:
//   start, sendReply, logEvent, logLifeEvents, getTimelines, kick,
//   getUpdateBase, isConfigured, configure
//
// • Chat   : direct LLM call (anthropic/openai/deepseek/ollama) if an apiKey is
//            set; otherwise canned personality lines. Any error → canned, so it
//            never breaks and works 100% offline.
// • Remind : natural-language ("提醒我 18:00 喝水" / "30分钟后…") → local store →
//            system Notification + a chat line when due.
// • Timeline: pet/person events appended to a local JSON, viewed in a bundled
//            offline HTML page (no auth, no host).
const fs = require("fs");
const path = require("path");
const { app, Notification } = require("electron");

let cfg = null;          // coco.config.json
let onSayCb = null;
let timer = null;

function configure(cocoCfg) { cfg = cocoCfg || {}; }

// ── paths (all under userData, never in the app bundle) ──────────────────────
function dataDir() {
  const d = path.join(app.getPath("userData"), "local");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const TL_FILE  = () => path.join(dataDir(), "timeline.json");
const REM_FILE = () => path.join(dataDir(), "reminders.json");

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, obj) {
  try { fs.writeFileSync(file, JSON.stringify(obj, null, 2)); } catch {}
}

// ── chat ─────────────────────────────────────────────────────────────────────
const CANNED = {
  hungry:  ["汪！我有点饿了，想吃小饼干～🦴", "肚子咕咕叫啦，主人喂喂我嘛～"],
  love:    ["最喜欢主人啦！蹭蹭～❤️", "和主人在一起最开心了！", "抱抱我嘛～汪汪！"],
  play:    ["一起玩球球好不好！🎾", "我精力满满，想出去跑跑～", "陪我玩一会儿嘛！"],
  tired:   ["有点困了…趴一会儿哦 zzz", "打个哈欠～主人也早点休息呀"],
  default: ["汪汪！我在呢～", "主人你回来啦！", "今天也要元气满满哦！", "想你了，陪陪我嘛～", "嗯嗯，我有在乖乖听话！"],
};
const ANIM_FOR = { hungry: "hungry", love: "love", play: "excited", tired: "yawn", default: "happy" };

function classify(text) {
  const t = String(text || "");
  if (/饿|吃|饭|零食|饼干/.test(t)) return "hungry";
  if (/爱|喜欢|抱|想你|乖|好可爱|亲亲/.test(t)) return "love";
  if (/玩|球|出去|散步|跑/.test(t)) return "play";
  if (/累|困|睡|晚安|休息/.test(t)) return "tired";
  return "default";
}
function cannedReply(text) {
  const k = classify(text);
  const pool = CANNED[k] || CANNED.default;
  // deterministic-ish pick (no Math.random dependency): by text length
  let pick = pool[String(text || "").length % pool.length];
  // 让离线台词也带上性格里设置的口头禅（默认 COCO 用「汪」）
  const cp = cfg?.personality?.catchphrase;
  if (cp && cp !== "汪") pick = pick.replace(/汪/g, cp);
  return { text: pick, anim: ANIM_FOR[k] || "happy" };
}

async function tfetch(url, opts, ms = 20000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}

// Returns reply text, or null on any failure (caller falls back to canned).
async function llmReply(text, petState) {
  const b = cfg?.brain || {};
  const provider = (b.provider || "none").toLowerCase();
  if (provider === "none" || (!b.apiKey && provider !== "ollama")) return null;
  const sys = (b.systemPrompt || "你是 Coco，一只活泼的雪纳瑞桌宠，说话简短可爱。")
    + (petState ? `\n（你现在的状态：${petState}）` : "");
  try {
    if (provider === "anthropic") {
      const r = await tfetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": b.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: b.model || "claude-haiku-4-5-20251001", max_tokens: 200, system: sys, messages: [{ role: "user", content: text }] }),
      });
      const j = await r.json();
      return j?.content?.[0]?.text?.trim() || null;
    }
    if (provider === "openai" || provider === "deepseek") {
      const base = b.baseUrl || (provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com");
      const r = await tfetch(`${base}/v1/chat/completions`.replace("/v1/v1", "/v1"), {
        method: "POST",
        headers: { Authorization: `Bearer ${b.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: b.model || (provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini"), max_tokens: 200, messages: [{ role: "system", content: sys }, { role: "user", content: text }] }),
      });
      const j = await r.json();
      return j?.choices?.[0]?.message?.content?.trim() || null;
    }
    if (provider === "ollama") {
      const base = b.baseUrl || "http://localhost:11434";
      const r = await tfetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: b.model || "llama3", stream: false, messages: [{ role: "system", content: sys }, { role: "user", content: text }] }),
      });
      const j = await r.json();
      return j?.message?.content?.trim() || null;
    }
  } catch { return null; }
  return null;
}

function say(text, anim) {
  if (onSayCb) onSayCb({ text, anim });
}

// ── reminders ──────────────────────────────────────────────────────────────
// Parse a reminder out of a chat line. Returns {at:Date, text} or null.
function parseReminder(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^\/提醒\s*/, "");
  const m = s.match(/提醒我?\s*(.*)/);
  const body = m ? m[1] : (raw.startsWith("/提醒") ? s : null);
  if (body == null) return null;

  const now = new Date();
  // 「30分钟后 / 2小时后」
  let rel = body.match(/(\d+)\s*分钟?后\s*(.*)/);
  if (rel) { const d = new Date(now.getTime() + (+rel[1]) * 60000); return { at: d, text: rel[2].trim() || "提醒" }; }
  rel = body.match(/(\d+)\s*小时后\s*(.*)/);
  if (rel) { const d = new Date(now.getTime() + (+rel[1]) * 3600000); return { at: d, text: rel[2].trim() || "提醒" }; }
  // 「18:00 喝水 / 8点 喝水」
  let abs = body.match(/(\d{1,2})[:：点](\d{2})?\s*(.*)/);
  if (abs) {
    const d = new Date(now);
    d.setHours(+abs[1], abs[2] ? +abs[2] : 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1); // 已过则顺延到明天
    return { at: d, text: abs[3].trim() || "提醒" };
  }
  return null;
}

function addReminder(at, text) {
  const list = readJson(REM_FILE(), []);
  list.push({ id: `r_${at.getTime()}_${list.length}`, at: at.toISOString(), text, fired: false });
  writeJson(REM_FILE(), list);
}

function tickReminders() {
  if (cfg?.reminders && cfg.reminders.enabled === false) return;
  const list = readJson(REM_FILE(), []);
  let changed = false;
  const now = Date.now();
  for (const r of list) {
    if (r.fired) continue;
    if (new Date(r.at).getTime() <= now) {
      r.fired = true; changed = true;
      try { if (Notification.isSupported()) new Notification({ title: "Coco 提醒你", body: r.text }).show(); } catch {}
      say(`汪！到点啦——${r.text} ⏰`, "excited");
    }
  }
  if (changed) writeJson(REM_FILE(), list.filter(r => !r.fired || new Date(r.at).getTime() > now - 86400000));
}

// ── public interface (mirrors link.js) ───────────────────────────────────────
function start(onSay) {
  onSayCb = onSay;
  if (timer) clearInterval(timer);
  timer = setInterval(tickReminders, 30000);
  setTimeout(tickReminders, 2000);
  return true;
}

async function sendReply(text, petState) {
  const t = String(text || "").trim();
  if (!t) return false;
  // reminder intent first
  const rem = parseReminder(t);
  if (rem) {
    addReminder(rem.at, rem.text);
    const when = rem.at.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
    say(`好嘞！${when} 我会提醒你「${rem.text}」～记牢啦 🐾`, "beg");
    return true;
  }
  // chat: LLM if configured, else canned
  let reply = await llmReply(t, petState);
  if (reply) { say(reply, "happy"); return true; }
  const c = cannedReply(t);
  say(c.text, c.anim);
  return true;
}

function timelineEnabled() { return !(cfg?.timeline && cfg.timeline.enabled === false); }

// pet activity → local pet timeline
function logEvent(event) {
  if (!timelineEnabled()) return false;
  const data = readJson(TL_FILE(), { pet: [], cc: [] });
  data.pet.push(event);
  if (data.pet.length > 2000) data.pet = data.pet.slice(-2000);
  writeJson(TL_FILE(), data);
  renderTimelines(data);
  return true;
}

// real-life events (e.g. screen time) → local person timeline
function logLifeEvents(events) {
  if (!Array.isArray(events) || !events.length || !timelineEnabled()) return false;
  const data = readJson(TL_FILE(), { pet: [], cc: [] });
  data.cc.push(...events);
  if (data.cc.length > 2000) data.cc = data.cc.slice(-2000);
  writeJson(TL_FILE(), data);
  renderTimelines(data);
  return true;
}

// Render a self-contained offline HTML page per timeline, data inlined (no
// cross-file fetch → no file:// CORS headache). Re-rendered on every write.
function htmlFile(which) { return path.join(dataDir(), `timeline-${which}.html`); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

function renderOne(which, label, events) {
  const fmtT = (iso) => { try { return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  const fmtD = (iso) => { try { return new Date(iso).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" }); } catch { return "未知日期"; } };
  const byDay = {};
  for (const e of (events || [])) {
    const k = fmtD(e.startAt || e.endAt);
    (byDay[k] = byDay[k] || []).push(e);
  }
  const days = Object.keys(byDay).sort((a, b) => byDay[b][0]?.startAt > byDay[a][0]?.startAt ? 1 : -1);
  const rows = days.map(d => {
    const items = byDay[d].sort((a, b) => (a.startAt > b.startAt ? 1 : -1)).map(e => `
      <div class="ev">
        <span class="t">${esc(fmtT(e.startAt))}${e.endAt ? "–" + esc(fmtT(e.endAt)) : ""}</span>
        <span class="cat">${esc(e.categoryId || e.category || "")}</span>
        <span class="ti">${esc(e.title || e.note || "活动")}</span>
      </div>`).join("");
    return `<section><h2>${esc(d)}</h2>${items}</section>`;
  }).join("") || `<p class="empty">还没有记录哦～ Coco 会把日常活动记在这里 🐾</p>`;
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>${esc(label)}</title>
<style>
  body{font-family:-apple-system,"PingFang SC",sans-serif;background:#fffaf6;color:#3a2f2a;margin:0;padding:28px 32px;}
  h1{font-size:22px;margin:0 0 18px;}
  h2{font-size:14px;color:#b07a4f;margin:22px 0 8px;border-bottom:1px solid #f0e3d6;padding-bottom:4px;}
  .ev{display:flex;gap:12px;align-items:baseline;padding:6px 0;font-size:14px;}
  .t{color:#a08; min-width:96px;color:#9a8478;font-variant-numeric:tabular-nums;}
  .cat{font-size:11px;background:#ffe9d6;color:#c2733a;border-radius:6px;padding:1px 7px;}
  .ti{flex:1;}
  .empty{color:#b3a79c;margin-top:40px;text-align:center;}
</style></head><body><h1>${esc(label)}</h1>${rows}</body></html>`;
}

function renderTimelines(data) {
  try {
    const d = data || readJson(TL_FILE(), { pet: [], cc: [] });
    fs.writeFileSync(htmlFile("pet"), renderOne("pet", "Coco 的时间轴", d.pet), "utf8");
    fs.writeFileSync(htmlFile("cc"), renderOne("cc", "我的时间轴", d.cc), "utf8");
  } catch {}
}

// point the timeline windows at the generated offline pages
function getTimelines() {
  if (!timelineEnabled()) return null;
  if (!fs.existsSync(htmlFile("pet"))) renderTimelines();
  return {
    pet: `file://${htmlFile("pet")}`, cc: `file://${htmlFile("cc")}`,
    petLabel: "Coco 的时间轴", ccLabel: "我的时间轴",
    host: null, user: null, pass: null,
  };
}

function kick() {}
function getUpdateBase() { return ""; } // local mode never auto-updates
function isConfigured() { return true; }

module.exports = { configure, start, sendReply, logEvent, logLifeEvents, getTimelines, kick, getUpdateBase, isConfigured };
