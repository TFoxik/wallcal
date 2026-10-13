import { describe, expect, it } from 'vitest';
import { isSameWeek, weekDates } from '../src/week';
import type { Weekday } from '../src/date';

const dates = (list: Date[]) => list.map((d) => `${d.getMonth() + 1}-${d.getDate()}`);

describe('weekDates, 7 days', () => {
  const tue = new Date(2026, 9, 13, 15, 30);

  it('starts on Monday', () => {
    expect(dates(weekDates(tue, 7, 1))).toEqual(['10-12', '10-13', '10-14', '10-15', '10-16', '10-17', '10-18']);
  });

  it('starts on Sunday', () => {
    expect(dates(weekDates(tue, 7, 0))).toEqual(['10-11', '10-12', '10-13', '10-14', '10-15', '10-16', '10-17']);
  });

  it('starts on Saturday', () => {
    expect(dates(weekDates(tue, 7, 6))[0]).toBe('10-10');
  });

  it('includes the anchor when the anchor is the first day', () => {
    expect(dates(weekDates(new Date(2026, 9, 12), 7, 1))[0]).toBe('10-12');
  });

  it.each([0, 1, 2, 3, 4, 5, 6] as Weekday[])('first_day %i: starts on that weekday and contains the anchor', (fd) => {
    const week = weekDates(tue, 7, fd);
    expect(week[0].getDay()).toBe(fd);
    expect(dates(week)).toContain('10-13');
  });

  it('produces 7 distinct local midnights across DST end', () => {
    const week = weekDates(new Date(2026, 9, 25, 12), 7, 1);
    expect(dates(week)).toEqual(['10-19', '10-20', '10-21', '10-22', '10-23', '10-24', '10-25']);
    expect(week.every((d) => d.getHours() === 0)).toBe(true);
  });
});

describe('weekDates, 5 days', () => {
  it('shows Monday to Friday on a weekday', () => {
    expect(dates(weekDates(new Date(2026, 9, 16), 5, 0))).toEqual(['10-12', '10-13', '10-14', '10-15', '10-16']);
  });

  it('looks ahead on Saturday', () => {
    expect(dates(weekDates(new Date(2026, 9, 17), 5, 1))).toEqual(['10-19', '10-20', '10-21', '10-22', '10-23']);
  });

  it('looks ahead on Sunday', () => {
    expect(dates(weekDates(new Date(2026, 9, 18), 5, 1))[0]).toBe('10-19');
  });
});

describe('isSameWeek', () => {
  it('treats the weekend as the coming week in 5-day mode', () => {
    expect(isSameWeek(new Date(2026, 9, 17), new Date(2026, 9, 19), 5, 1)).toBe(true);
  });

  it('separates weeks by first_day in 7-day mode', () => {
    expect(isSameWeek(new Date(2026, 9, 17), new Date(2026, 9, 19), 7, 1)).toBe(false);
    expect(isSameWeek(new Date(2026, 9, 12), new Date(2026, 9, 18), 7, 1)).toBe(true);
  });
});
