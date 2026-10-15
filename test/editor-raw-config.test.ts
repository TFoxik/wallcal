import { describe, expect, it } from 'vitest';
import { applyFormChange, clearAt, deepEqual, getAt, setAt } from '../src/editor/raw-config';
import { deepFreeze } from './fixtures';

describe('deepEqual', () => {
  it('compares nested objects, arrays and dates', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual(new Date(2026, 9, 2), new Date(2026, 9, 2))).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
});

describe('setAt / getAt', () => {
  it('sets a nested value without touching the input', () => {
    const raw = deepFreeze({ type: 'custom:wallcal-card', moon: { enabled: true } });
    const next = setAt(raw, ['moon', 'hemisphere'], 'south');
    expect(next).toEqual({ type: 'custom:wallcal-card', moon: { enabled: true, hemisphere: 'south' } });
    expect(raw.moon).toEqual({ enabled: true });
    expect(getAt(next, ['moon', 'hemisphere'])).toBe('south');
  });

  it('creates missing parents and replaces array items', () => {
    expect(setAt({}, ['header', 'title'], 'range')).toEqual({ header: { title: 'range' } });
    expect(setAt({ list: ['a', 'b'] }, ['list', 1], 'c')).toEqual({ list: ['a', 'c'] });
  });
});

describe('clearAt', () => {
  it('removes a key and prunes the emptied parent', () => {
    expect(clearAt({ days: 5, moon: { enabled: true } }, ['moon', 'enabled'])).toEqual({ days: 5 });
  });

  it('returns the same object when there is nothing to remove', () => {
    const raw = deepFreeze({ days: 5 });
    expect(clearAt(raw, ['moon', 'enabled'])).toBe(raw);
    expect(clearAt(raw, ['weeks'])).toBe(raw);
  });

  it('never removes array items', () => {
    const raw = { list: ['a'] };
    expect(clearAt(raw, ['list', 0])).toBe(raw);
  });
});

describe('applyFormChange', () => {
  const rules = {
    defaults: { days: 7, show_end_time: false, name: undefined },
    fromForm: (f: Record<string, unknown>) => ({ ...f, days: Number(f.days) }),
  };

  it('writes only the fields that changed', () => {
    const raw = deepFreeze({ type: 'custom:wallcal-card', days: 7, custom: 1 });
    const before = { days: '7', show_end_time: false };
    const next = applyFormChange(raw, [], before, { ...before, days: '5' }, rules);
    expect(next).toEqual({ type: 'custom:wallcal-card', days: 5, custom: 1 });
  });

  it('removes a field set back to its default or emptied', () => {
    const before = { days: '5', show_end_time: true, name: 'x' };
    const next = applyFormChange({ days: 5, show_end_time: true, name: 'x' }, [], before, { days: '7', show_end_time: false, name: '' }, rules);
    expect(next).toEqual({});
  });

  it('leaves an explicit default alone when it did not change', () => {
    const before = { days: '7', show_end_time: false };
    const next = applyFormChange({ days: 7 }, [], before, { ...before, show_end_time: true }, rules);
    expect(next).toEqual({ days: 7, show_end_time: true });
  });

  it('works under a prefix', () => {
    const next = applyFormChange({}, ['moon'], { enabled: false }, { enabled: true }, { defaults: { enabled: false } });
    expect(next).toEqual({ moon: { enabled: true } });
  });
});
