// wizard-renderer.js — 渲染性格测验题、收集答案、提交。
const form = document.getElementById("form");
const toast = document.getElementById("toast");
let questions = [];

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const k of kids) n.append(k);
  return n;
}
function showToast(msg) {
  toast.textContent = msg; toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 2200);
}

function renderQuestion(item) {
  const wrap = el("div", { className: "q" });
  wrap.append(el("label", { textContent: item.q }));

  if (item.type === "choice" || item.type === "multi") {
    const opts = el("div", { className: "opts" });
    const norm = item.options.map(o => (typeof o === "string" ? { value: o, label: o } : o));
    const defaults = Array.isArray(item.default) ? item.default : [item.default];
    for (const o of norm) {
      const input = el("input", {
        type: item.type === "multi" ? "checkbox" : "radio",
        name: item.field, value: o.value,
        checked: defaults.includes(o.value),
      });
      const opt = el("label", { className: "opt" }, input, el("span", { textContent: o.label }));
      input.addEventListener("change", () => {
        if (item.type === "radio" || item.type === "choice")
          opts.querySelectorAll(".opt").forEach(e => e.classList.remove("sel"));
        opt.classList.toggle("sel", input.checked);
      });
      if (input.checked) opt.classList.add("sel");
      opts.append(opt);
    }
    wrap.append(opts);
  } else {
    wrap.append(el("input", { type: "text", name: item.field, value: item.default || "", placeholder: item.placeholder || "" }));
  }
  wrap.dataset.field = item.field;
  wrap.dataset.type = item.type;
  return wrap;
}

function collect() {
  const profile = {};
  for (const item of questions) {
    const scope = form.querySelector(`.q[data-field="${item.field}"]`);
    if (!scope) continue;
    if (item.type === "multi") {
      profile[item.field] = [...scope.querySelectorAll("input:checked")].map(i => i.value);
      if (!profile[item.field].length) profile[item.field] = item.default;
    } else if (item.type === "choice") {
      const c = scope.querySelector("input:checked");
      profile[item.field] = c ? c.value : item.default;
    } else {
      const v = scope.querySelector("input").value.trim();
      profile[item.field] = v || item.default;
    }
  }
  return profile;
}

async function init() {
  try { questions = await window.petApi.wizardQuestions(); } catch { questions = []; }
  if (!questions.length) { form.append(el("p", { textContent: "题目加载失败，可点跳过用默认 Coco。" })); return; }
  for (const q of questions) form.append(renderQuestion(q));
}

document.getElementById("save").addEventListener("click", async () => {
  const r = await window.petApi.wizardSubmit(collect());
  if (!r || !r.ok) showToast("保存失败：" + (r && r.error || "未知错误"));
});
document.getElementById("skip").addEventListener("click", () => window.petApi.wizardSkip());

init();
