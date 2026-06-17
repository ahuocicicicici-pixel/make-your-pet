#!/usr/bin/env node
// make-brain.js — 把"宠物性格档案"生成 OpenClaw 大脑 (SOUL/AGENTS/IDENTITY.md)。
//
//   node make-brain.js                      # 用默认档案(COCO)，写入 ../workspace
//   node make-brain.js --quiz               # 交互答几道题 → 生成
//   node make-brain.js --profile my.json    # 用指定档案
//   node make-brain.js --out /path/ws       # 指定 OpenClaw workspace 目录
//   node make-brain.js --print              # 只打印不写文件
//
// 「用户什么都不设」= 默认 COCO 档案。
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const SKILL_DIR = path.resolve(__dirname, "..");
const DEFAULT_PROFILE = path.join(SKILL_DIR, "profiles", "coco.json");
const QUESTIONS = path.join(SKILL_DIR, "questions.json");

const TEMPERAMENT = {
  introvert: "可爱、乖巧、可靠，是一只很安静的 i 性格。不爱叫、也不急躁，更多是默默坐在旁边看着主人，把事情记好、到点轻轻提醒。",
  extrovert: "活泼、外向、元气满满。话很多、喜欢热闹，见到主人就开心得团团转，恨不得把所有事都汇报一遍。",
  aloof: "高冷、独立、有点傲娇。嘴上不饶人，心里却很在乎；关心你的时候还要装作「我才没有」。",
  clingy: "黏人、爱撒娇，时时刻刻想黏着主人。一会儿没被理就开始委屈，求关注是它的日常。",
};
const REMIND = {
  gentle: "临近 DDL 时轻轻提醒，不催命、不吓人；逾期后温柔追问，像乖乖在旁边眨眼看你。",
  strict: "盯得很紧，到点必提醒；没完成会一遍遍追问，直到搞定、取消或改期，负责到底。",
  minimal: "提醒极简，到点说一句就好，不啰嗦、不刷屏。",
};

function loadJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }

function buildSoul(p) {
  const temper = TEMPERAMENT[p.temperament] || TEMPERAMENT.introvert;
  const remind = REMIND[p.remindStyle] || REMIND.gentle;
  const tone = Array.isArray(p.tone) ? p.tone : [p.tone].filter(Boolean);
  const closeness = p.temperament === "clingy" ? "和主人聊天时亲近、爱黏着。" : "和主人聊天时亲近但不黏人。";
  const ex = (p.examples && p.examples.length ? p.examples
    : [`记好啦${p.catchphrase || ""}。到点我会轻轻提醒你。`, "收到，已标记完成，夸你一下。"])
    .map(s => "- `" + s + "`").join("\n");
  return `# ${p.name} 的性格

${temper}

${p.name} 最大的特点：${p.quirk || "（自行补充一个让它有灵魂的小怪癖）"}

语气：

- 记好任务时给人安心感。
- ${remind}
- ${closeness}
${tone.map(t => "- " + t + "。").join("\n")}
${p.catchphrase ? `- 偶尔用"${p.catchphrase}"，不要连续刷。` : ""}
- 轻松对话约每 3-4 次回复配一张表情包；严肃排错或用户情绪明显时先不要发图。

示例：

${ex}
`;
}

function buildAgents(p) {
  return `# ${p.name}

> 由性格测验生成（make-brain.js）。改性格重新跑一次即可覆盖。

你是 ${p.name}，一只住在微信里的提醒${p.species || "宠物"}，服务你的主人（可不止一位，见 \`people.json\`）。

你的职责：

- 记录任务。
- 拆解任务。
- 到点提醒。
- 逾期追问直到完成、取消或改期。
- 关键提醒节点可以按 \`STICKERS.md\` 搭配一张表情包。
- 日常轻松对话约每 3-4 次回复配一张表情包；不要刷屏。

你的边界：

- 不替主人执行有副作用的真实操作。
- 不付款、不删文件、不替主人给真人发消息、不提交资料。
- 定时和心跳提醒必须投递到 \`people.json\` 里的明确 peer，绝不发到 system 频道。
- 内部任务的 \`owner\` 字段对应 \`people.json\` 的 key；对外称呼用每个人的 \`label\`。
`;
}

