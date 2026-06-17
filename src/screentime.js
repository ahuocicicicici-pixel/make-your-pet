// 苹果「屏幕使用时间」→ 生活时间轴（主进程模块）
// 读 macOS knowledgeC.db 的 app 使用时段 → 聚合 → 映射分类 → 经 link 推到 broker /life-event。
// 需要给本 App 授权「完全磁盘访问」(系统设置→隐私与安全)，否则读库会被拒(静默跳过)。
const { execFileSync } = require("child_process");
const link = require("./link");

const MIN_SESSION_SEC = 180; // 丢弃 < 3 分钟
const MERGE_GAP_SEC   = 180; // 同 app 间隔 < 3 分钟则合并
const MAC_EPOCH = 978307200; // 2001-01-01 → unix 秒
const DB = `${process.env.HOME}/Library/Application Support/Knowledge/knowledgeC.db`;

// bundleId/名称关键词 → [categoryId, subcategoryId]
const MAP = [
  [/wechat|tencent\.xin|com\.tencent\.qq|qq|dingtalk|alibaba\.dingtalk|lark|feishu|slack|telegram|discord|whatsapp|messages|mail|spark|outlook/i, ["social", "social.other"]],
  [/weibo|douyin|tiktok|xingin|xiaohongshu|zhihu|instagram|twitter|x\.com|facebook|reddit/i, ["entertainment", "entertainment.social_media"]],
  [/bilibili|youtube|iqiyi|youku|tencentvideo|netflix|infuse|quicktime|vlc|potplayer/i, ["entertainment", "entertainment.video"]],
  [/spotify|music|netease|cloudmusic|qqmusic|podcast/i, ["entertainment", "entertainment.music"]],
  [/steam|game|minecraft|genshin/i, ["entertainment", "entertainment.game"]],
  [/vscode|com\.microsoft\.vscode|xcode|jetbrains|intellij|pycharm|webstorm|cursor|sublime|iterm|terminal|warp|docker|github|tower|postman|figma/i, ["work", "work.coding"]],
  [/anthropic|claude|chatgpt|openai|copilot|perplexity|gemini/i, ["work", "work.other"]],
  [/word|excel|powerpoint|keynote|pages|numbers|notion|obsidian|notes|craft|bear|wpsoffice|kingsoft|wps/i, ["work", "work.writing"]],
  [/zoom|teams|webex|tencentmeeting/i, ["work", "work.meeting"]],
  [/safari|chrome|arc|firefox|edge|brave/i, ["work", "work.other"]],
  [/books|kindle|preview|goodnotes|anki/i, ["study", "study.reading"]],
];
function categorize(app) { for (const [re, c] of MAP) if (re.test(app)) return c; return null; }
function shortName(b) { const p = b.split("."); return p[p.length - 1] || b; }
const cstDate = (u) => new Date(u * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

// 本机使用 ZSOURCE 为空 → "Mac"；跨设备共享同步来的(如 iPhone)带设备ID → "手机"
function deviceLabel(deviceId) { return deviceId && deviceId.trim() ? "手机" : "Mac"; }

function queryUsage(sinceUnix) {
  const sql =
    "SELECT o.ZVALUESTRING, o.ZSTARTDATE, o.ZENDDATE, s.ZDEVICEID FROM ZOBJECT o " +
    "LEFT JOIN ZSOURCE s ON o.ZSOURCE = s.Z_PK " +
    "WHERE o.ZSTREAMNAME='/app/usage' AND o.ZSTARTDATE IS NOT NULL AND o.ZENDDATE IS NOT NULL " +
    `AND (o.ZSTARTDATE + ${MAC_EPOCH}) > ${sinceUnix} ORDER BY o.ZVALUESTRING, o.ZSTARTDATE;`;
  const out = execFileSync("/usr/bin/sqlite3", ["-readonly", "-separator", "\t", DB, sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const rows = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const [app, zs, ze, dev] = line.split("\t");
    rows.push({ app, start: Number(zs) + MAC_EPOCH, end: Number(ze) + MAC_EPOCH, device: deviceLabel(dev) });
  }
  return rows;
}

// 按 app + 设备 合并（手机微信 与 电脑微信 不混在一起）
function mergeSessions(rows) {
  const byKey = {};
  for (const r of rows) (byKey[r.app + "|" + r.device] = byKey[r.app + "|" + r.device] || []).push(r);
  const out = [];
  for (const list of Object.values(byKey)) {
    list.sort((a, b) => a.start - b.start);
    let cur = null;
    for (const r of list) {
      if (cur && r.start - cur.end <= MERGE_GAP_SEC) cur.end = Math.max(cur.end, r.end);
      else { if (cur) out.push(cur); cur = { app: r.app, device: r.device, start: r.start, end: r.end }; }
    }
    if (cur) out.push(cur);
  }
  return out.filter((s) => s.end - s.start >= MIN_SESSION_SEC);
}

// 读最近 daysBack 天的屏幕使用，推到生活轴。安全：任何失败都吞掉(返回false)。
async function syncScreenTime(daysBack = 1) {
  if (process.platform !== "darwin" || !link.isConfigured()) return false;
  let sessions;
  try {
    sessions = mergeSessions(queryUsage(Math.floor(Date.now() / 1000) - daysBack * 86400));
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (/authorization denied|unable to open/i.test(msg))
      console.log("[screentime] 需要给 COCO 授权『完全磁盘访问』才能读屏幕使用时间");
    else console.log("[screentime] 读取失败:", msg.slice(0, 120));
    return false;
  }
  const events = [];
  for (const s of sessions) {
    const cat = categorize(s.app);
    if (!cat) continue;
    let endU = s.end;
    if (cstDate(s.start) !== cstDate(endU)) {
      const d = new Date(s.start * 1000); d.setHours(23, 59, 0, 0); endU = Math.floor(d.getTime() / 1000);
    }
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
  if (!events.length) return true;
  const ok = await link.logLifeEvents(events);
  console.log(`[screentime] ${ok ? "已推送" : "推送失败"} ${events.length} 条`);
  return ok;
}

module.exports = { syncScreenTime };
