// COCO link — two-way channel client (main process).
// Long-polls the VPS broker for things to say, and posts the master's replies.
const fs   = require("fs");
const path = require("path");

let cfg = null;
try {
  const SRC = global.__BUNDLED__ || __dirname;
  cfg = JSON.parse(fs.readFileSync(path.join(SRC, "../link.config.json"), "utf8"));
} catch { cfg = null; }

let running = false;
let onSayCb = null;
let currentCtrl = null; // in-flight long-poll, so we can abort on wake

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch with a hard timeout so a sleep/network stall can't hang a call forever
async function tfetch(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

async function pullLoop() {
  while (running) {
    try {
      // Hard timeout: a long-poll fetch interrupted by system sleep / network
      // drop can hang forever (never resolves nor rejects), freezing the loop
      // and silently killing chat. AbortController guarantees we recover.
      const ctrl = new AbortController();
      currentCtrl = ctrl;
      const timer = setTimeout(() => ctrl.abort(), 35000); // wait=25 + buffer
      let res;
      try {
        res = await fetch(`${cfg.base}/pull?wait=25`, {
          headers: { Authorization: `Bearer ${cfg.token}` },
          signal: ctrl.signal,
        });
      } finally { clearTimeout(timer); }
      if (!res.ok) { await sleep(3000); continue; }
      const data = await res.json();
      if (data?.ok && Array.isArray(data.items)) {
        for (const it of data.items) onSayCb?.(it);
      }
    } catch {
      await sleep(3000); // offline / VPS down / aborted → back off, keep trying
    }
  }
}

async function sendReply(text, petState) {
  if (!cfg) return false;
  try {
    const res = await tfetch(`${cfg.base}/reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify({ text, petState }),
    });
    return res.ok;
  } catch { return false; }
}

// Report one life event (打工/上学/吃饭/洗澡/玩耍…) to COCO's own timeline.
async function logEvent(event) {
  if (!cfg) return false;
  try {
    const res = await tfetch(`${cfg.base}/event`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify({ event }),
    });
    return res.ok;
  } catch { return false; }
}

function getTimelines() { return cfg?.timeline || null; }

// Report real-life events (e.g. screen-time usage) to the PERSON's life timeline.
async function logLifeEvents(events) {
  if (!cfg || !Array.isArray(events) || !events.length) return false;
  try {
    const res = await tfetch(`${cfg.base}/life-event`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify({ events }),
    });
    return res.ok;
  } catch { return false; }
}

function start(onSay) {
  if (!cfg || running) return false;
  onSayCb = onSay;
  running = true;
  pullLoop();
  return true;
}

// Abort the in-flight long-poll so pullLoop reconnects immediately (e.g. on wake).
function kick() { try { currentCtrl?.abort(); } catch {} }

// Remote-update server root. Empty = auto-update disabled (the open-source
// default). Set cfg.updateBase (or COCO_UPDATE_BASE) only if you run your own
// VPS patch server.
function getUpdateBase() {
  return process.env.COCO_UPDATE_BASE || (cfg && cfg.updateBase) || "";
}

module.exports = { start, sendReply, logEvent, logLifeEvents, getTimelines, kick, getUpdateBase, isConfigured: () => !!cfg };
