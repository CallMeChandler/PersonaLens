const PREFIX = "personalens:lastRun:";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function saveLastRun(section, payload) {
  if (!section) return;
  try {
    const key = `${PREFIX}${section}`;
    const value = JSON.stringify({
      savedAt: new Date().toISOString(),
      section,
      payload,
    });
    localStorage.setItem(key, value);
  } catch {
    // ignore (private mode / storage full / SSR)
  }
}

export function loadLastRun(section) {
  if (!section) return null;
  try {
    const key = `${PREFIX}${section}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return safeParse(raw);
  } catch {
    return null;
  }
}

export function loadAllLastRuns() {
  const sections = ["single", "drift", "timeline", "clusters"];
  const out = {};
  for (const s of sections) out[s] = loadLastRun(s);
  return out;
}

export function countAvailableRuns(all) {
  if (!all) return 0;
  return Object.values(all).filter(Boolean).length;
}
