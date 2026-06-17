#!/usr/bin/env node
// 苹果「屏幕使用时间」→ 生活时间轴
// 读 macOS knowledgeC.db 的 app 使用时段 → 聚合 → 映射分类 → POST 到 broker /life-event
//
// 用法：
//   node tools/screentime-to-timeline.mjs --dry-run     # 只打印，看真实 app 列表和拟定分类
//   node tools/screentime-to-timeline.mjs               # 真发到生活轴
//   DAYS_BACK=2 node tools/screentime-to-timeline.mjs   # 回看天数(默认1=今天)
//
// 前提：运行它的程序(终端/node)需在「系统设置→隐私与安全→完全磁盘访问」里勾选。

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dir, "..", "link.config.json"), "utf8"));
const DRY = process.argv.includes("--dry-run");
const DAYS_BACK = Number(process.env.DAYS_BACK || 1);
const MIN_SESSION_SEC = 180;   // 丢弃 < 3 分钟的零碎使用
const MERGE_GAP_SEC = 180;     // 同一 app 间隔 < 3 分钟则合并为一段
const DB = `${process.env.HOME}/Library/Application Support/Knowledge/knowledgeC.db`;
const MAC_EPOCH = 978307200;   // 2001-01-01 → unix 秒

// bundleId/名称 关键词 → [categoryId, subcategoryId]。可自行增删。
const MAP = [
  [/wechat|tencent\.xin|com\.tencent\.qq|qq|dingtalk|alibaba\.dingtalk|lark|feishu|slack|telegram|discord|whatsapp|messages|mail|spark|outlook/i, ["social", "social.other"]],
  [/weibo|douyin|tiktok|xingin|xiaohongshu|zhihu|instagram|twitter|x\.com|facebook|reddit/i, ["entertainment", "entertainment.social_media"]],
  [/bilibili|youtube|iqiyi|youku|tencentvideo|netflix|infuse|quicktime|tv\.app|vlc|potplayer/i, ["entertainment", "entertainment.video"]],
  [/spotify|music|netease|cloudmusic|qqmusic|podcast/i, ["entertainment", "entertainment.music"]],
  [/steam|game|minecraft|wreckfest|genshin/i, ["entertainment", "entertainment.game"]],
  [/vscode|code|xcode|jetbrains|intellij|pycharm|webstorm|cursor|sublime|iterm|terminal|warp|docker|github|tower|postman|figma/i, ["work", "work.coding"]],
  [/anthropic|claude|chatgpt|openai|copilot|perplexity|gemini/i, ["work", "work.other"]],
  [/word|excel|powerpoint|keynote|pages|numbers|notion|obsidian|notes|craft|bear|wpsoffice|kingsoft|wps/i, ["work", "work.writing"]],
  [/zoom|teams|meet|webex|tencentmeeting/i, ["work", "work.meeting"]],
  [/safari|chrome|arc|firefox|edge|brave/i, ["work", "work.other"]],   // 浏览器默认归工作，可按需改
  [/books|kindle|preview|pdf|goodnotes|anki/i, ["study", "study.reading"]],
];
function categorize(app) {
  for (const [re, cat] of MAP) if (re.test(app)) return cat;
  return null; // 未匹配 → 跳过（dry-run 会单独列出，便于你补映射）
}
function shortName(bundle) {
  const p = bundle.split(".");
  return p[p.length - 1] || bundle;
}

// 本机 ZSOURCE 为空 → "Mac"；跨设备共享同步来的(iPhone)带设备ID → "手机"
const deviceLabel = (dev) => (dev && dev.trim() ? "手机" : "Mac");

