import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readJson, workspaceDir } from "./storage.js";

const DEFAULT_BASE_URL = "https://trains.xunjiapp.cn";

export async function getXunjiTrainsForLlm({
  datestr,
  owner = "mark",
  workspace,
  apiKey = process.env.XUNJI_API_KEY,
  baseUrl = process.env.XUNJI_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  forceRefresh = false
} = {}) {
  assertDateString(datestr);

  const cacheFile = xunjiTrainCacheFile({ datestr, owner, workspace });
  if (!forceRefresh) {
    const cached = await readJson(cacheFile, null);
    if (cached) return { ...normalizeXunjiPayload(cached), cache_hit: true };
  }

  const key = apiKey || await readXunjiApiKeyFromWorkspace({ owner, workspace });
  if (!key) throw new Error("Missing XUNJI_API_KEY");
  if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable");

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/api_trains_for_llm`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ datestr })
  });

  const payload = await response.json();
  const normalized = normalizeXunjiPayload({
    datestr,
    owner,
    fetched_at: new Date().toISOString(),
    cache_hit: false,
    http_status: response.status,
    res: Array.isArray(payload?.res) ? payload.res : [],
    raw: payload
  }, response.ok);

  if (!normalized.success) {
    normalized.error = payload?.error || payload?.message || payload?.msg || `HTTP_${response.status}`;
  }

  await mkdir(dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

function normalizeXunjiPayload(value, responseOk = value?.http_status >= 200 && value?.http_status < 300) {
  const raw = value?.raw || {};
  const res = Array.isArray(value?.res) ? value.res : (Array.isArray(raw?.res) ? raw.res : []);
  const explicitFailure = raw?.success === false || Boolean(raw?.error || raw?.message || raw?.msg);
  const success = value?.success === true || (responseOk && Array.isArray(res) && !explicitFailure);
  const normalized = { ...value, success, res };

  if (success && normalized.error === "HTTP_200") {
    delete normalized.error;
  }

  return normalized;
}

export function parseXunjiTrainText(text) {
  const parts = String(text || "").split(",").map((part) => part.trim()).filter(Boolean);
  const parsed = {
    raw: String(text || ""),
    date_token: parts[0] || "",
    localid: "",
    train_time: "",
    title: "",
    items: []
  };

  for (const part of parts.slice(1)) {
    if (part.startsWith("id:")) {
      parsed.localid = part.slice(3);
    } else if (part.startsWith("train_time:")) {
      parsed.train_time = part.slice("train_time:".length);
    } else if (!parsed.title) {
      parsed.title = part;
    } else {
      parsed.items.push(part);
    }
  }

  return parsed;
}

export function xunjiTrainCacheFile({ datestr, owner = "mark", workspace }) {
  assertDateString(datestr);
  return join(workspaceDir(workspace), "cache", "xunji", "trains", safeOwner(owner), `${datestr}.json`);
}

async function readXunjiApiKeyFromWorkspace({ owner, workspace }) {
  const root = workspaceDir(workspace);
  const candidates = [
    join(root, "secrets", `xunji-api-key-${safeOwner(owner)}`),
    join(root, "secrets", "xunji-api-key")
  ];

  for (const file of candidates) {
    try {
      const value = (await readFile(file, "utf8")).trim();
      if (value) return value;
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
  }

  return "";
}

function assertDateString(datestr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datestr || ""))) {
    throw new Error("datestr must be YYYY-MM-DD");
  }
}

function safeOwner(owner) {
  return String(owner || "mark").replace(/[^a-z0-9_-]/gi, "_");
}
