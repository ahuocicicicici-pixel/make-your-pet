const { app, BrowserWindow, ipcMain, screen, powerMonitor } = require("electron");
const fs    = require("fs");
const path  = require("path");
const state = require("./state");
const link  = require("./brain"); // adapter factory: local-brain (default) or cloud link
const screentime = require("./screentime");
const crypto = require("crypto");

// When running hot-patched code, __dirname is the patch dir; html/preload/assets
// always live in the bundled src, so anchor those paths to __BUNDLED__.
const SRC = global.__BUNDLED__ || __dirname;

// macOS transparent-window compositing fix: without this, transparent windows
// on recent macOS only composite dirty rects, leaving most of the pet invisible
// (symptom: pet flashes then vanishes, sometimes only a paw remains).
app.disableHardwareAcceleration();

// Single instance only: two copies would both poll the broker and split the
// messages (one steals the other's replies). Second launch just focuses the pet.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (petWindow && !petWindow.isDestroyed()) petWindow.show();
  });
}

let petWindow;
let panelWindow;
let chatWindow;
let wizardWindow;

function getAllWindows() {
  return [petWindow, panelWindow].filter(Boolean);
}

// ── Chat history (conversation with COCO) ─────────────────────────────────────
let chatHistory = [];
let chatPath;

function loadChat() {
  chatPath = path.join(app.getPath("userData"), "chat.json");
  try { chatHistory = JSON.parse(fs.readFileSync(chatPath, "utf8")); } catch { chatHistory = []; }
}
function saveChat() {
  try { fs.writeFileSync(chatPath, JSON.stringify(chatHistory.slice(-80))); } catch {}
}
function pushChat(role, text) {
  chatHistory.push({ role, text, ts: Date.now() });
  saveChat();
  if (chatWindow && !chatWindow.isDestroyed())
    chatWindow.webContents.send("chat:message", { role, text });
}

const CHAT_W = 260, CHAT_H = 300;
function chatAnchor() {
  const [px, py] = petWindow.getPosition();
  const [pw] = petWindow.getSize();
  return {
    x: Math.max(0, Math.round(px + pw / 2 - CHAT_W / 2)),
    y: Math.max(0, py - CHAT_H + 120), // float above the dog, tail pointing down
  };
}
function openChat(focus = true) {
  if (chatWindow && !chatWindow.isDestroyed()) {
    const { x, y } = chatAnchor();
    chatWindow.setPosition(x, y);
    focus ? chatWindow.show() : chatWindow.showInactive();
    return;
  }
  const { x, y } = chatAnchor();
  chatWindow = new BrowserWindow({
    width: CHAT_W, height: CHAT_H, x, y,
    frame: false, transparent: true, resizable: false, show: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: path.join(SRC, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });
  chatWindow.setAlwaysOnTop(true, "floating");
  chatWindow.loadFile(path.join(SRC, "chat.html"));
  chatWindow.once("ready-to-show", () => focus ? chatWindow.show() : chatWindow.showInactive());
  chatWindow.on("closed", () => { chatWindow = null; });
}

function openPanel() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close();
    return;
  }
  const [px, py] = petWindow.getPosition();
  panelWindow = new BrowserWindow({
    width: 260,
    height: 380,
    x: Math.max(0, px - 270),
    y: py + 0,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(SRC, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload reads manifest via fs
    },
  });
  panelWindow.setAlwaysOnTop(true, "floating");
  panelWindow.loadFile(path.join(SRC, "panel.html"));
  panelWindow.on("blur",   () => panelWindow?.close());
  panelWindow.on("closed", () => { panelWindow = null; });
}

