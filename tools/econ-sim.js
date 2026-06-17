#!/usr/bin/env node
// Economy balance simulator: plays as a reasonable caretaker for N hours and
// reports cash flow, education progression, and per-job net profitability.
// Numbers mirror src/state.js — keep in sync when rebalancing.

const HOURS = Number(process.argv[2] || 4);

const CONFIGS = {
  "当前版": {
    decay: { hunger: 4, clean: 2, mood: 3 }, // per hour
    stages: [
      { name: "小学", sessions: 3, cost: 10, secs: 90 },
      { name: "中学", sessions: 4, cost: 20, secs: 100 },
      { name: "大学", sessions: 5, cost: 40, secs: 120 },
    ],
    jobs: [
      { id: "flyer",   edu: 0, secs: 60,  pay: 8,  cost: { hunger: 18, clean: 12, mood: 15 } },
      { id: "builder", edu: 1, secs: 120, pay: 22, cost: { hunger: 18, clean: 12, mood: 15 } },
      { id: "cook",    edu: 2, secs: 150, pay: 38, cost: { hunger: 18, clean: 12, mood: 15 } },
      { id: "artist",  edu: 3, secs: 180, pay: 65, cost: { hunger: 18, clean: 12, mood: 15 } },
    ],
    studyCost: { hunger: 10, mood: 12 },
    shop: { dogfood: { price: 20, hunger: 20 }, shampoo: { price: 30, clean: 60 } },
    play: { mood: 10, clean: -5, hunger: 0 },
  },
  "调整版": {
    decay: { hunger: 4, clean: 2, mood: 3 },
    stages: [
      { name: "小学", sessions: 3, cost: 10, secs: 1200 },  // 20分钟/节
      { name: "中学", sessions: 4, cost: 25, secs: 1800 },  // 30分钟/节
      { name: "大学", sessions: 5, cost: 50, secs: 2700 },  // 45分钟/节
    ],
    jobs: [
      { id: "flyer",   edu: 0, secs: 900,  pay: 28,  cost: { hunger: 10, clean: 6,  mood: 8  } }, // 15分钟
      { id: "builder", edu: 1, secs: 1800, pay: 65,  cost: { hunger: 16, clean: 10, mood: 13 } }, // 30分钟
      { id: "cook",    edu: 2, secs: 2700, pay: 110, cost: { hunger: 22, clean: 14, mood: 18 } }, // 45分钟
      { id: "artist",  edu: 3, secs: 3600, pay: 175, cost: { hunger: 28, clean: 18, mood: 22 } }, // 60分钟
    ],
    studyCost: { hunger: 12, mood: 12 },
    shop: { dogfood: { price: 20, hunger: 20 }, shampoo: { price: 30, clean: 60 } },
    play: { mood: 10, clean: -5, hunger: -3 },
  },
};

// Static check: net profit of one shift, valuing stat loss at replacement price
function staticTable(cfg) {
  const pHunger = cfg.shop.dogfood.price / cfg.shop.dogfood.hunger; // 💰 per point
  const pClean  = cfg.shop.shampoo.price / cfg.shop.shampoo.clean;
  // mood refilled by free play, which itself burns clean+hunger
  const pMood = (cfg.play.clean ? -cfg.play.clean * pClean : 0) / cfg.play.mood +
                (cfg.play.hunger ? -cfg.play.hunger * pHunger : 0) / cfg.play.mood;
  const rows = [];
  for (const j of cfg.jobs) {
    const repl = j.cost.hunger * pHunger + j.cost.clean * pClean + j.cost.mood * pMood;
    const net  = j.pay - repl;
    rows.push({
      工作: j.id, 工资: j.pay, 补给成本: repl.toFixed(1),
      每班净赚: net.toFixed(1), 每分钟净赚: (net / (j.secs / 60)).toFixed(1),
    });
  }
  return rows;
}

