// ── Animation manifest (delivery contract → playback config) ──────────────────
const MANIFEST = window.petApi.getManifest();
const ANIM     = MANIFEST ? MANIFEST.animations : { idle: { frames: 6, fps: 4, loop: true } };
const FRAME_DIR = "../assets/anim"; // relative to src/index.html

const framePath = (id, i) =>
  `${FRAME_DIR}/${id}/frame_${String(i).padStart(2, "0")}.png`;

// ── Legacy sprite-sheet fallback (used until per-frame PNGs are delivered) ─────
// Keeps the pet alive/animated today; each anim auto-upgrades to crisp PNGs
// the moment its assets/anim/<id>/ folder is filled.
const LEGACY_FALLBACK = {
  idle: { row: 0, frames: 6 }, walk: { row: 1, frames: 8 }, run: { row: 1, frames: 8 },
  greet: { row: 3, frames: 4 }, happy: { row: 4, frames: 5 }, "belly-rub": { row: 4, frames: 5 },
  excited: { row: 4, frames: 5 }, love: { row: 3, frames: 4 }, lick: { row: 3, frames: 4 },
  "shake-paw": { row: 3, frames: 4 }, wink: { row: 3, frames: 4 }, "chase-tail": { row: 2, frames: 8 },
  angry: { row: 5, frames: 8 }, sad: { row: 5, frames: 8 }, cry: { row: 5, frames: 8 },
  "head-pat": { row: 6, frames: 6 }, "look-around": { row: 6, frames: 6 }, think: { row: 6, frames: 6 },
  bored: { row: 6, frames: 6 }, dizzy: { row: 6, frames: 6 }, eat: { row: 7, frames: 6 },
  work: { row: 7, frames: 6 }, study: { row: 7, frames: 6 }, bath: { row: 7, frames: 6 },
  "work-construction": { row: 7, frames: 6 }, "work-cook": { row: 7, frames: 6 },
  "work-guard": { row: 7, frames: 6 }, "work-art": { row: 7, frames: 6 },
  levelup: { row: 4, frames: 5 }, "play-ball": { row: 4, frames: 5 },
};
function legacyOf(id) { return LEGACY_FALLBACK[id] || LEGACY_FALLBACK.idle; }

// ── Hitbox zones ──────────────────────────────────────────────────────────────
// Normalized 0-1 over the .pet box (250×270). The dog is FRONT-FACING and roughly
// symmetric, so zones tile a central column (head→face→vest→paws) with the two
// furry flanks as side zones. Coords account for the 512² art being drawn
// `contain` (≈250×250) anchored to the box bottom. First match wins, so the
// central zones take priority over the flanks where they overlap.
const HITBOXES = [
  { id: "head",  x1: 0.37, y1: 0.12, x2: 0.71, y2: 0.30, action: "head-pat",
    bubbles: ["摸摸~", "呜呜~", "好舒服~"] },
  { id: "face",  x1: 0.41, y1: 0.30, x2: 0.70, y2: 0.50, action: "lick",
    bubbles: ["❤️ 亲亲~", "汪!", "嘻嘻~"] },
  { id: "belly", x1: 0.37, y1: 0.50, x2: 0.71, y2: 0.72, action: "belly-rub",
    bubbles: ["哈哈哈~", "挠痒痒!", "嘻嘻~"] },
  { id: "sideL", x1: 0.20, y1: 0.40, x2: 0.37, y2: 0.72, action: "love",
    bubbles: ["再顺顺~", "好舒服~", "💫"] },
  { id: "sideR", x1: 0.71, y1: 0.40, x2: 0.84, y2: 0.72, action: "love",
    bubbles: ["蹭蹭~", "好舒服~", "嘿嘿~"] },
  { id: "paw",   x1: 0.32, y1: 0.72, x2: 0.76, y2: 0.95, action: "shake-paw",
    bubbles: ["汪!", "握握手~", "🐾"] },
];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const pet         = document.getElementById("pet");
const stage       = document.getElementById("stage");
const bubbleEl    = document.getElementById("bubble");
const ctxMenu     = document.getElementById("ctx-menu");
const statusBadge = document.getElementById("status-badge");

// ── Animation engine (per-frame PNG with sprite-sheet fallback) ───────────────
let curState  = "idle";
let animTimer = null;
let playToken = 0;          // cancels stale async upgrades
const probed  = {};         // id -> boolean (frames exist?)
const loaded  = {};         // id -> boolean (frames preloaded?)

