const { ipcMain, app } = require("electron");
const fs   = require("fs");
const path = require("path");

const DECAY_PER_HOUR = { hunger: 4, clean: 2, mood: 3 };

// ── Economy: education → jobs → wages (QQ-pet style core loop) ────────────────
// 打工赚钱 → 交学费 → 毕业解锁高薪工作。心情好有工资加成，太饿/太脏/心情差会拒工。

// STAGES[education] is the stage currently being studied (education = #completed)
// Durations echo the original QQ-pet feel (work ≈ 1h, lessons ≈ 45min) but
// trimmed for a desktop companion: 15–60min shifts, 20–45min lessons.
const STAGES = [
  { name: "小学", sessions: 3, cost: 10, secs: 1200, exp: 8  }, // 20分钟/节
  { name: "中学", sessions: 4, cost: 25, secs: 1800, exp: 12 }, // 30分钟/节
  { name: "大学", sessions: 5, cost: 50, secs: 2700, exp: 18 }, // 45分钟/节
];
const EDU_NAMES = ["无学历", "小学", "中学", "大学"];

// Per-job fatigue scales with shift length; pay tuned so every job nets
// positive after replacing the consumed stats at shop prices (see
// tools/econ-sim.js — flyer ≈ +3/min up to artist ≈ +16/min).
const JOBS = [
  { id: "flyer",   name: "发传单", icon: "📢", edu: 0, secs: 900,  pay: 28,
    cost: { hunger: 10, clean: 6,  mood: 8  }, anim: "run" },                 // 15分钟
  { id: "builder", name: "搬砖工", icon: "🧱", edu: 1, secs: 1800, pay: 65,
    cost: { hunger: 16, clean: 10, mood: 13 }, anim: "work-construction" },   // 30分钟
  { id: "cook",    name: "厨师",   icon: "🍳", edu: 2, secs: 2700, pay: 110,
    cost: { hunger: 22, clean: 14, mood: 18 }, anim: "work-cook" },           // 45分钟
  { id: "guard",   name: "保安",   icon: "👮", edu: 2, secs: 2700, pay: 100,
    cost: { hunger: 22, clean: 14, mood: 18 }, anim: "work-guard" },          // 45分钟
  { id: "artist",  name: "漫画家", icon: "🎨", edu: 3, secs: 3600, pay: 175,
    cost: { hunger: 28, clean: 18, mood: 22 }, anim: "work-art" },            // 60分钟
];

const SHOP = [
  { id: "dogfood", name: "狗粮",   icon: "🦴", price: 20, hungerDelta: 20 },
  { id: "snack",   name: "小饼干", icon: "🍪", price: 10, hungerDelta: 5,  moodDelta: 8 },
  { id: "bone",    name: "大骨头", icon: "🍖", price: 45, hungerDelta: 40, moodDelta: 5 },
  { id: "shampoo", name: "香波",   icon: "🧴", price: 30, cleanDelta: 60 },
];

// Cost applied when a lesson finishes (work costs live on each job)
const STUDY_COST = { hunger: 12, clean: 0, mood: 12 };

const MOOD_BONUS_AT = 80;    // mood ≥ 80 → wage ×1.3
const MOOD_BONUS_MULT = 1.3;

const DEFAULTS = {
  hunger: 80, clean: 80, mood: 80, health: 100,
  coins: 50, level: 1, exp: 0,
  education: 0,        // completed stages: 0=无 1=小学 2=中学 3=大学
  eduSessions: 0,      // lessons finished toward the NEXT stage
  busy: null,          // { type:'work'|'study', id, name, anim, startedAt, endsAt }
  inventory: [
    { id: "dogfood", name: "狗粮",   count: 3, hungerDelta: 20 },
    { id: "snack",   name: "小饼干", count: 5, hungerDelta: 5, moodDelta: 8 },
    { id: "shampoo", name: "香波",   count: 1, cleanDelta: 60 },
  ],
  lastTickAt: null,
};

