// personality.js — 共享的"性格 → systemPrompt"逻辑。
// 纯 node、不依赖 electron，CLI(scripts/make-personality.js) 和 App 首启向导都用它。
const fs = require("fs");
const path = require("path");

const QUESTIONS_FILE = path.join(__dirname, "personality.questions.json");

const TEMPER = {
  introvert: "性格安静内向，是只 i 宠，不爱叫也不急躁，更多是默默陪着主人",
  extrovert: "性格活泼外向、元气满满，话很多，见到主人就开心得不行",
  aloof: "性格高冷傲娇，嘴上不饶人心里却很在乎，关心你还要装作无所谓",
  clingy: "性格黏人爱撒娇，时时刻刻想黏着主人，一会儿没理就委屈",
};
const REMIND = {
  gentle: "提醒主人时轻声细语、不催促",
  strict: "提醒主人时负责到底，没完成会温柔追问",
  minimal: "提醒主人时极简，一句话带过不啰嗦",
};

function buildSystemPrompt(p = {}) {
  const temper = TEMPER[p.temperament] || TEMPER.extrovert;
  const remind = REMIND[p.remindStyle] || REMIND.gentle;
  const tone = (Array.isArray(p.tone) ? p.tone : [p.tone]).filter(Boolean).join("、");
  return [
    `你是${p.name || "Coco"}，一只${p.species || "桌宠"}，住在主人的电脑桌面上。`,
    `${temper}。`,
    tone ? `说话${tone}。` : "",
    p.quirk ? `你有个小怪癖：${p.quirk}，偶尔会流露出来。` : "",
    `称呼主人为「${p.ownerAddress || "主人"}」。`,
    `${remind}。`,
    p.catchphrase ? `偶尔带上口头禅「${p.catchphrase}」，但别每句都用。` : "",
    `回复简短、口语、自然，像真的小宠物在身边一样，不要长篇大论。`,
  ].filter(Boolean).join("");
}

function loadQuestions() {
  try { return JSON.parse(fs.readFileSync(QUESTIONS_FILE, "utf8")).questions || []; }
  catch { return []; }
}

// 把一个 profile 合并进一份已有 config 对象（保留已填的 provider/apiKey/model）。
function applyProfile(cfg, profile) {
  cfg = cfg || {};
  cfg.mode = cfg.mode || "local";
  cfg.brain = cfg.brain || { provider: "none", apiKey: "", model: "" };
  cfg.brain.systemPrompt = buildSystemPrompt(profile);
  cfg.personality = profile;
  cfg.reminders = cfg.reminders || { enabled: true };
  cfg.timeline = cfg.timeline || { enabled: true };
  return cfg;
}

module.exports = { buildSystemPrompt, loadQuestions, applyProfile, QUESTIONS_FILE };