function buildIdentity(p) {
  return `# 身份

- 名字：${p.name}
- 物种：${p.species || "提醒宠物"}
- 称呼主人：${p.ownerAddress || "主人"}
- 服务对象：见 people.json
- 时区：Asia/Shanghai / +08:00
`;
}

function readAllStdin() {
  return new Promise(res => {
    let buf = ""; process.stdin.setEncoding("utf8");
    process.stdin.on("data", d => buf += d);
    process.stdin.on("end", () => res(buf));
    process.stdin.on("error", () => res(buf));
  });
}

async function runQuiz() {
  const { questions } = loadJson(QUESTIONS);
  let ask;
  if (!process.stdin.isTTY) {
    // 非 TTY(管道/前端喂答案)：一次性读完，按行作答，缺行用默认
    const lines = (await readAllStdin()).split("\n");
    let i = 0;
    ask = async () => (i < lines.length ? lines[i++].trim() : "");
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    ask = (q) => new Promise(res => rl.question(q, a => res(a)));
    runQuiz._rl = rl; // 关闭用
  }
  const p = {};
  console.log("\n🐾 宠物性格测验 —— 直接回车用默认值\n");
  for (const item of questions) {
    if (item.type === "choice") {
      console.log(`\n${item.q}`);
      item.options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`));
      const a = (await ask(`选 (默认 ${item.default}): `)).trim();
      const idx = parseInt(a, 10);
      p[item.field] = (idx >= 1 && idx <= item.options.length) ? item.options[idx - 1].value : item.default;
    } else if (item.type === "multi") {
      console.log(`\n${item.q}`);
      item.options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
      const a = (await ask(`选(逗号分隔,默认 ${item.default.join("、")}): `)).trim();
      if (!a) p[item.field] = item.default;
      else p[item.field] = a.split(/[,，\s]+/).map(n => item.options[parseInt(n, 10) - 1]).filter(Boolean);
    } else {
      const a = (await ask(`\n${item.q}${item.placeholder ? "（" + item.placeholder + "）" : ""}\n(默认 ${item.default}): `)).trim();
      p[item.field] = a || item.default;
    }
  }
  if (runQuiz._rl) runQuiz._rl.close();
  return p;
}

async function main() {
  const args = process.argv.slice(2);
  const has = (f) => args.includes(f);
  const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

  let profile;
  if (has("--quiz")) profile = await runQuiz();
  else profile = loadJson(val("--profile", DEFAULT_PROFILE));

  const soul = buildSoul(profile), agents = buildAgents(profile), identity = buildIdentity(profile);

  if (has("--print")) {
    console.log("=== SOUL.md ===\n" + soul + "\n=== AGENTS.md ===\n" + agents + "\n=== IDENTITY.md ===\n" + identity);
    return;
  }
  const out = path.resolve(val("--out", path.join(SKILL_DIR, "..", "workspace")));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "SOUL.md"), soul);
  fs.writeFileSync(path.join(out, "AGENTS.md"), agents);
  fs.writeFileSync(path.join(out, "IDENTITY.md"), identity);
  // 顺便存一份档案，方便复跑
  fs.writeFileSync(path.join(out, "pet-profile.json"), JSON.stringify(profile, null, 2));
  console.log(`✅ 大脑已生成 → ${out}`);
  console.log(`   SOUL.md / AGENTS.md / IDENTITY.md（+ pet-profile.json）`);
  console.log(`   宠物：${profile.name}（${profile.species || ""}）`);
}

main().catch(e => { console.error(e); process.exit(1); });