let savePath;
let state = {};
let getWindows = () => [];
let busyTimer = null;
let onEvent = null; // life-timeline sink, set by main.js

// Report a life event to COCO's own life timeline (打工/上学/吃饭/洗澡/玩耍).
// startMs/endMs are wall-clock ms; main.js converts + clamps + uploads.
function logActivity(ev) { try { onEvent && onEvent(ev); } catch {} }

function load() {
  savePath = path.join(app.getPath("userData"), "save.json");
  try {
    state = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(savePath, "utf8")) };
  } catch {
    state = { ...DEFAULTS, lastTickAt: new Date().toISOString() };
  }

  // Offline catch-up at half decay rate
  if (state.lastTickAt) {
    const hours = (Date.now() - new Date(state.lastTickAt)) / 3_600_000;
    if (hours > 0.05) applyDecay(hours * 0.5);
  }
  state.lastTickAt = new Date().toISOString();

  // Busy across restarts: settle if already finished, else resume the timer
  if (state.busy) {
    if (Date.now() >= state.busy.endsAt) settleBusy({ silent: true });
    else scheduleBusyEnd();
  }
  save();
}

function save() {
  try {
    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    const tmp = savePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, savePath);
  } catch {}
}

function applyDecay(hours) {
  state.hunger = Math.max(0, state.hunger - DECAY_PER_HOUR.hunger * hours);
  state.clean  = Math.max(0, state.clean  - DECAY_PER_HOUR.clean  * hours);
  const moodMult = (state.hunger < 30 || state.clean < 30) ? 2 : 1;
  state.mood   = Math.max(0, state.mood   - DECAY_PER_HOUR.mood * hours * moodMult);
  if (state.hunger <= 0 || state.clean <= 0) {
    state.health = Math.max(0, state.health - 2 * hours);
  } else if (state.hunger > 50 && state.clean > 50 && state.mood > 50) {
    state.health = Math.min(100, state.health + 5 * hours);
  }
}

function checkLevelUp() {
  const needed = Math.round(100 * Math.pow(1.4, state.level - 1));
  if (state.exp >= needed) { state.level++; state.exp -= needed; }
}

function snap() {
  const nextStage = state.education < STAGES.length ? STAGES[state.education] : null;
  return {
    hunger:   Math.round(state.hunger),
    clean:    Math.round(state.clean),
    mood:     Math.round(state.mood),
    health:   Math.round(state.health),
    coins:    state.coins,
    level:    state.level,
    exp:      state.exp,
    expNext:  Math.round(100 * Math.pow(1.4, state.level - 1)),
    inventory: state.inventory.map(i => ({ ...i })),

    education:     state.education,
    educationName: EDU_NAMES[state.education],
    eduSessions:   state.eduSessions,
    nextStage:     nextStage ? { ...nextStage } : null,
    busy:          state.busy ? { ...state.busy } : null,
    moodBonus:     state.mood >= MOOD_BONUS_AT,
    jobs: JOBS.map(j => ({
      ...j,
      locked: j.edu > state.education,
      lockText: j.edu > state.education ? `需${EDU_NAMES[j.edu]}毕业` : null,
    })),
    shop: SHOP.map(s => ({ ...s })),
  };
}

function broadcast() {
  const data = snap();
  for (const w of getWindows()) {
    if (w && !w.isDestroyed()) w.webContents.send("state:updated", data);
  }
}

// Tell the pet window to act (animation + bubble)
function emitAction(name, extra = {}) {
  for (const w of getWindows()) {
    if (w && !w.isDestroyed()) w.webContents.send("pet:action", { name, ...extra });
  }
}

// ── Busy (work / study) ───────────────────────────────────────────────────────

// Why the pet refuses to start: care for it first (the QQ-pet friction loop)
function refuseReason() {
  if (state.busy)        return { reason: "busy",   text: "已经在忙啦" };
  if (state.health < 30) return { reason: "sick",   text: "🤒 生病了要休息…" };
  if (state.hunger < 20) return { reason: "hungry", text: "🍖 饿得没力气，先吃饭！" };
  if (state.clean  < 20) return { reason: "dirty",  text: "🛁 脏兮兮的，先洗澡！" };
  if (state.mood   < 25) return { reason: "grumpy", text: "😤 哼，今天不想干活！" };
  return null;
}

