import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { persistSentDeliveries, runHeartbeat } from "./heartbeat.js";
import { stickerForDelivery } from "./stickers.js";
import { workspaceDir } from "./storage.js";

const execFileAsync = promisify(execFile);

export async function runDelivery({
  now = new Date(),
  workspace,
  dryRun = false,
  openclawBin = process.env.OPENCLAW_BIN || "openclaw",
  openclawArgsPrefix = [],
  account = process.env.OPENCLAW_WEIXIN_ACCOUNT || ""
} = {}) {
  const deliveries = await runHeartbeat({ now, workspace, persist: false, channel: "wechat" });
  if (deliveries === "HEARTBEAT_OK") return [];

  const root = workspaceDir(workspace);
  const results = [];
  for (const delivery of deliveries) {
    const media = resolve(root, stickerForDelivery(delivery));
    const args = [
      "message",
      "send",
      "--channel",
      delivery.channel,
      "--account",
      delivery.account || account,
      "--target",
      delivery.peer,
      "--message",
      delivery.message,
      "--media",
      media,
      "--json"
    ];
    if (dryRun) args.splice(2, 0, "--dry-run");

    const result = await execFileAsync(openclawBin, [...openclawArgsPrefix, ...args], {
      timeout: 60_000,
      env: { ...process.env, COCO_WORKSPACE: root },
      cwd: join(root, "..")
    });
    results.push({
      delivery,
      media,
      stdout: parseJsonOutput(result.stdout),
      stderr: result.stderr
    });
  }

  if (!dryRun) {
    await persistSentDeliveries({ deliveries, now, workspace });
  }

  return results;
}

function parseJsonOutput(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
