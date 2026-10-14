// One list per device, shared by every card; a card only applies it to calendars it has a chip for.
const HIDDEN_KEY = 'wallcal:hidden-calendars';

// undefined means storage itself is unreachable; corrupt contents still count as readable (empty).
function readStored(): Set<string> | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(HIDDEN_KEY);
  } catch {
    return undefined;
  }
  try {
    const stored: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function loadHidden(): Set<string> {
  return readStored() ?? new Set();
}

// Re-reads storage first so another card on the page that toggled a different calendar is kept;
// falls back to the card's own set when storage is blocked, so the choice still lasts until reload.
export function toggleHidden(entity: string, current: Set<string>): Set<string> {
  const hidden = new Set(readStored() ?? current);
  if (!hidden.delete(entity)) hidden.add(entity);
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    // Storage blocked (private mode, kiosk policy).
  }
  return hidden;
}
