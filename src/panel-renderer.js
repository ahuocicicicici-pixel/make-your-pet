let toastTimer = null;
let lastState  = null;
let countTimer = null;

const $ = (id) => document.getElementById(id);

const BARS = [
  { key: "hunger", barId: "bar-hunger", valId: "val-hunger" },
  { key: "clean",  barId: "bar-clean",  valId: "val-clean"  },
  { key: "mood",   barId: "bar-mood",   valId: "val-mood"   },
  { key: "health", barId: "bar-health", valId: "val-health" },
];

// ── Tabs ──────────────────────────────────────────────────────────────────────
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".tab-page").forEach(p =>
      p.classList.toggle("hidden", p.id !== `tab-${tab.dataset.tab}`));
  });
}

// ── Busy banner + countdown ───────────────────────────────────────────────────
function fmtRemain(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function updateBusyBanner(s) {
  clearInterval(countTimer);
  const banner = $("busy-banner");
  if (!s.busy) { banner.classList.add("hidden"); return; }
  banner.classList.remove("hidden");
  $("busy-label").textContent =
    (s.busy.type === "work" ? "💼 " : "📖 ") + s.busy.name + "中";
  const tick = () => {
    const remain = s.busy.endsAt - Date.now();
    $("busy-count").textContent = fmtRemain(remain);
    if (remain <= 0) clearInterval(countTimer);
  };
  tick();
  countTimer = setInterval(tick, 1000);
}

// ── Care tab ──────────────────────────────────────────────────────────────────
function renderCare(s) {
  for (const f of BARS) {
    const v = s[f.key];
    $(f.barId).style.width = v + "%";
    $(f.barId).classList.toggle("low", v < 30);
    $(f.valId).textContent = v;
  }
  $("coins").textContent     = `💰 ${s.coins}`;
  $("edu-badge").textContent = `🎓 ${s.educationName}`;
  $("level").textContent     = `Lv.${s.level} ⭐ ${s.exp}/${s.expNext}`;

  const list  = $("food-list");
  const foods = s.inventory.filter(i => i.hungerDelta);
  list.innerHTML = "";
  for (const item of foods) {
    const btn = document.createElement("button");
    btn.className = "food-btn";
    btn.disabled  = item.count <= 0 || !!s.busy;
    btn.innerHTML = `${item.name}<span class="count">×${item.count}</span>`;
    btn.addEventListener("click", async () => {
      const res = await window.petApi.feed(item.id);
      if (!res.ok) showToast(
        res.reason === "full" ? "已经吃饱了~" :
        res.reason === "busy" ? "忙着呢，回来再吃" : "没有了！");
    });
    list.appendChild(btn);
  }

  const hasShampoo = s.inventory.some(i => i.id === "shampoo" && i.count > 0);
  $("btn-bath").disabled = !hasShampoo || !!s.busy;
  $("btn-play").disabled = !!s.busy;
}

// ── Work tab ──────────────────────────────────────────────────────────────────
function renderWork(s) {
  const hint = $("work-hint");
  hint.textContent = s.moodBonus
    ? "😊 心情很好！现在打工工资 +30%"
    : "😐 心情 ≥ 80 时工资 +30%（先哄哄它）";
  hint.classList.toggle("bonus-on", s.moodBonus);

  const list = $("job-list");
  list.innerHTML = "";
  for (const j of s.jobs) {
    const div = document.createElement("div");
    div.className = "job" + (j.locked ? " locked" : "");
    const mins = Math.round(j.secs / 60 * 10) / 10;
    div.innerHTML =
      `<span class="job-name">${j.icon} ${j.name}</span>` +
      `<span class="job-sub">${mins}分钟 · ${j.pay}💰${s.moodBonus && !j.locked ? " ×1.3" : ""}</span>`;
    if (j.locked) {
      const lock = document.createElement("span");
      lock.className = "job-lock";
      lock.textContent = `🔒 ${j.lockText}`;
      div.appendChild(lock);
    } else {
      const go = document.createElement("button");
      go.className = "job-go";
      go.textContent = "开工";
      go.disabled = !!s.busy;
      go.addEventListener("click", async () => {
        const res = await window.petApi.work(j.id);
        if (!res.ok) showToast(res.text || "现在干不了");
      });
      div.appendChild(go);
    }
    list.appendChild(div);
  }
}

// ── Study tab ─────────────────────────────────────────────────────────────────
function renderStudy(s) {
  $("edu-now").textContent = s.educationName;
  const prog = $("edu-progress");
  const btn  = $("btn-study");
  const unlock = $("edu-unlock");

  if (!s.nextStage) {
    prog.textContent = "🎉 学业有成，全部修完！";
    btn.disabled = true;
    btn.textContent = "🎓 大学毕业生";
    unlock.textContent = "所有工作都解锁啦";
    return;
  }

  const st = s.nextStage;
  const dots = "●".repeat(s.eduSessions) + "○".repeat(st.sessions - s.eduSessions);
  prog.innerHTML =
    `${st.name}进度 <span class="dots">${dots}</span> ${s.eduSessions}/${st.sessions}节`;
  btn.disabled = !!s.busy;
  const mins = Math.round(st.secs / 60 * 10) / 10;
  btn.textContent = `📚 上一节${st.name}课（${st.cost}💰 · ${mins}分钟）`;
  btn.onclick = async () => {
    const res = await window.petApi.study();
    if (!res.ok) showToast(res.text || "现在上不了课");
  };

  const nextJobs = s.jobs.filter(j => j.edu === s.education + 1).map(j => j.name);
  unlock.textContent = nextJobs.length
    ? `毕业解锁：${nextJobs.join("、")}`
    : "";
}

// ── Shop tab ──────────────────────────────────────────────────────────────────
function renderShop(s) {
  $("shop-coins").textContent = s.coins;
  const list = $("shop-list");
  list.innerHTML = "";
  for (const g of s.shop) {
    const own = s.inventory.find(i => i.id === g.id)?.count || 0;
    const div = document.createElement("div");
    div.className = "shop-item";
    div.innerHTML =
      `<span class="info">${g.icon} ${g.name}<span class="own">已有×${own}</span></span>`;
    const buy = document.createElement("button");
    buy.className = "shop-buy";
    buy.textContent = `${g.price}💰`;
    buy.disabled = s.coins < g.price;
    buy.addEventListener("click", async () => {
      const res = await window.petApi.buy(g.id);
      if (res.ok) showToast(`买到 ${g.name}！`);
      else showToast(res.text || "买不了");
    });
    div.appendChild(buy);
    list.appendChild(div);
  }
}

// ── Root update ───────────────────────────────────────────────────────────────
function updateUI(s) {
  lastState = s;
  updateBusyBanner(s);
  renderCare(s);
  renderWork(s);
  renderStudy(s);
  renderShop(s);
}

function showToast(text, ms = 2000) {
  const el = $("toast");
  clearTimeout(toastTimer);
  el.textContent = text;
  el.classList.remove("hidden");
  toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

document.getElementById("btn-bath").addEventListener("click", async () => {
  const res = await window.petApi.bath();
  if (!res.ok) showToast(res.reason === "busy" ? "忙着呢" : "没有香波了！");
});

document.getElementById("btn-play").addEventListener("click", async () => {
  const res = await window.petApi.play();
  if (res.ok) showToast("开心~ 🎾");
  else showToast("忙着呢");
});

window.petApi.onStateUpdated(updateUI);
window.petApi.getState().then(updateUI);
