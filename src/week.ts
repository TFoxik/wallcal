import { addDays, startOfDay, type Weekday } from './date';

export type DayCount = 5 | 7;

export function weekStart(anchor: Date, days: DayCount, firstDay: Weekday): Date {
  const day = startOfDay(anchor);
  const dow = day.getDay();
  if (days === 5) return addDays(day, dow === 6 ? 2 : dow === 0 ? 1 : 1 - dow);
  return addDays(day, -((dow - firstDay + 7) % 7));
}

export function weekDates(anchor: Date, days: DayCount, firstDay: Weekday): Date[] {
  const first = weekStart(anchor, days, firstDay);
  return Array.from({ length: days }, (_, i) => addDays(first, i));
}

export function isSameWeek(a: Date, b: Date, days: DayCount, firstDay: Weekday): boolean {
  return weekStart(a, days, firstDay).getTime() === weekStart(b, days, firstDay).getTime();
}
