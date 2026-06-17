const log     = document.getElementById("log");
const input   = document.getElementById("input");
const form    = document.getElementById("composer");

let empty = true;

function row(role, inner) {
  const r = document.createElement("div");
  r.className = `row ${role === "me" ? "me" : "coco"}`;
  const ava = document.createElement("div");
  ava.className = "ava";
  if (role === "me") {
    ava.textContent = "🙋";
  } else {
    const im = document.createElement("img");
    im.className = "face";
    im.src = "../assets/anim/idle/frame_00.png";
    ava.appendChild(im);
  }
  r.appendChild(ava);
  r.appendChild(inner);
  return r;
}

function addMsg(role, text) {
  if (empty) { log.innerHTML = ""; empty = false; }
  if (role === "coco") hideTyping();
  const b = document.createElement("div");
  b.className = `msg ${role === "me" ? "me" : "coco"}`;
  b.textContent = text;
  log.appendChild(row(role, b));
  log.scrollTop = log.scrollHeight;
}

let typingEl = null;
function showTyping() {
  if (typingEl) return;
  if (empty) { log.innerHTML = ""; empty = false; }
  const dots = document.createElement("div");
  dots.className = "typing";
  dots.innerHTML = "<span></span><span></span><span></span>";
  typingEl = row("coco", dots);
  log.appendChild(typingEl);
  log.scrollTop = log.scrollHeight;
}
function hideTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

function showEmpty() {
  log.innerHTML = `<div class="empty">还没有对话，跟 COCO 说句话吧～</div>`;
  empty = true;
}

// Load history
window.petApi.chatHistory().then((hist) => {
  if (!hist || !hist.length) { showEmpty(); return; }
  for (const m of hist) addMsg(m.role, m.text);
});

// Live messages (both COCO replies and echoes of our own sends)
window.petApi.onChatMessage((m) => addMsg(m.role, m.text));

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  window.petApi.chatReply(text); // main echoes it back as a "me" message
  showTyping();                  // COCO is thinking (agent turn ~10-30s)
});

document.getElementById("close").addEventListener("click", () => window.close());

input.focus();
