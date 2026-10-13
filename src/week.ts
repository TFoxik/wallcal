import { addDays, startOfDay, type Weekday } from './date';

export type DayCount = 5 | 7;

export function weekDates(anchor: Date, days: DayCount, firstDay: Weekday): Date[] {
  const day = startOfDay(anchor);
  const dow = day.getDay();
  let offset: number;
  if (days === 5) {
    offset = dow === 6 ? 2 : dow === 0 ? 1 : 1 - dow;
  } else {
    offset = -((dow - firstDay + 7) % 7);
  }
  const first = addDays(day, offset);
  return Array.from({ length: days }, (_, i) => addDays(first, i));
}

export function isSameWeek(a: Date, b: Date, days: DayCount, firstDay: Weekday): boolean {
  return weekDates(a, days, firstDay)[0].getTime() === weekDates(b, days, firstDay)[0].getTime();
}