function probe(id) {
  if (id in probed) return Promise.resolve(probed[id]);
  return new Promise((res) => {
    const img = new Image();
    img.onload  = () => { probed[id] = true;  res(true);  };
    img.onerror = () => { probed[id] = false; res(false); };
    img.src = framePath(id, 0);
  });
}

// Each animation's frames are kept as decoded <img> nodes and swapped by
// toggling opacity — no background-image replacement, so no per-frame flash.
const frameCache = {}; // id -> [HTMLImageElement]

function getFrameImgs(id, n) {
  if (frameCache[id]) return frameCache[id];
  const imgs = Array.from({ length: n }, (_, i) => {
    const im = new Image();
    im.className = "frame";
    im.draggable = false;
    im.src = framePath(id, i);
    return im;
  });
  frameCache[id] = imgs;
  return imgs;
}

function preload(id, n) {
  if (loaded[id]) return Promise.resolve();
  const imgs = getFrameImgs(id, n);
  return Promise.all(imgs.map((im) =>
    im.decode ? im.decode().catch(() => {}) :
      new Promise((res) => { im.onload = im.onerror = res; })
  )).then(() => { loaded[id] = true; });
}

function runLoop(frames, fps, loop, opts, render) {
  let f = 0, dir = 1, cycles = 0;
  render(0);
  animTimer = setInterval(() => {
    // Yoyo: ping-pong 0→…→last→…→0 for smooth swaying (no hard loop snap)
    if (opts.yoyo) {
      f += dir;
      if      (f >= frames - 1) { f = frames - 1; dir = -1; }
      else if (f <= 0)          { f = 0;          dir =  1; }
      render(f);
      return;
    }
    f++;
    if (f >= frames) {
      cycles++;
      // opts.cycles caps a looping anim to N plays then settles to idle —
      // used for one-shot actions (eat/bath) whose manifest loop is true.
      const keepGoing = (loop || opts.loop) && !(opts.cycles && cycles >= opts.cycles);
      if (keepGoing) { f = 0; }
      else { clearInterval(animTimer); opts.onDone?.(); play("idle"); return; }
    }
    render(f);
  }, 1000 / fps);
}

// Sprite-sheet geometry (schnauzer-cute.webp = 8 cols × 9 rows of 192×208 cells)
const SHEET_COLS = 8;
const SHEET_ROWS = 9;

// One persistent <img> reused across frames — swapping its src (to an already
// decoded, cached frame) is instant: no flash, and a single layer can't ghost.
const frameView = new Image();
frameView.className = "frame on";
frameView.draggable = false;

function startFrames(id, a, opts, token) {
  if (token !== playToken) return;
  clearInterval(animTimer);
  pet.classList.remove("sheet");
  pet.style.backgroundImage = "none";
  const imgs = getFrameImgs(id, a.frames);   // decoded cache
  if (pet.firstChild !== frameView) pet.replaceChildren(frameView);
  runLoop(a.frames, opts.fps || a.fps, a.loop, opts, (f) => {
    frameView.src = imgs[f].src;
  });
}

function startSheet(id, a, opts, token) {
  if (token !== playToken) return;
  clearInterval(animTimer);
  const lg  = legacyOf(id);
  const fps = opts.fps || a.fps || 5;
  pet.replaceChildren();                      // drop any frame <img> layers
  pet.classList.add("sheet");
  pet.style.backgroundImage = `url("../assets/schnauzer-cute.webp")`;
  // Scale ONE cell to fill the fixed 250×270 box — element is never resized,
  // which avoids the macOS transparent-window blank-on-resize glitch.
  pet.style.backgroundSize = `${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%`;
  runLoop(lg.frames, fps, a.loop, opts, (f) => {
    const col = Math.min(f, SHEET_COLS - 1);
    pet.style.backgroundPosition =
      `${(col / (SHEET_COLS - 1)) * 100}% ${(lg.row / (SHEET_ROWS - 1)) * 100}%`;
  });
}

function play(name, opts = {}) {
  const a = ANIM[name] || ANIM.idle;
  curState = name;
  const token = ++playToken;

  if (loaded[name])         return startFrames(name, a, opts, token);
  if (probed[name] === false) return startSheet(name, a, opts, token);

  // Unknown: show fallback now, probe+preload, upgrade to crisp frames if available
  startSheet(name, a, opts, token);
  probe(name).then((ok) => {
    if (!ok || token !== playToken) return;
    preload(name, a.frames).then(() => {
      if (token === playToken) startFrames(name, a, opts, token);
    });
  });
}

