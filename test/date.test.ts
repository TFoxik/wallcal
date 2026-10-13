import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isSameDay, msUntilNextMidnight, parseLocalDate, startOfDay } from '../src/date';

describe('date helpers (Europe/Prague)', () => {
  it('startOfDay drops the time', () => {
    const d = startOfDay(new Date(2026, 9, 13, 17, 45));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 13, 0, 0]);
  });

  it('addDays lands on local midnight across DST end (25 Oct 2026)', () => {
    const d = addDays(new Date(2026, 9, 24), 2);
    expect([d.getDate(), d.getHours()]).toEqual([26, 0]);
  });

  it('addDays handles negative offsets and month boundaries', () => {
    const d = addDays(new Date(2026, 10, 1), -1);
    expect([d.getMonth(), d.getDate()]).toEqual([9, 31]);
  });

  it('daysBetween counts calendar days across DST start (29 Mar 2026)', () => {
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
    expect(daysBetween(new Date(2026, 2, 30, 23, 0), new Date(2026, 2, 28, 1, 0))).toBe(-2);
  });

  it('isSameDay ignores time of day', () => {
    expect(isSameDay(new Date(2026, 9, 13, 0, 1), new Date(2026, 9, 13, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 13), new Date(2026, 9, 14))).toBe(false);
  });

  it('parseLocalDate accepts YYYY-MM-DD and rejects anything else', () => {
    const d = parseLocalDate('2026-10-02');
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 2, 0]);
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('2026-10-02T10:00')).toBeNull();
    expect(parseLocalDate('nope')).toBeNull();
  });

  it('msUntilNextMidnight is wall-clock aware', () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 13, 23, 59, 0))).toBe(60_000);
    expect(msUntilNextMidnight(new Date(2026, 9, 24, 23, 0, 0))).toBe(3_600_000);
  });
});
