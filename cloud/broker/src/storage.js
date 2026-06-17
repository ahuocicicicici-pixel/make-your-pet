import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function workspaceDir(explicit) {
  return explicit || process.env.COCO_WORKSPACE || join(process.cwd(), "workspace");
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readTasks(workspace) {
  return readJson(join(workspaceDir(workspace), "tasks.json"), []);
}

export async function writeTasks(tasks, workspace) {
  await writeJson(join(workspaceDir(workspace), "tasks.json"), tasks);
}

export async function readPeople(workspace) {
  return readJson(join(workspaceDir(workspace), "people.json"), {});
}

export async function appendDelivery(event, workspace) {
  const file = join(workspaceDir(workspace), "deliveries.jsonl");
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(event)}\n`, "utf8");
}

export function nextTaskId(tasks) {
  const max = tasks.reduce((current, task) => {
    const match = /^t_(\d+)$/.exec(task.id || "");
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `t_${String(max + 1).padStart(4, "0")}`;
}