// ── Bubble ────────────────────────────────────────────────────────────────────
let bubbleTimer = null;

function showBubble(text, ms = 2400, wrap = false) {
  clearTimeout(bubbleTimer);
  bubbleEl.textContent = text;
  bubbleEl.classList.toggle("wrap", wrap || text.length > 12);
  bubbleEl.classList.add("show");
  bubbleTimer = setTimeout(() => bubbleEl.classList.remove("show"), ms);
}

// ── Hitbox detection ──────────────────────────────────────────────────────────
function getZone(nx, ny) {
  for (const z of HITBOXES) {
    if (nx >= z.x1 && nx <= z.x2 && ny >= z.y1 && ny <= z.y2) return z;
  }
  return null;
}

// ── Click impatience / rage ───────────────────────────────────────────────────
const COOLDOWN_MS = 60_000;
const ANNOY_AT    = 3;
const RAGE_AT     = 8;
const cooldowns   = {};

const BUSY_BUBBLES = ["💼 上班呢，别闹~", "等我下班嘛", "认真工作中…"];
const STUDY_BUBBLES = ["📖 上课呢，嘘~", "认真听讲中…", "下课再玩~"];

function busyDeflect() {
  const pool = petState?.busy?.type === "study" ? STUDY_BUBBLES : BUSY_BUBBLES;
  showBubble(pool[Math.floor(Math.random() * pool.length)]);
}

function fireZone(zone) {
  if (petState?.busy) return busyDeflect();
  const now = Date.now();
  const cd  = cooldowns[zone.id] || { n: 0, t: 0 };
  if (now - cd.t > COOLDOWN_MS) cd.n = 0;
  cd.n++;
  cd.t = now;
  cooldowns[zone.id] = cd;

  if (cd.n >= RAGE_AT) {
    cd.n = 0;
    play("angry");
    showBubble("😤 够了！", 3000);
    setTimeout(() => { if (!isWalking) walk(Math.random() < 0.5 ? -1 : 1); }, 1200);
    return;
  }
  if (cd.n >= ANNOY_AT) {
    play("look-around");
    showBubble("🙄 ...");
    return;
  }
  play(zone.action);
  showBubble(zone.bubbles[Math.floor(Math.random() * zone.bubbles.length)]);
}

function fireGeneric() {
  if (petState?.busy) return busyDeflect();
  const picks = ["汪!", "?", "🐾", "嗯?"];
  play("happy");
  showBubble(picks[Math.floor(Math.random() * picks.length)]);
}

// ── State snapshot & visual updates ──────────────────────────────────────────
let petState = null;

function applyStateVisuals(s) {
  petState = s;
  // Resume the busy animation if the app (re)started mid-shift
  if (s.busy && curState !== s.busy.anim) {
    play(s.busy.anim, { loop: true, fps: 4 });
  }
  // Badge: busy first, then worst condition
  if (s.busy) {
    statusBadge.textContent = s.busy.type === "work" ? "💼" : "📖";
    statusBadge.classList.remove("hidden");
  } else if (s.clean < 30) {
    statusBadge.textContent = "💩";
    statusBadge.classList.remove("hidden");
  } else if (s.hunger < 30) {
    statusBadge.textContent = "🍖";
    statusBadge.classList.remove("hidden");
  } else if (s.mood < 30) {
    statusBadge.textContent = "😢";
    statusBadge.classList.remove("hidden");
  } else {
    statusBadge.classList.add("hidden");
  }
}

window.petApi.onStateUpdated(applyStateVisuals);
window.petApi.getState().then(applyStateVisuals);

// Actions pushed from main: feed/bath/play + work/study start & finish.
// Payload: { name, anim?, bubble?, graduate? }
const ACTION_BUBBLE = {
  eat: "🍖 好吃!", bath: "🛁 搓搓~", "play-ball": "🎾 接住啦!",
};
// eat/bath loop in the manifest (ambient states); when triggered by a panel
// action, cap them to a few slower cycles so they finish and settle to idle.
const ACTION_OPTS = {
  eat:  { fps: 5, cycles: 3 },
  bath: { fps: 5, cycles: 3 },
};
window.petApi.onPetAction((a) => {
  if (a.name === "busy-start") {
    play(a.anim, { loop: true, fps: 4 });
    if (a.bubble) showBubble(a.bubble, 2800);
    return;
  }
  if (a.name === "busy-done") {
    play(a.graduate ? "levelup" : "happy");
    if (a.bubble) showBubble(a.bubble, 3500);
    return;
  }
  if (isWalking) return;
  play(a.name, ACTION_OPTS[a.name] || {});
  if (ACTION_BUBBLE[a.name]) showBubble(ACTION_BUBBLE[a.name]);
});