function scheduleBusyEnd() {
  clearTimeout(busyTimer);
  const remain = Math.max(0, state.busy.endsAt - Date.now());
  busyTimer = setTimeout(() => settleBusy(), remain);
}

function settleBusy({ silent = false } = {}) {
  const b = state.busy;
  if (!b) return;
  state.busy = null;
  clearTimeout(busyTimer);

  if (b.type === "work") {
    const job = JOBS.find(j => j.id === b.id);
    const bonus = state.mood >= MOOD_BONUS_AT;
    const pay = Math.round(job.pay * (bonus ? MOOD_BONUS_MULT : 1));
    state.coins += pay;
    state.hunger = Math.max(0, state.hunger - job.cost.hunger);
    state.clean  = Math.max(0, state.clean  - job.cost.clean);
    state.mood   = Math.max(0, state.mood   - job.cost.mood);
    state.exp   += Math.round(pay / 2);
    checkLevelUp();
    save();
    logActivity({
      startMs: b.startedAt, endMs: b.endsAt,
      title: job.name, categoryId: "work", subcategoryId: "work.other",
      note: `COCO 去${job.name}打工，赚了 ${pay} 金币${bonus ? "（心情好有加成）" : ""}，有点累。`,
    });
    if (!silent) {
      broadcast();
      emitAction("busy-done", {
        bubble: bonus ? `💰 +${pay}金币(心情加成!)` : `💰 +${pay}金币`,
      });
    }
    return;
  }

  // study
  const stage = STAGES[state.education];
  state.eduSessions++;
  state.hunger = Math.max(0, state.hunger - STUDY_COST.hunger);
  state.mood   = Math.max(0, state.mood   - STUDY_COST.mood);
  state.exp   += stage.exp;
  let bubble = `📖 学完一课! (${state.eduSessions}/${stage.sessions})`;
  let graduated = false;
  if (state.eduSessions >= stage.sessions) {
    state.education++;
    state.eduSessions = 0;
    bubble = `🎓 ${stage.name}毕业啦!!`;
    graduated = true;
  }
  checkLevelUp();
  save();
  logActivity({
    startMs: b.startedAt, endMs: b.endsAt,
    title: graduated ? `${stage.name}毕业` : `${stage.name}上课`,
    categoryId: "study", subcategoryId: "study.course",
    note: graduated ? `COCO 念完了${stage.name}，毕业啦！🎓` : `COCO 去上${stage.name}的课，认真学习中。`,
  });
  if (!silent) {
    broadcast();
    emitAction("busy-done", { bubble, graduate: bubble.startsWith("🎓") });
  }
}

function startBusy(type, payload) {
  const no = refuseReason();
  if (no) return { ok: false, ...no };

  let busy;
  if (type === "work") {
    const job = JOBS.find(j => j.id === payload);
    if (!job) return { ok: false, reason: "no_job" };
    if (job.edu > state.education) {
      return { ok: false, reason: "locked", text: `要${EDU_NAMES[job.edu]}毕业才能干这个` };
    }
    busy = { type, id: job.id, name: job.name, anim: job.anim,
             startedAt: Date.now(), endsAt: Date.now() + job.secs * 1000 };
  } else {
    if (state.education >= STAGES.length) {
      return { ok: false, reason: "max_edu", text: "已经是大学毕业生啦 🎓" };
    }
    const stage = STAGES[state.education];
    if (state.coins < stage.cost) {
      return { ok: false, reason: "poor", text: `学费要${stage.cost}金币，先去打工吧` };
    }
    state.coins -= stage.cost;
    busy = { type, id: state.education, name: `${stage.name}上课`, anim: "study",
             startedAt: Date.now(), endsAt: Date.now() + stage.secs * 1000 };
  }

  state.busy = busy;
  scheduleBusyEnd();
  save();
  broadcast();
  emitAction("busy-start", {
    anim: busy.anim,
    bubble: type === "work" ? `${busy.name}，开工! 💪` : "上课去啦~ 📚",
  });
  return { ok: true };
}

