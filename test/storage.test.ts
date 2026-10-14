// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readJson, writeJson } from '../src/data/storage';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('readJson / writeJson', () => {
  it('round-trips a value', () => {
    writeJson('wallcal:test', { a: true });
    expect(readJson('wallcal:test')).toEqual({ a: true });
  });

  it('reads a missing or corrupt value as null', () => {
    expect(readJson('wallcal:test')).toBeNull();
    localStorage.setItem('wallcal:test', '{broken');
    expect(readJson('wallcal:test')).toBeNull();
  });

  it('reads unreachable storage as undefined, so callers can fall back to their own state', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readJson('wallcal:test')).toBeUndefined();
    expect(getItem).toHaveBeenCalled();
  });

  it('ignores a write that storage refuses', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeJson('wallcal:test', [1])).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });
});
