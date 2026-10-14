// Per-device JSON in localStorage. undefined means storage itself is unreachable (blocked), which
// callers treat differently from a missing or corrupt value (null): only then do they fall back to
// the state they already hold, so a choice still lasts until reload.
export function readJson(key: string): unknown {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return undefined;
  }
  try {
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full (private mode, kiosk policy): the caller keeps its in-memory state.
  }
}
