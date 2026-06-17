import { appendDelivery, readPeople, readTasks, writeTasks } from "./storage.js";
import { cstParts, formatCst, minutesBetween, parseDuration, parseInstant, quietHours, sameOrAfter } from "./time.js";

export async function runHeartbeat({ now = new Date(), workspace, persist = true, channel } = {}) {
  const instant = typeof now === "string" ? parseInstant(now) : now;
  const people = await readPeople(workspace);
  const tasks = await readTasks(workspace);
  const deliveries = [];

  for (const task of tasks) {
    const delivery = nextDeliveryForTask(task, instant, channel);
    if (!delivery) continue;

    const taskDeliveries = [];
    for (const target of peersForOwner(task.owner, people)) {
      taskDeliveries.push({
        deliver: true,
        channel: target.channel,
        account: target.account,
        peer: target.peer,
        owner: target.owner,
        task_id: task.id,
        key: delivery.key,
        message: delivery.message,
        created_at: formatCst(instant)
      });
    }

    deliveries.push(...taskDeliveries);

    if (persist && taskDeliveries.length > 0) {
      task.reminder_log = [...(task.reminder_log || []), { key: delivery.key, sent_at: formatCst(instant) }];
      task.last_reminded_at = formatCst(instant);
      task.remind_count = Number(task.remind_count || 0) + 1;
    }
  }

  if (persist) {
    await writeTasks(tasks, workspace);
    for (const delivery of deliveries) {
      await appendDelivery(delivery, workspace);
    }
  }

  return deliveries.length > 0 ? deliveries : "HEARTBEAT_OK";
}

export async function persistSentDeliveries({ deliveries, now = new Date(), workspace } = {}) {
  if (!Array.isArray(deliveries) || deliveries.length === 0) return;
  const instant = typeof now === "string" ? parseInstant(now) : now;
  const tasks = await readTasks(workspace);
  const keysByTask = new Map();

  for (const delivery of deliveries) {
    if (!delivery.task_id || !delivery.key) continue;
    const keys = keysByTask.get(delivery.task_id) || new Set();
    keys.add(delivery.key);
    keysByTask.set(delivery.task_id, keys);
  }

  for (const task of tasks) {
    const keys = keysByTask.get(task.id);
    if (!keys) continue;
    const sentKeys = new Set((task.reminder_log || []).map((entry) => entry.key));
    for (const key of keys) {
      if (sentKeys.has(key)) continue;
      task.reminder_log = [...(task.reminder_log || []), { key, sent_at: formatCst(instant) }];
      task.last_reminded_at = formatCst(instant);
      task.remind_count = Number(task.remind_count || 0) + 1;
    }
  }

  await writeTasks(tasks, workspace);
  for (const delivery of deliveries) {
    await appendDelivery(delivery, workspace);
  }
}

export function nextDeliveryForTask(task, now, channel) {
  // 渠道对等：哪个端设的提醒就只在哪个端发。桌宠设的 source='pet'，微信/历史的视为 wechat。
  if (channel) {
    const isPet = task.source === "pet";
    if (channel === "pet" ? !isPet : isPet) return null;
  }
  const DONE_STATUSES = new Set(["done", "completed", "complete", "cancelled", "canceled", "archived"]);
  if (!task.due_at || DONE_STATUSES.has(task.status)) return null;
  if (quietHours(now) && !/紧急/.test(task.notes || "")) return null;

  const due = parseInstant(task.due_at);
  const sent = new Set((task.reminder_log || []).map((entry) => entry.key));

  for (const duration of task.advance || []) {
    const trigger = new Date(due.getTime() - parseDuration(duration));
    const key = `advance:${duration}`;
    if (!sent.has(key) && sameOrAfter(now, trigger)) {
      const minutes = minutesBetween(now, due);
      return { key, message: `${task.title}还有${minutes}分钟到点。现在去做一下吗？` };
    }
  }

  if (!sent.has("due") && sameOrAfter(now, due)) {
    return { key: "due", message: `${task.title}到点了。现在去处理吗？` };
  }

  if (now.getTime() <= due.getTime()) return null;

  for (let index = 1; index <= 4; index += 1) {
    const trigger = new Date(due.getTime() + index * 30 * 60 * 1000);
    const key = `overdue:${index}`;
    if (!sent.has(key) && sameOrAfter(now, trigger)) {
      return { key, message: `${task.title}已经过点了，我还没看到你说搞定。要现在补上吗？` };
    }
  }

  const parts = cstParts(now);
  if (parts.hour === 9 || parts.hour === 20) {
    const key = `daily:${parts.year}-${parts.month}-${parts.day}:${parts.hour}`;
    if (!sent.has(key)) {
      return { key, message: `${task.title}还没完成。我继续帮你守着，要今天处理吗？` };
    }
  }

  return null;
}

function peersForOwner(owner, people) {
  const owners = owner === "both" ? ["mark", "wife"] : [owner];
  return owners
    .map((key) => people[key] ? { owner: key, ...people[key] } : null)
    .filter((person) => person && person.peer && !person.peer.includes("<"));
}
