// One list per device, shared by every card; a card only applies it to calendars it has a chip for.
const HIDDEN_KEY = 'wallcal:hidden-calendars';

export function loadHidden(): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

// Re-reads storage first so another card on the page that toggled a different calendar is kept.
export function toggleHidden(entity: string): Set<string> {
  const hidden = loadHidden();
  if (!hidden.delete(entity)) hidden.add(entity);
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    // Storage blocked (private mode, kiosk policy): the choice lasts until reload.
  }
  return hidden;
}
