// Stable entry point (never hot-patched). Loads the core logic from the VPS
// hot-patch dir if present & valid, otherwise from the bundled src. Any failure
// loading a patch self-heals by deleting it and falling back to bundled code,
// so a bad push can never brick the app.
const { app } = require("electron");
const path = require("path");
const fs = require("fs");

const BUNDLED = __dirname;            // bundled src/ (inside the asar)
global.__BUNDLED__ = BUNDLED;        // html / preload / link.config live here

const HOT = path.join(app.getPath("userData"), "hotpatch");
const CUR = path.join(HOT, "current");
const CORE = ["main.js", "brain.js", "link.js", "local-brain.js", "state.js", "screentime.js"];

(function loadMain() {
  if (CORE.every((f) => fs.existsSync(path.join(CUR, f)))) {
    try {
      require(path.join(CUR, "main.js"));
      global.__APP_SRC__ = CUR;
      console.log("[hotpatch] running patched core from", CUR);
      return;
    } catch (e) {
      console.error("[hotpatch] patched core failed to load, reverting to bundled:", e);
      // remember the bad version so we don't keep re-downloading & re-failing it
      try {
        const bad = fs.readFileSync(path.join(HOT, "version"), "utf8").trim();
        if (bad) fs.writeFileSync(path.join(HOT, "blocked"), bad);
      } catch {}
      try { fs.rmSync(CUR, { recursive: true, force: true }); } catch {}
      try { fs.rmSync(path.join(HOT, "version"), { force: true }); } catch {}
    }
  }
  require(path.join(BUNDLED, "main.js"));
  global.__APP_SRC__ = BUNDLED;
})();
