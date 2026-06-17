import { nextTaskId, readTasks, writeTasks } from "./storage.js";
import { parseTasksFromText } from "./parser.js";

export async function addTasksFromText({ text, creator = "mark", now, workspace }) {
  const tasks = await readTasks(workspace);
  const parsed = parseTasksFromText({ text, creator, now });
  const created = [];
  for (const task of parsed) {
    created.push({ ...task, id: nextTaskId([...tasks, ...created]) });
  }
  const next = [...tasks, ...created];
  await writeTasks(next, workspace);
  return created;
}

export async function completeTaskFromText({ text, workspace }) {
  const tasks = await readTasks(workspace);
  const query = text.replace(/搞定|做完了|done|完成|了/g, "").trim();
  const task = tasks.find((candidate) => {
    if (candidate.status !== "pending") return false;
    return query.includes(candidate.title) || candidate.title.includes(query);
  });

  if (!task) {
    return { completed: null, tasks };
  }

  task.status = "done";
  task.completed_at = new Date().toISOString();
  await writeTasks(tasks, workspace);
  return { completed: task, tasks };
}