function createWindow() {
  petWindow = new BrowserWindow({
    width: 230,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    title: "Coco",
    webPreferences: {
      preload: path.join(SRC, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload reads manifest via fs
    },
  });

  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setAlwaysOnTop(true, "floating");
  petWindow.loadFile(path.join(SRC, "index.html"));

  // Default: whole window is click-through; renderer toggles off on pet hover
  petWindow.setIgnoreMouseEvents(true, { forward: true });

  if (process.env.PET_DEBUG) {
    petWindow.webContents.on("dom-ready", () =>
      petWindow.webContents.executeJavaScript(
        "window.PET_DEBUG = true; window.__showHitboxes && window.__showHitboxes();"));
    petWindow.webContents.on("console-message", (_e, lvl, msg, line, src) =>
      console.log(`[renderer] ${msg}`));
  }

  petWindow.once("ready-to-show", () => {
    const { workArea } = screen.getPrimaryDisplay();
    petWindow.setPosition(
      workArea.x + workArea.width - 250,
      workArea.y + workArea.height - 320
    );
    petWindow.show();
  });
}

// ── First-run personality wizard ──────────────────────────────────────────────
// On first launch (no coco.config.json yet, not skipped), pop a few questions to
// shape the pet's personality, then write coco.config.json into userData.
const personality = require("./personality");
function userCocoConfig() { return path.join(app.getPath("userData"), "coco.config.json"); }
function wizardDoneMarker() { return path.join(app.getPath("userData"), ".wizard-done"); }
function needsWizard() {
  if (fs.existsSync(userCocoConfig())) return false;                    // 已配置
  if (fs.existsSync(path.join(SRC, "../coco.config.json"))) return false; // 打包时已内置
  if (fs.existsSync(wizardDoneMarker())) return false;                  // 用户选过"跳过"
  return true;
}
function openWizard() {
  if (wizardWindow && !wizardWindow.isDestroyed()) { wizardWindow.focus(); return; }
  wizardWindow = new BrowserWindow({
    width: 460, height: 600, title: "认识一下你的宠物",
    backgroundColor: "#fffaf6", resizable: false, autoHideMenuBar: true, alwaysOnTop: true,
    webPreferences: { preload: path.join(SRC, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  wizardWindow.loadFile(path.join(SRC, "wizard.html"));
  wizardWindow.on("closed", () => { wizardWindow = null; });
}

// ── Life timeline (COCO's own activity log → VPS dashboard) ───────────────────
// state.js hands us each activity; we normalize to ISO, clamp to one local day
// (timeline blocks must not cross midnight), and upload to COCO's timeline.
function logTimelineEvent(ev) {
  let start = ev.startMs, end = ev.endMs;
  const sd = new Date(start), ed = new Date(end);
  if (sd.toDateString() !== ed.toDateString()) {
    const m = new Date(sd); m.setHours(23, 59, 0, 0); end = m.getTime();
  }
  if (end <= start) end = start + 60_000;
  link.logEvent({
    id: `pet_${start}_${ev.categoryId}`,
    startAt: new Date(start).toISOString(),
    endAt:   new Date(end).toISOString(),
    title:   ev.title,
    note:    ev.note,
    categoryId:    ev.categoryId,
    subcategoryId: ev.subcategoryId,
  });
}

// ── Timeline dashboards (COCO's life + Cc's life) ─────────────────────────────
let timelineWindow;
function openTimeline(which) {
  const tl = link.getTimelines();
  if (!tl) return;
  const url   = which === "cc" ? tl.cc : tl.pet;
  const title = which === "cc"
    ? (tl.ccLabel  || "Cc 的生活轨迹")
    : (tl.petLabel || "COCO 的生活轨迹");
  if (timelineWindow && !timelineWindow.isDestroyed()) {
    timelineWindow.setTitle(title);
    timelineWindow.loadURL(url);
    timelineWindow.focus();
    return;
  }
  timelineWindow = new BrowserWindow({
    width: 1200, height: 840, title,
    backgroundColor: "#fffaf6", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  timelineWindow.loadURL(url);
  timelineWindow.on("closed", () => { timelineWindow = null; });
}

// Auto-fill HTTP basic auth for our own timeline host (no password prompt)
app.on("login", (event, _wc, _details, authInfo, callback) => {
  const tl = link.getTimelines();
  if (tl && authInfo && authInfo.host === tl.host && authInfo.scheme === "basic") {
    event.preventDefault();
    callback(tl.user, tl.pass);
  }
});

// One-time data migration after the app was renamed (Schnauzer Pet → Coco):
// userData path changed, so carry the old save/chat over on first launch.
function migrateOldUserData() {
  try {
    const cur = app.getPath("userData");          // .../Coco
    const base = path.dirname(cur);               // .../Application Support
    for (const oldName of ["Schnauzer Pet", "schnauzer-desktop-pet"]) {
      const old = path.join(base, oldName);
      if (old === cur) continue;
      for (const f of ["save.json", "chat.json"]) {
        const dst = path.join(cur, f), src = path.join(old, f);
        if (!fs.existsSync(dst) && fs.existsSync(src)) {
          fs.mkdirSync(cur, { recursive: true });
          fs.copyFileSync(src, dst);
        }
      }
    }
  } catch {}
}

// ── Remote hot-update (no Apple signing needed) ───────────────────────────────
// manifest.json on the VPS drives two things:
//  • patchVersion + files{name:sha256}: download core JS → apply on NEXT launch
//  • appVersion + dmgUrl: when a full rebuild (renderer/assets) is needed, COCO
//    tells the master in chat with the download link.
const UPDATE_BASE = link.getUpdateBase(); // config-driven; see link.js getUpdateBase()
const HOT_DIR = () => path.join(app.getPath("userData"), "hotpatch");
const PATCH_FILES = ["main.js", "brain.js", "link.js", "local-brain.js", "state.js", "screentime.js"];
const BUILT_PATCH = 1; // baseline this DMG ships with; bump when bundling a newer core

async function tfetch(url, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { signal: c.signal }); } finally { clearTimeout(t); }
}
function appliedPatch() { try { return Number(fs.readFileSync(path.join(HOT_DIR(), "version"), "utf8")) || BUILT_PATCH; } catch { return BUILT_PATCH; } }
function verGt(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i]||0) > (pb[i]||0)) return true; if ((pa[i]||0) < (pb[i]||0)) return false; }
  return false;
}
async function applyPatch(m) {
  const stage = path.join(HOT_DIR(), "staging");
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  for (const name of PATCH_FILES) {
    const sha = m.files[name];
    if (!sha) throw new Error("manifest missing " + name);
    const res = await tfetch(`${UPDATE_BASE}/${m.patchVersion}/${name}`);
    if (!res.ok) throw new Error("download " + name + " HTTP " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (crypto.createHash("sha256").update(buf).digest("hex") !== sha) throw new Error("sha mismatch " + name);
    fs.writeFileSync(path.join(stage, name), buf);
  }
  const cur = path.join(HOT_DIR(), "current");
  fs.rmSync(cur, { recursive: true, force: true });
  fs.renameSync(stage, cur);
  fs.writeFileSync(path.join(HOT_DIR(), "version"), String(m.patchVersion));
  console.log("[hotpatch] staged v" + m.patchVersion + " for next launch");
}
async function checkUpdates() {
  if (!UPDATE_BASE) return; // 本地模式：无更新服务器，跳过
  try {
    const m = await (await tfetch(UPDATE_BASE + "/manifest.json")).json();
    let blocked = 0; try { blocked = Number(fs.readFileSync(path.join(HOT_DIR(), "blocked"), "utf8")) || 0; } catch {}
    if (m && m.patchVersion > appliedPatch() && m.patchVersion !== blocked && m.files) {
      try { await applyPatch(m); } catch (e) { console.error("[hotpatch] apply failed:", e.message); }
    }
    if (m && m.appVersion && verGt(m.appVersion, app.getVersion())) {
      const nf = path.join(HOT_DIR(), "notified");
      let was = ""; try { was = fs.readFileSync(nf, "utf8"); } catch {}
      if (was !== m.appVersion) {
        fs.mkdirSync(HOT_DIR(), { recursive: true });
        fs.writeFileSync(nf, m.appVersion);
        const msg = `COCO 又长大啦～有新版本 v${m.appVersion} 可以更新咯！` +
          (m.dmgNote ? "（" + m.dmgNote + "）" : "") + (m.dmgUrl ? " 下载：" + m.dmgUrl : " 让主人帮你更新一下吧~");
        pushChat("coco", msg);
        if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send("pet:say", { text: "有新版本啦~", anim: "excited" });
        openChat(false);
      }
    }
  } catch {}
}

app.whenReady().then(() => {
  migrateOldUserData();
  createWindow();
  state.init(getAllWindows, logTimelineEvent);
  loadChat();
  // OpenClaw/COCO → pet speaks it (bubble + anim) and it lands in the chat log
  link.start((item) => {
    pushChat("coco", item.text);
    if (petWindow && !petWindow.isDestroyed())
      petWindow.webContents.send("pet:say", { text: item.text, anim: item.anim });
    openChat(false); // surface chat above the pet without stealing focus
  });

  // Screen Time → life timeline (needs Full Disk Access granted to this app).
  // Runs shortly after launch, then every 4h. Fails silently without FDA.
  setTimeout(() => screentime.syncScreenTime(1), 30_000);
  setInterval(() => screentime.syncScreenTime(1), 4 * 60 * 60 * 1000);

  // On wake from sleep, the long-poll connection is dead — reconnect at once
  // so chat doesn't go silent after the Mac sleeps.
  powerMonitor.on("resume", () => link.kick());
  powerMonitor.on("unlock-screen", () => link.kick());

  // Remote hot-update check: shortly after launch, then every 6h.
  setTimeout(checkUpdates, 20_000);
  setInterval(checkUpdates, 6 * 60 * 60 * 1000);

  // First-run: ask a few personality questions.
  if (needsWizard()) { console.log("[wizard] first run → opening personality wizard"); setTimeout(openWizard, 1500); }
  else console.log("[wizard] skipped (configured or already done)");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Renderer toggles click-through based on whether mouse is over pet stage
ipcMain.handle("win:setIgnoreMouse", (_e, ignore) => {
  petWindow?.setIgnoreMouseEvents(ignore, { forward: true });
});

// Custom JS drag + auto-walk: renderer sends screen-delta. Clamp the pet to its
// current display so it can never wander off-screen and get lost. Chat/panel
// follow by the ACTUAL (clamped) delta so they stay anchored.
ipcMain.handle("win:moveBy", (_e, dx, dy) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [px, py] = petWindow.getPosition();
  const [pw, ph] = petWindow.getSize();
  const wa = screen.getDisplayMatching({ x: px, y: py, width: pw, height: ph }).workArea;
  const nx = Math.max(wa.x, Math.min(wa.x + wa.width  - pw, Math.round(px + dx)));
  const ny = Math.max(wa.y, Math.min(wa.y + wa.height - ph, Math.round(py + dy)));
  const adx = nx - px, ady = ny - py;
  petWindow.setPosition(nx, ny);
  const shift = (w) => {
    if (!w || w.isDestroyed()) return;
    const [x, y] = w.getPosition();
    w.setPosition(Math.round(x + adx), Math.round(y + ady));
  };
  shift(chatWindow);
  shift(panelWindow);
});

ipcMain.handle("panel:toggle", () => openPanel());
ipcMain.handle("pet:quit",    () => app.quit());

// ── First-run wizard IPC ──────────────────────────────────────────────────────
ipcMain.handle("wizard:questions", () => personality.loadQuestions());
ipcMain.handle("wizard:submit", (_e, profile) => {
  try {
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(userCocoConfig(), "utf8")); } catch {}
    cfg = personality.applyProfile(cfg, profile || {});
    fs.writeFileSync(userCocoConfig(), JSON.stringify(cfg, null, 2) + "\n");
    if (typeof link.configure === "function") link.configure(cfg); // 即时生效，无需重启
    fs.writeFileSync(wizardDoneMarker(), new Date().toISOString());
    if (wizardWindow && !wizardWindow.isDestroyed()) wizardWindow.close();
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle("wizard:skip", () => {
  try { fs.writeFileSync(wizardDoneMarker(), new Date().toISOString()); } catch {}
  if (wizardWindow && !wizardWindow.isDestroyed()) wizardWindow.close();
  return { ok: true };
});
ipcMain.handle("timeline:open", (_e, which) => openTimeline(which));
ipcMain.handle("timeline:labels", () => {
  const tl = link.getTimelines() || {};
  return { pet: tl.petLabel || "COCO 的时间轴", self: tl.ccLabel || "我的生活轴" };
});

// ── Chat IPC ──────────────────────────────────────────────────────────────────
ipcMain.handle("chat:open",    () => openChat());
ipcMain.handle("chat:history", () => chatHistory.slice(-80));
ipcMain.handle("chat:reply",   (_e, text) => {
  const t = String(text || "").trim();
  if (!t) return { ok: false };
  pushChat("me", t);
  link.sendReply(t, petStateSummary());
  return { ok: true };
});

// Concise snapshot of the pet's current state, handed to COCO so it can answer
// "你在打工吗/ 饿不饿" with real awareness.
function petStateSummary() {
  try {
    const s = state.snap();
    const lvl = (v) => v < 25 ? "很低" : v < 50 ? "偏低" : v < 80 ? "一般" : "充足";
    const p = [
      `心情${s.mood}(${lvl(s.mood)})`,
      `饱食${s.hunger}(${s.hunger < 30 ? "饿了" : lvl(s.hunger)})`,
      `清洁${s.clean}(${s.clean < 30 ? "该洗澡了" : lvl(s.clean)})`,
      `健康${s.health}`,
      `Lv${s.level}·${s.educationName}`,
    ];
    if (s.busy) {
      const now = Date.now();
      const el = Math.max(0, Math.round((now - s.busy.startedAt) / 60000));
      const re = Math.max(0, Math.round((s.busy.endsAt - now) / 60000));
      p.push(`正在${s.busy.name}(已${el}分钟，还剩${re}分钟)`);
    } else {
      p.push("空闲中");
    }
    return p.join("，");
  } catch { return ""; }
}
