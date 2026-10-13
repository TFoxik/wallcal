import { describe, expect, it } from 'vitest';
import { litOnRight, moonPath, moonPhase } from '../src/astro/moon';

const FULL_2026: Array<[number, number]> = [
  [1, 3], [2, 1], [3, 3], [4, 2], [5, 1], [5, 31], [6, 30], [7, 29], [8, 28], [9, 26], [10, 26], [11, 24], [12, 24],
];
const NEW_2026: Array<[number, number]> = [
  [1, 18], [2, 17], [3, 19], [4, 17], [5, 16], [6, 15], [7, 14], [8, 12], [9, 11], [10, 10], [11, 9], [12, 9],
];

describe('moonPhase', () => {
  it.each(FULL_2026)('full moon 2026-%i-%i', (m, d) => {
    const p = moonPhase(new Date(2026, m - 1, d));
    expect(p.illumination).toBeGreaterThan(0.95);
    expect(p.phase).toBe('full');
  });

  it.each(NEW_2026)('new moon 2026-%i-%i', (m, d) => {
    const p = moonPhase(new Date(2026, m - 1, d));
    expect(p.illumination).toBeLessThan(0.05);
    expect(p.phase).toBe('new');
  });

  it('is waxing between new and full', () => {
    const p = moonPhase(new Date(2026, 9, 14));
    expect(p.waxing).toBe(true);
    expect(p.phase).toBe('waxing_crescent');
  });

  it('is waning after full', () => {
    expect(moonPhase(new Date(2026, 9, 30)).waxing).toBe(false);
  });

  it('ignores time of day', () => {
    expect(moonPhase(new Date(2026, 9, 14, 0, 5))).toEqual(moonPhase(new Date(2026, 9, 14, 23, 55)));
  });
});

describe('litOnRight', () => {
  const waxing = moonPhase(new Date(2026, 9, 14));
  it('waxing is lit on the right in the north and on the left in the south', () => {
    expect(litOnRight(waxing, 'north')).toBe(true);
    expect(litOnRight(waxing, 'south')).toBe(false);
  });
});

describe('moonPath', () => {
  it('first quarter has a straight terminator', () => {
    expect(moonPath(0.5, true, 10, 10, 10)).toBe('M 10 0 A 10 10 0 0 1 10 20 A 0 10 0 0 0 10 0 Z');
  });

  it('full moon is a full disc', () => {
    expect(moonPath(1, true, 10, 10, 10)).toBe('M 10 0 A 10 10 0 0 1 10 20 A 10 10 0 0 1 10 0 Z');
  });

  it('waning crescent is lit on the left with an inward terminator', () => {
    expect(moonPath(0.25, false, 10, 10, 10)).toBe('M 10 0 A 10 10 0 0 0 10 20 A 5 10 0 0 1 10 0 Z');
  });
});