function init(getWins, eventSink) {
  getWindows = getWins;
  onEvent = eventSink || null;
  load();

  // Tick every 60s
  setInterval(() => {
    applyDecay(1 / 60);
    state.lastTickAt = new Date().toISOString();
    save();
    broadcast();
  }, 60_000);

  ipcMain.handle("state:get", () => snap());

  ipcMain.handle("state:feed", (_e, itemId) => {
    if (state.busy) return { ok: false, reason: "busy" };
    const item = state.inventory.find(i => i.id === itemId);
    if (!item || item.count <= 0) return { ok: false, reason: "no_item" };
    if (state.hunger >= 95)       return { ok: false, reason: "full" };
    item.count--;
    state.hunger = Math.min(100, state.hunger + (item.hungerDelta || 20));
    if (item.moodDelta) state.mood = Math.min(100, state.mood + item.moodDelta);
    state.exp += 5;
    checkLevelUp();
    save();
    broadcast();
    emitAction("eat");
    logActivity({
      startMs: Date.now() - 10 * 60000, endMs: Date.now(),
      title: "吃饭", categoryId: "life", subcategoryId: "life.meal",
      note: `主人喂 COCO 吃了${item.name}，香喷喷~`,
    });
    return { ok: true };
  });

  ipcMain.handle("state:bath", () => {
    if (state.busy) return { ok: false, reason: "busy" };
    const shampoo = state.inventory.find(i => i.id === "shampoo");
    if (!shampoo || shampoo.count <= 0) return { ok: false, reason: "no_shampoo" };
    shampoo.count--;
    state.clean  = Math.min(100, state.clean  + 60);
    state.mood   = Math.min(100, state.mood   + 5);
    state.exp   += 8;
    checkLevelUp();
    save();
    broadcast();
    emitAction("bath");
    logActivity({
      startMs: Date.now() - 12 * 60000, endMs: Date.now(),
      title: "洗澡", categoryId: "life", subcategoryId: "life.hygiene",
      note: "主人给 COCO 洗了个香香的澡，干净又蓬松。",
    });
    return { ok: true };
  });

  ipcMain.handle("state:play", () => {
    if (state.busy) return { ok: false, reason: "busy" };
    state.mood   = Math.min(100, state.mood + 10);
    state.clean  = Math.max(0, state.clean - 5);
    state.hunger = Math.max(0, state.hunger - 3); // exercise → hungry (caps free mood farming)
    state.exp   += 5;
    checkLevelUp();
    save();
    broadcast();
    emitAction("play-ball");
    logActivity({
      startMs: Date.now() - 15 * 60000, endMs: Date.now(),
      title: "玩耍", categoryId: "entertainment", subcategoryId: "entertainment.game",
      note: "陪主人玩了会儿球，开心得尾巴都甩飞啦！",
    });
    return { ok: true };
  });

  ipcMain.handle("state:work",  (_e, jobId) => startBusy("work", jobId));
  ipcMain.handle("state:study", ()          => startBusy("study"));

  ipcMain.handle("state:buy", (_e, itemId) => {
    const goods = SHOP.find(s => s.id === itemId);
    if (!goods) return { ok: false, reason: "no_goods" };
    if (state.coins < goods.price) return { ok: false, reason: "poor", text: "金币不够，去打工吧!" };
    state.coins -= goods.price;
    let item = state.inventory.find(i => i.id === itemId);
    if (item) item.count++;
    else {
      const { price, icon, ...rest } = goods;
      state.inventory.push({ ...rest, count: 1 });
    }
    save();
    broadcast();
    return { ok: true };
  });
}

module.exports = { init, snap };
