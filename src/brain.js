// brain.js — adapter factory.
// Picks the chat/timeline/reminder backend by coco.config.json `mode`, then
// re-exposes the EXACT same interface main.js already used on link.js, so the
// rest of the app doesn't care whether it's talking to a cloud broker or a
// fully-local brain.
//
//   mode: "local"  → local-brain.js  (default; zero-config, works offline)
//   mode: "cloud"  → link.js         (your own VPS broker; WeChat / cross-device)
//
// If coco.config.json is absent, we auto-detect: a link.config.json present →
// cloud (back-compat with existing installs); otherwise → local.
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function srcDir() { return global.__BUNDLED__ || __dirname; }
// 首启向导把用户配置写到 userData（打包后 app 包内不可写）。优先读它，回退到内置默认。
function userConfigPath() { return path.join(app.getPath("userData"), "coco.config.json"); }

function loadCocoConfig() {
  for (const p of [userConfigPath(), path.join(srcDir(), "../coco.config.json")]) {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
  }
  return null;
}
function cloudConfigExists() {
  return fs.existsSync(path.join(srcDir(), "../link.config.json"));
}

const cfg = loadCocoConfig();
const mode = cfg?.mode || (cloudConfigExists() ? "cloud" : "local");

const impl = mode === "cloud" ? require("./link") : require("./local-brain");
if (typeof impl.configure === "function") impl.configure(cfg);

console.log(`[brain] mode=${mode}`);
module.exports = impl;
