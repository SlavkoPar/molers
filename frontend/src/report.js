const pad = (n) => String(n).padStart(2, "0");

/** Calendar date (YYYY-MM-DD) of a timestamp in the viewer's own time zone. */
export const dateKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const dateLabel = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Calls with no known author (uploaded with the API key, or saved before authors were tracked). */
export const UNKNOWN_USER = "Unknown user";

export const DATE_LEVEL = {
  key: (call) => dateKey(call.calledAt),
  label: dateLabel,
  compare: (a, b) => b.key.localeCompare(a.key), // newest day first
};

export const USER_LEVEL = {
  key: (call) => call.userId ?? "",
  label: (key, calls) => calls[0].userName || UNKNOWN_USER,
  // alphabetical, unknown author last
  compare: (a, b) =>
    (a.key === "") - (b.key === "") || a.label.localeCompare(b.label),
};

export function totals(calls) {
  let durationSeconds = 0;
  let priceCents = 0;
  for (const c of calls) {
    durationSeconds += c.durationSeconds ?? 0;
    priceCents += c.priceCents ?? 0;
  }
  return { count: calls.length, durationSeconds, priceCents };
}

/**
 * Group calls by each level in turn. Returns nodes { key, label, calls, children }, where
 * children is the next level's nodes and null at the last level.
 */
export function buildTree(calls, levels) {
  if (levels.length === 0) return null;
  const [level, ...rest] = levels;
  const groups = new Map();
  for (const call of calls) {
    const key = level.key(call);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(call);
  }
  return [...groups.entries()]
    .map(([key, groupCalls]) => ({
      key,
      label: level.label(key, groupCalls),
      calls: groupCalls,
      children: buildTree(groupCalls, rest),
    }))
    .sort(level.compare);
}
