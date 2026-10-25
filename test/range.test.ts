import { describe, expect, it } from 'vitest';
import { rangeDates, rangeFor } from '../src/range';

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const wed = new Date(2026, 9, 14, 15, 30);

describe('rangeFor', () => {
  it('week view keeps the week', () => {
    const range = rangeFor({ view: 'week', days: 7, first_day: 1 }, wed, wed);
    expect(ymd(range.start)).toBe('2026-10-12');
    expect(range.days).toBe(7);
  });

  it('week view follows the shown week, not today', () => {
    const range = rangeFor({ view: 'week', days: 5, first_day: 1 }, new Date(2026, 9, 21), wed);
    expect(ymd(range.start)).toBe('2026-10-19');
    expect(range.days).toBe(5);
  });

  it.each(['agenda', 'upcoming'] as const)('%s view rolls 7 days from today', (view) => {
    const range = rangeFor({ view, days: 5, first_day: 0 }, new Date(2026, 9, 21), wed);
    expect(ymd(range.start)).toBe('2026-10-14');
    expect(range.start.getHours()).toBe(0);
    expect(range.days).toBe(7);
  });
});

describe('rangeDates', () => {
  it('lists each day', () => {
    expect(rangeDates({ start: new Date(2026, 9, 29), days: 7 }).map(ymd)).toEqual([
      '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-1', '2026-11-2', '2026-11-3', '2026-11-4',
    ]);
  });
});
