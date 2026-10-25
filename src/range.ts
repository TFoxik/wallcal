import type { WallCalConfig } from './config';
import { addDays, startOfDay } from './date';
import { weekStart } from './week';

export interface DayRange {
  start: Date;
  days: number;
}

// The phone views always look ahead from today; only the week view can be moved to another week.
export function rangeFor(config: Pick<WallCalConfig, 'view' | 'days' | 'first_day'>, anchor: Date, today: Date): DayRange {
  if (config.view === 'week') return { start: weekStart(anchor, config.days, config.first_day), days: config.days };
  return { start: startOfDay(today), days: 7 };
}

export function rangeDates(range: DayRange): Date[] {
  return Array.from({ length: range.days }, (_, i) => addDays(range.start, i));
}
