const { contextBridge, ipcRenderer } = require("electron");
const fs   = require("fs");
const path = require("path");

// Load animation manifest at preload time (node context) and expose to renderer
let animManifest = null;
try {
  animManifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../assets/anim/manifest.json"), "utf8")
  );
} catch {
  animManifest = null;
}

contextBridge.exposeInMainWorld("petApi", {
  getManifest: () => animManifest,

  // Window control (pet window only)
  setIgnoreMouse: (ignore) => ipcRenderer.invoke("win:setIgnoreMouse", ignore),
  moveBy:         (dx, dy) => ipcRenderer.invoke("win:moveBy", dx, dy),
  quit:           ()       => ipcRenderer.invoke("pet:quit"),
  togglePanel:    ()       => ipcRenderer.invoke("panel:toggle"),
  openTimeline:   (which)  => ipcRenderer.invoke("timeline:open", which),
  timelineLabels: ()       => ipcRenderer.invoke("timeline:labels"),

  // State (used by both windows)
  getState:       ()       => ipcRenderer.invoke("state:get"),
  feed:           (id)     => ipcRenderer.invoke("state:feed", id),
  bath:           ()       => ipcRenderer.invoke("state:bath"),
  play:           ()       => ipcRenderer.invoke("state:play"),
  work:           (jobId)  => ipcRenderer.invoke("state:work", jobId),
  study:          ()       => ipcRenderer.invoke("state:study"),
  buy:            (itemId) => ipcRenderer.invoke("state:buy", itemId),

  // Push updates from main → renderer
  onStateUpdated: (cb)     => ipcRenderer.on("state:updated", (_e, s) => cb(s)),
  onPetAction:    (cb)     => ipcRenderer.on("pet:action", (_e, a) => cb(a)),
  onPetSay:       (cb)     => ipcRenderer.on("pet:say", (_e, m) => cb(m)),

  // Chat with COCO (two-way)
  openChat:       ()       => ipcRenderer.invoke("chat:open"),
  chatReply:      (text)   => ipcRenderer.invoke("chat:reply", text),
  chatHistory:    ()       => ipcRenderer.invoke("chat:history"),
  onChatMessage:  (cb)     => ipcRenderer.on("chat:message", (_e, m) => cb(m)),

  // First-run personality wizard
  wizardQuestions: ()        => ipcRenderer.invoke("wizard:questions"),
  wizardSubmit:    (profile) => ipcRenderer.invoke("wizard:submit", profile),
  wizardSkip:      ()        => ipcRenderer.invoke("wizard:skip"),
});
