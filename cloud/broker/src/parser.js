import { addDaysCst, formatCst, parseInstant, setCstTime } from "./time.js";

const TITLE_HINTS = ["填平台资料", "整理冰箱", "倒垃圾", "带耳机", "买水果", "交材料"];

export function parseTasksFromText({ text, creator = "mark", now = new Date() }) {
  const baseNow = typeof now === "string" ? parseInstant(now) : now;
  const advance = parseAdvance(text);
  const segments = text
    .split(/[，,；;]/)
    .map((part) => part.trim())
    .filter((part) => part && !/^提前/.test(part));

  return segments.map((segment) => {
    const due = parseDue(segment, baseNow);
    const owner = parseOwner(segment, creator);
    return {
      title: parseTitle(segment),
      owner,
      creator,
      due_at: due ? formatCst(due) : "",
      advance,
      repeat: null,
      status: "pending",
      remind_count: 0,
      last_reminded_at: null,
      reminder_log: [],
      subtasks: [],
      notes: ""
    };
  });
}

function parseAdvance(text) {
  if (/提前半小时|提前30分钟/.test(text)) return ["PT30M"];
  if (/提前一小时|提前1小时/.test(text)) return ["PT1H"];
  if (/提前10分钟|提前十分钟/.test(text)) return ["PT10M"];
  return [];
}

function parseOwner(text, creator) {
  if (/我们|咱俩|一起/.test(text)) return "both";
  if (/Cc|CC|cc|老婆|给她|让她/.test(text)) return "wife";
  return creator;
}

function parseDue(text, now) {
  if (/明天下午\s*3\s*点|明天.*15\s*点/.test(text)) {
    return setCstTime(addDaysCst(now, 1), 15);
  }
  if (/明天下午\s*6\s*点|明天.*18\s*点/.test(text)) {
    return setCstTime(addDaysCst(now, 1), 18);
  }
  if (/明晚\s*8\s*点|明天晚上\s*8\s*点|明天.*20\s*点/.test(text)) {
    return setCstTime(addDaysCst(now, 1), 20);
  }
  if (/今晚\s*8\s*点|今天晚上\s*8\s*点|今天.*20\s*点/.test(text)) {
    return setCstTime(now, 20);
  }
  if (/明早\s*9\s*点|明天早上\s*9\s*点|明天上午\s*9\s*点/.test(text)) {
    return setCstTime(addDaysCst(now, 1), 9);
  }
  return null;
}

function parseTitle(text) {
  const hinted = TITLE_HINTS.find((hint) => text.includes(hint));
  if (hinted) return hinted;

  return text
    .replace(/提醒(我|我们|我老婆|Cc|CC|cc)?/g, "")
    .replace(/明天|今天|今晚|明晚|明早|上午|下午|晚上|前/g, "")
    .replace(/\d+\s*点/g, "")
    .replace(/一起/g, "")
    .replace(/顺便记一下|记一下/g, "")
    .trim();
}
