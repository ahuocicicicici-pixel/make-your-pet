#!/usr/bin/env node
// make-personality.js — 本地版「几道题定性格」。
// 答几道题 → 生成一段 systemPrompt → 写进 coco.config.json（保留已填的 provider/apiKey）。
// 不依赖 cloud/，纯本地自包含。
//
//   node scripts/make-personality.js            # 交互答题
//   node scripts/make-personality.js --profile p.json
//   node scripts/make-personality.js --print    # 只看生成的 systemPrompt
//
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { buildSystemPrompt, applyProfile, QUESTIONS_FILE } = require("../src/personality.js");

const ROOT = path.resolve(__dirname, "..");
const QFILE = QUESTIONS_FILE;
const CFG = path.join(ROOT, "coco.config.json");

function loadJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; } }

function readAllStdin() {
  return new Promise(res => {
    let b = ""; process.stdin.setEncoding("utf8");
    process.stdin.on("data", d => b += d); process.stdin.on("end", () => res(b)); process.stdin.on("error", () => res(b));
  });
}

async function runQuiz() {
  const { questions } = loadJson(QFILE, { questions: [] });
  let ask, rl;
  if (!process.stdin.isTTY) {
    const lines = (await readAllStdin()).split("\n"); let i = 0;
    ask = async () => (i < lines.length ? lines[i++].trim() : "");
  } else {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    ask = (q) => new Promise(r => rl.question(q, a => r(a)));
  }
  const p = {};
  console.log("\n🐾 性格测验 —— 回车用默认值\n");
  for (const it of questions) {
    if (it.type === "choice") {
      console.log(`\n${it.q}`); it.options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`));
      const a = (await ask(`选 (默认 ${it.default}): `)).trim(); const idx = parseInt(a, 10);
      p[it.field] = (idx >= 1 && idx <= it.options.length) ? it.options[idx - 1].value : it.default;
    } else if (it.type === "multi") {
      console.log(`\n${it.q}`); it.options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
      const a = (await ask(`选(逗号分隔,默认 ${it.default.join("、")}): `)).trim();
      p[it.field] = !a ? it.default : a.split(/[,，\s]+/).map(n => it.options[parseInt(n, 10) - 1]).filter(Boolean);
    } else {
      const a = (await ask(`\n${it.q}${it.placeholder ? "（" + it.placeholder + "）" : ""}\n(默认 ${it.default}): `)).trim();
      p[it.field] = a || it.default;
    }
  }
  if (rl) rl.close();
  return p;
}

async function main() {
  const args = process.argv.slice(2);
  const has = f => args.includes(f);
  const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

  const profile = has("--profile") ? loadJson(val("--profile"), {}) : await runQuiz();
  const systemPrompt = buildSystemPrompt(profile);

  if (has("--print")) { console.log("\n=== systemPrompt ===\n" + systemPrompt + "\n"); return; }

  // 合并进 coco.config.json：保留已有 provider/apiKey/model 等，只更新 systemPrompt + personality
  const cfg = applyProfile(loadJson(CFG, {}), profile);
  fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2) + "\n");

  console.log(`\n✅ 已写入 ${path.relative(ROOT, CFG)}`);
  console.log(`   宠物：${profile.name}（${profile.species || ""}）`);
  console.log(`   systemPrompt：${systemPrompt.slice(0, 60)}…`);
  if (!cfg.brain.apiKey) console.log(`   提示：还没填 LLM key，现在是离线台词模式；填 brain.apiKey 即可智能聊天。`);
}

main().catch(e => { console.error(e); process.exit(1); });
