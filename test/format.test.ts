import { describe, expect, it } from 'vitest';
import { formatTime, formatTitle, formatWeekday, formatter, resolveHourCycle } from '../src/format';

const norm = (s: string) => s.replace(/\s+/g, ' ');
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('resolveHourCycle', () => {
  it('honours explicit 12 / 24', () => {
    expect(resolveHourCycle('12', { language: 'cs', time_format: '24' })).toBe('h12');
    expect(resolveHourCycle('24', { language: 'en-US', time_format: '12' })).toBe('h23');
  });

  it('auto follows the HA profile setting', () => {
    expect(resolveHourCycle('auto', { language: 'en-US', time_format: '24' })).toBe('h23');
    expect(resolveHourCycle('auto', { language: 'cs', time_format: '12' })).toBe('h12');
  });

  it('auto + "language" follows the language default', () => {
    expect(resolveHourCycle('auto', { language: 'en-US', time_format: 'language' })).toBe('h12');
    expect(resolveHourCycle('auto', { language: 'cs', time_format: 'language' })).toBe('h23');
  });
});

describe('formatTime', () => {
  const t = new Date(2026, 9, 13, 14, 5);
  it('24h', () => expect(formatTime(t, 'en-US', 'h23')).toBe('14:05'));
  it('12h', () => expect(norm(formatTime(t, 'en-US', 'h12'))).toBe('2:05 PM'));
});

describe('formatter', () => {
  it('reuses instances for the same language and options', () => {
    expect(formatter('en-US', { weekday: 'short' })).toBe(formatter('en-US', { weekday: 'short' }));
    expect(formatter('en-US', { weekday: 'short' })).not.toBe(formatter('cs', { weekday: 'short' }));
  });
});

describe('formatWeekday', () => {
  it('short localised weekday', () => expect(formatWeekday(d(2026, 10, 13), 'en-US')).toBe('Tue'));
});

describe('formatTitle', () => {
  it('month, single month', () => {
    expect(formatTitle([d(2026, 10, 12), d(2026, 10, 18)], 'month', 'en-US')).toBe('October 2026');
  });
  it('month, spanning two months', () => {
    expect(norm(formatTitle([d(2026, 9, 28), d(2026, 10, 4)], 'month', 'en-US'))).toBe('Sep – Oct 2026');
  });
  it('month, spanning two years', () => {
    expect(norm(formatTitle([d(2026, 12, 28), d(2027, 1, 3)], 'month', 'en-US'))).toBe('Dec 2026 – Jan 2027');
  });
  it('range, single month', () => {
    expect(norm(formatTitle([d(2026, 10, 12), d(2026, 10, 18)], 'range', 'en-US'))).toBe('Oct 12 – 18');
  });
  it('range, spanning two months', () => {
    expect(norm(formatTitle([d(2026, 9, 28), d(2026, 10, 4)], 'range', 'en-US'))).toBe('Sep 28 – Oct 4');
  });
});