// COCO speaks (pushed from OpenClaw via the link): bubble + attention anim.
// The full text also shows in the chat window (opened by main).
window.petApi.onPetSay((m) => {
  const text = typeof m === "string" ? m : m.text;
  const anim = (typeof m === "object" && m.anim) ? m.anim : "greet";
  if (!isWalking && !petState?.busy) play(anim);
  showBubble(text, 9000, true);
});

// ── Drag vs click ─────────────────────────────────────────────────────────────
let dragOrigin    = null;  // { sx, sy } screen coords at mousedown
let isDragging    = false;
let clickNorm     = null;  // { nx, ny } normalized click pos on pet (0-1)
let lastClickTime = 0;     // for double-click detection

stage.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  dragOrigin = { sx: e.screenX, sy: e.screenY };
  isDragging = false;

  // Capture normalized position on pet for hit detection
  const r = pet.getBoundingClientRect();
  if (e.clientX >= r.left && e.clientX <= r.right &&
      e.clientY >= r.top  && e.clientY <= r.bottom) {
    clickNorm = {
      nx: (e.clientX - r.left) / r.width,
      ny: (e.clientY - r.top)  / r.height,
    };
  } else {
    clickNorm = null; // clicked stage area outside pet body
  }
});

document.addEventListener("mousemove", (e) => {
  if (!dragOrigin) return;
  const dx = e.screenX - dragOrigin.sx;
  const dy = e.screenY - dragOrigin.sy;
  if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    isDragging = true;
    play("drag", { loop: true, yoyo: true, fps: 4 }); // gentle dangling sway
  }
  if (isDragging) {
    window.petApi.moveBy(dx, dy);
    dragOrigin = { sx: e.screenX, sy: e.screenY };
  }
});

document.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || !dragOrigin) return;
  const wasDrag = isDragging;

  if (!isDragging) {
    const now   = Date.now();
    const isDbl = now - lastClickTime < 300;
    lastClickTime = now;

    if (isDbl) {
      // Double-click → open chat with COCO (above the pet)
      window.petApi.openChat();
    } else if (clickNorm) {
      const z = getZone(clickNorm.nx, clickNorm.ny);
      if (z) fireZone(z);
      else   fireGeneric();
    }
    ctxMenu.classList.add("hidden");
  }

  dragOrigin = null;
  isDragging = false;
  clickNorm  = null;

  // Dropped after a drag → settle back to idle (or resume work/study)
  if (wasDrag) {
    if (petState?.busy) play(petState.busy.anim, { loop: true, fps: 4 });
    else play("idle");
    // Re-enable click-through if drag ended outside stage
    const r = stage.getBoundingClientRect();
    const over = e.clientX >= r.left && e.clientX <= r.right &&
                 e.clientY >= r.top  && e.clientY <= r.bottom;
    if (!over) window.petApi.setIgnoreMouse(true);
  }
});

// ── Click-through toggle ──────────────────────────────────────────────────────
// forward:true means mousemove is still received while click-through is on,
// so mouseenter fires when mouse drifts over stage → we disable click-through.
stage.addEventListener("mouseenter", () => window.petApi.setIgnoreMouse(false));
stage.addEventListener("mouseleave", () => {
  if (!dragOrigin && ctxMenu.classList.contains("hidden")) {
    window.petApi.setIgnoreMouse(true);
  }
});

// Keep click-through off while context menu is open
ctxMenu.addEventListener("mouseenter", () => window.petApi.setIgnoreMouse(false));
ctxMenu.addEventListener("mouseleave", () => {
  if (!dragOrigin) window.petApi.setIgnoreMouse(true);
});

