import type { OverlayConfig } from '../config';

// One map per device, shared by every card. The key includes a hash of the card config so the same
// position on two dashboards keeps its own state.
const OVERLAYS_KEY = 'wallcal:overlays';

export type OverlayState = Record<string, boolean>;

export function overlayKey(overlay: Pick<OverlayConfig, 'position' | 'card'>): string {
  return `${overlay.position}:${hash(JSON.stringify(overlay.card))}`;
}

// undefined means storage itself is unreachable; corrupt contents still count as readable (empty).
function readStored(): OverlayState | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(OVERLAYS_KEY);
  } catch {
    return undefined;
  }
  try {
    const stored: unknown = JSON.parse(raw ?? '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    return Object.fromEntries(
      Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    );
  } catch {
    return {};
  }
}

export function loadOverlayState(): OverlayState {
  return readStored() ?? {};
}

export function isOverlayShown(overlay: OverlayConfig, state: OverlayState): boolean {
  if (overlay.toggle === 'none') return true;
  return state[overlayKey(overlay)] ?? overlay.visible;
}

// Re-reads storage first so another card's choices are kept; falls back to the card's own state when
// storage is blocked. Flips what this card shows, which stays right when a write silently failed.
export function toggleOverlay(overlay: OverlayConfig, current: OverlayState): OverlayState {
  const state = { ...(readStored() ?? current) };
  state[overlayKey(overlay)] = !isOverlayShown(overlay, current);
  try {
    localStorage.setItem(OVERLAYS_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked (private mode, kiosk policy).
  }
  return state;
}

// FNV-1a: only needs to tell card configs apart.
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