function queryUsage(sinceUnix) {
  const sql =
    "SELECT o.ZVALUESTRING, o.ZSTARTDATE, o.ZENDDATE, s.ZDEVICEID FROM ZOBJECT o " +
    "LEFT JOIN ZSOURCE s ON o.ZSOURCE = s.Z_PK " +
    "WHERE o.ZSTREAMNAME='/app/usage' AND o.ZSTARTDATE IS NOT NULL AND o.ZENDDATE IS NOT NULL " +
    `AND (o.ZSTARTDATE + ${MAC_EPOCH}) > ${sinceUnix} ORDER BY o.ZVALUESTRING, o.ZSTARTDATE;`;
  let out;
  try {
    out = execFileSync("/usr/bin/sqlite3", ["-readonly", "-separator", "\t", DB, sql], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (/authorization denied|unable to open/i.test(msg)) {
      console.error("❌ 读不了屏幕时间库——需要在『系统设置→隐私与安全→完全磁盘访问』里给运行它的终端/node 授权。");
    } else console.error("❌ 查询失败：", msg);
    process.exit(1);
  }
  const rows = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const [app, zs, ze, dev] = line.split("\t");
    rows.push({ app, start: Number(zs) + MAC_EPOCH, end: Number(ze) + MAC_EPOCH, device: deviceLabel(dev) });
  }
  return rows;
}

// 按 app + 设备 合并相邻使用段
function mergeSessions(rows) {
  const byKey = {};
  for (const r of rows) (byKey[r.app + "|" + r.device] = byKey[r.app + "|" + r.device] || []).push(r);
  const sessions = [];
  for (const list of Object.values(byKey)) {
    list.sort((a, b) => a.start - b.start);
    let cur = null;
    for (const r of list) {
      if (cur && r.start - cur.end <= MERGE_GAP_SEC) cur.end = Math.max(cur.end, r.end);
      else { if (cur) sessions.push(cur); cur = { app: r.app, device: r.device, start: r.start, end: r.end }; }
    }
    if (cur) sessions.push(cur);
  }
  return sessions.filter((s) => s.end - s.start >= MIN_SESSION_SEC);
}

const cstDate = (unix) => new Date(unix * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const clampSameDay = (s) => {
  if (cstDate(s.start) === cstDate(s.end)) return s.end;
  const d = new Date(s.start * 1000); d.setHours(23, 59, 0, 0); return Math.floor(d.getTime() / 1000);
};

const now = Math.floor(Date.now() / 1000);
const since = now - DAYS_BACK * 86400;
const sessions = mergeSessions(queryUsage(since));

const events = [], skipped = {};
for (const s of sessions) {
  const cat = categorize(s.app);
  if (!cat) { skipped[s.app] = (skipped[s.app] || 0) + (s.end - s.start); continue; }
  const endU = clampSameDay(s);
  const mins = Math.round((endU - s.start) / 60);
  if (mins < 3) continue;
  const phone = s.device === "手机";
  events.push({
    id: `screen_${s.device}_${s.app}_${s.start}`,
    startAt: new Date(s.start * 1000).toISOString(),
    endAt: new Date(endU * 1000).toISOString(),
    title: (phone ? "📱" : "") + shortName(s.app),
    note: `屏幕使用(${s.device})：${s.app}，约 ${mins} 分钟。`,
    categoryId: cat[0], subcategoryId: cat[1],
    tags: [s.device],
  });
}

// 统计概览
const byCat = {};
for (const e of events) byCat[e.categoryId] = (byCat[e.categoryId] || 0) + 1;
console.log(`时段(>=3min): ${sessions.length}  → 事件: ${events.length}  分类分布:`, byCat);
if (Object.keys(skipped).length) {
  console.log("\n未匹配分类的 app（按总时长排序，可据此补 MAP）:");
  Object.entries(skipped).sort((a, b) => b[1] - a[1]).slice(0, 25)
    .forEach(([app, sec]) => console.log(`  ${Math.round(sec / 60)}min  ${app}`));
}

if (DRY) {
  console.log("\n[dry-run] 前 15 条事件预览:");
  events.slice(0, 15).forEach((e) => console.log(`  ${e.startAt.slice(11, 16)} ${e.title} (${e.categoryId}) ${e.note}`));
  console.log("\n[dry-run] 未发送。确认映射后去掉 --dry-run 即真发。");
  process.exit(0);
}

if (!events.length) { console.log("没有可发送的事件。"); process.exit(0); }
const res = await fetch(`${cfg.base}/life-event`, {
  method: "POST",
  headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
  body: JSON.stringify({ events }),
});
console.log(res.ok ? `✅ 已发送 ${events.length} 条到生活轴` : `❌ 发送失败 HTTP ${res.status}`);