// ── Right-click context menu ──────────────────────────────────────────────────
stage.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  ctxMenu.style.left = `${Math.min(e.clientX, 200)}px`;
  ctxMenu.style.top  = `${Math.max(e.clientY - 184, 4)}px`;
  ctxMenu.classList.remove("hidden");
});
document.getElementById("ctx-chat").addEventListener("click", () => {
  window.petApi.openChat();
  ctxMenu.classList.add("hidden");
});
document.getElementById("ctx-panel").addEventListener("click", () => {
  window.petApi.togglePanel();
  ctxMenu.classList.add("hidden");
});
document.getElementById("ctx-tl-pet").addEventListener("click", () => {
  window.petApi.openTimeline("pet");
  ctxMenu.classList.add("hidden");
});
document.getElementById("ctx-tl-cc").addEventListener("click", () => {
  window.petApi.openTimeline("cc");
  ctxMenu.classList.add("hidden");
});
// Per-person menu labels (Mark vs Cc) come from link.config.json
window.petApi.timelineLabels().then((l) => {
  if (!l) return;
  document.getElementById("ctx-tl-pet").textContent = `📈 ${l.pet}`;
  document.getElementById("ctx-tl-cc").textContent  = `📅 ${l.self}`;
}).catch(() => {});
document.getElementById("ctx-quit").addEventListener("click", () => window.petApi.quit());
document.addEventListener("click", (e) => {
  if (!ctxMenu.contains(e.target)) ctxMenu.classList.add("hidden");
});

// ── Auto walk ─────────────────────────────────────────────────────────────────
let isWalking = false;

async function walk(dir) {
  if (isWalking) return;
  isWalking = true;
  play("walk", { loop: true });
  pet.classList.toggle("flip", dir < 0); // mirror for left-facing
  for (let i = 0; i < 24; i++) {
    window.petApi.moveBy(dir * 7, Math.sin(i / 2) * 0.7);
    await new Promise((r) => setTimeout(r, 65));
  }
  pet.classList.remove("flip");
  isWalking = false;
  play("idle");
}

// ── Idle auto-behaviors ───────────────────────────────────────────────────────
setInterval(() => {
  if (curState !== "idle" || isWalking || petState?.busy) return;

  // State-driven moods: when a stat is low, the pet acts it out (not just a badge)
  const s = petState;
  if (s) {
    if (s.health < 40 && Math.random() < 0.6) return play("sick");
    if (s.hunger < 30 && Math.random() < 0.55) return play("hungry");
    if (s.clean  < 30 && Math.random() < 0.55) return play("dirty");
  }

  const r = Math.random();
  if      (r < 0.16) play("greet");
  else if (r < 0.30) play("happy");
  else if (r < 0.42) play("look-around");
  else if (r < 0.50) play("blink");
  else if (r < 0.56) play("chase-tail"); // no tail to click on a front pose; idle-only
  else if (r < 0.64) play("sleep");      // occasional nap
  else if (r < 0.74) walk(Math.random() < 0.5 ? -1 : 1);
}, 20_000);

// ── Hitbox debug overlay (press "h" to toggle) ───────────────────────────────
let hbOverlay = null;
const ZONE_COLORS = {
  head: "#e53e3e", face: "#dd6b20", belly: "#805ad5",
  sideL: "#3182ce", sideR: "#38a169", paw: "#d53f8c",
};
function toggleHitboxOverlay() {
  if (hbOverlay) { hbOverlay.remove(); hbOverlay = null; return; }
  stage.style.position = "relative";
  hbOverlay = document.createElement("div");
  hbOverlay.style.cssText =
    "position:absolute;inset:0;pointer-events:none;z-index:50;";
  for (const z of HITBOXES) {
    const d = document.createElement("div");
    const c = ZONE_COLORS[z.id] || "#000";
    d.style.cssText =
      `position:absolute;left:${z.x1 * 100}%;top:${z.y1 * 100}%;` +
      `width:${(z.x2 - z.x1) * 100}%;height:${(z.y2 - z.y1) * 100}%;` +
      `border:1.5px solid ${c};background:${c}33;box-sizing:border-box;` +
      `font:9px sans-serif;color:${c};padding:1px 2px;`;
    d.textContent = z.id;
    hbOverlay.appendChild(d);
  }
  stage.appendChild(hbOverlay);
}
window.addEventListener("keydown", (e) => {
  if (e.key === "h" || e.key === "H") toggleHitboxOverlay();
});
// Called by main in PET_DEBUG mode so zones are visible without keyboard focus
window.__showHitboxes = () => { if (!hbOverlay) toggleHitboxOverlay(); };

// ── Init ──────────────────────────────────────────────────────────────────────
play("idle");