// Dynamic sim: greedy caretaker loop
function simulate(cfg, hours) {
  const s = { hunger: 80, clean: 80, mood: 80, coins: 50, edu: 0, sessions: 0 };
  let busy = null; // { kind, until, job }
  const log = [];
  let earned = 0, food = 0, tuition = 0, stuckSec = 0, shifts = 0, lessons = 0;
  const totalSec = hours * 3600;

  for (let t = 0; t < totalSec; t++) {
    // decay per second
    s.hunger = Math.max(0, s.hunger - cfg.decay.hunger / 3600);
    s.clean  = Math.max(0, s.clean  - cfg.decay.clean  / 3600);
    const mult = (s.hunger < 30 || s.clean < 30) ? 2 : 1;
    s.mood   = Math.max(0, s.mood - (cfg.decay.mood * mult) / 3600);

    if (busy) {
      if (t >= busy.until) {
        if (busy.kind === "work") {
          const j = busy.job;
          const pay = Math.round(j.pay * (s.mood >= 80 ? 1.3 : 1));
          s.coins += pay; earned += pay; shifts++;
          s.hunger = Math.max(0, s.hunger - j.cost.hunger);
          s.clean  = Math.max(0, s.clean  - j.cost.clean);
          s.mood   = Math.max(0, s.mood   - j.cost.mood);
        } else {
          lessons++;
          s.sessions++;
          s.hunger = Math.max(0, s.hunger - cfg.studyCost.hunger);
          s.mood   = Math.max(0, s.mood   - cfg.studyCost.mood);
          if (s.sessions >= cfg.stages[s.edu].sessions) { s.edu++; s.sessions = 0; }
        }
        busy = null;
      } else continue;
    }

    // care first
    if (s.hunger <= 40) {
      if (s.coins >= cfg.shop.dogfood.price) {
        s.coins -= cfg.shop.dogfood.price; food += cfg.shop.dogfood.price;
        s.hunger = Math.min(100, s.hunger + cfg.shop.dogfood.hunger);
      }
    }
    if (s.clean <= 35 && s.coins >= cfg.shop.shampoo.price) {
      s.coins -= cfg.shop.shampoo.price; food += cfg.shop.shampoo.price;
      s.clean = Math.min(100, s.clean + cfg.shop.shampoo.clean);
    }
    if (s.mood <= 50) {
      s.mood  = Math.min(100, s.mood + cfg.play.mood);
      s.clean = Math.max(0, s.clean + cfg.play.clean);
      s.hunger = Math.max(0, s.hunger + (cfg.play.hunger || 0));
    }

    const canWork = s.hunger >= 20 && s.clean >= 20 && s.mood >= 25;

    // study if affordable (keep a food reserve)
    if (s.edu < cfg.stages.length && canWork &&
        s.coins >= cfg.stages[s.edu].cost + 60) {
      s.coins -= cfg.stages[s.edu].cost; tuition += cfg.stages[s.edu].cost;
      busy = { kind: "study", until: t + cfg.stages[s.edu].secs };
      continue;
    }

    if (canWork) {
      const j = [...cfg.jobs].reverse().find(j => j.edu <= s.edu);
      busy = { kind: "work", until: t + j.secs, job: j };
    } else if (s.coins < cfg.shop.dogfood.price) {
      stuckSec++; // broke AND unable to work — economy deadlock
    }

    if (t % 1800 === 0) {
      log.push(`  ${String(t / 3600).padStart(4)}h  💰${String(Math.round(s.coins)).padStart(4)}  ` +
        `学历:${["无", "小学", "中学", "大学"][s.edu]}  ` +
        `饱${Math.round(s.hunger)} 洁${Math.round(s.clean)} 心${Math.round(s.mood)}`);
    }
  }

  return {
    log, final: s, earned, food, tuition, shifts, lessons,
    stuckMin: Math.round(stuckSec / 60),
  };
}

for (const [name, cfg] of Object.entries(CONFIGS)) {
  console.log(`\n━━━━━━ ${name} ━━━━━━`);
  console.log("【静态账：每班打工净赚多少】(补给成本=按商店价回补消耗)");
  console.table(staticTable(cfg));
  const r = simulate(cfg, HOURS);
  console.log(`【动态模拟 ${HOURS} 小时】(会照顾宠物的玩家)`);
  r.log.forEach(l => console.log(l));
  console.log(`  结局: 💰${Math.round(r.final.coins)} 学历:${["无", "小学", "中学", "大学"][r.final.edu]}` +
    ` | 打工${r.shifts}班赚${r.earned} | 上课${r.lessons}节花${r.tuition} | 吃喝花${r.food}` +
    ` | 卡死(没钱没力气): ${r.stuckMin}分钟`);
}
