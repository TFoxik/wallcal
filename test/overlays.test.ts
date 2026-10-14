// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeConfig, type OverlayConfig } from '../src/config';
import { isOverlayShown, loadOverlayState, overlayKey, toggleOverlay } from '../src/data/overlays';

const todo = { type: 'todo-list', entity: 'todo.shopping' };
const make = (extra: Record<string, unknown> = {}): OverlayConfig =>
  normalizeConfig({ entities: ['calendar.family'], overlays: [{ position: 'bottom-right', card: todo, ...extra }] }).overlays[0];

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('overlayKey', () => {
  it('is stable for the same config and changes with position or card', () => {
    const key = overlayKey(make());
    expect(overlayKey(make())).toBe(key);
    expect(key.startsWith('bottom-right:')).toBe(true);
    expect(overlayKey(make({ position: 'bottom-left' }))).not.toBe(key);
    expect(overlayKey(make({ card: { ...todo, entity: 'todo.chores' } }))).not.toBe(key);
  });
});

describe('overlay visibility', () => {
  it('uses visible until the device toggles it', () => {
    expect(isOverlayShown(make(), {})).toBe(false);
    expect(isOverlayShown(make({ visible: true }), {})).toBe(true);
  });

  it('always shows an overlay without a toggle', () => {
    const o = make({ toggle: false });
    expect(isOverlayShown(o, { [overlayKey(o)]: false })).toBe(true);
  });

  it('toggles and remembers the choice', () => {
    const o = make();
    const shown = toggleOverlay(o, {});
    expect(isOverlayShown(o, shown)).toBe(true);
    expect(isOverlayShown(o, loadOverlayState())).toBe(true);
    expect(isOverlayShown(o, toggleOverlay(o, shown))).toBe(false);
    expect(isOverlayShown(o, loadOverlayState())).toBe(false);
  });

  it('keeps other overlays stored by another card', () => {
    localStorage.setItem('wallcal:overlays', JSON.stringify({ 'bottom-left:abc': true }));
    toggleOverlay(make(), {});
    expect(loadOverlayState()['bottom-left:abc']).toBe(true);
  });

  it('ignores unreadable or malformed storage', () => {
    localStorage.setItem('wallcal:overlays', '{broken');
    expect(loadOverlayState()).toEqual({});
    localStorage.setItem('wallcal:overlays', JSON.stringify({ a: true, b: 'yes' }));
    expect(loadOverlayState()).toEqual({ a: true });
  });

  it('keeps toggling when storage can be read but not written', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const o = make();
    const shown = toggleOverlay(o, {});
    expect(setItem).toHaveBeenCalled();
    expect(localStorage.getItem('wallcal:overlays')).toBeNull();
    expect(isOverlayShown(o, shown)).toBe(true);
    expect(isOverlayShown(o, toggleOverlay(o, shown))).toBe(false);
  });

  it('keeps toggling while storage is blocked', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const o = make();
    const shown = toggleOverlay(o, {});
    expect(isOverlayShown(o, shown)).toBe(true);
    expect(isOverlayShown(o, toggleOverlay(o, shown))).toBe(false);
  });
});
