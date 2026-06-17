const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

export function parseInstant(value) {
  return value ? new Date(value) : new Date();
}

export function cstParts(date) {
  const shifted = new Date(date.getTime() + CST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

export function makeCstDate({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

export function formatCst(date) {
  const parts = cstParts(date);
  const pad = (value) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}+08:00`;
}

export function addDaysCst(date, days) {
  const parts = cstParts(date);
  return makeCstDate({ ...parts, day: parts.day + days });
}

export function setCstTime(date, hour, minute = 0) {
  const parts = cstParts(date);
  return makeCstDate({ ...parts, hour, minute, second: 0 });
}

export function parseDuration(duration) {
  // Agent-created tasks use bare minutes (e.g. advance: [10]); also accept ISO PT..M/H.
  if (typeof duration === "number" && Number.isFinite(duration)) return duration * 60 * 1000;
  if (typeof duration === "string" && /^\d+$/.test(duration.trim())) return Number(duration.trim()) * 60 * 1000;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(duration);
  if (!match) throw new Error(`Unsupported duration: ${duration}`);
  return ((Number(match[1] || 0) * 60) + Number(match[2] || 0)) * 60 * 1000;
}

export function quietHours(date) {
  const parts = cstParts(date);
  return parts.hour >= 23 || parts.hour < 7 || (parts.hour === 7 && parts.minute < 30);
}

export function sameOrAfter(now, trigger) {
  return now.getTime() >= trigger.getTime();
}

export function minutesBetween(from, to) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}
