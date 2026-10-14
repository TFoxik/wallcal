import type { DayEvent } from './data/events';
import type { HassLocale } from './ha-types';

export const TIME_FORMATS = ['12', '24', 'auto'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];
export type HourCycle = 'h12' | 'h23';
export const WEEKDAY_FORMATS = ['short', 'long'] as const;
export type WeekdayFormat = (typeof WEEKDAY_FORMATS)[number];

export const TITLE_MODES = ['month', 'range'] as const;
export type TitleMode = (typeof TITLE_MODES)[number];

// Constructing an Intl.DateTimeFormat costs far more than formatting with one; old tablets feel it.
const cache = new Map<string, Intl.DateTimeFormat>();

export function formatter(language: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${language ?? ''}|${JSON.stringify(options)}`;
  let instance = cache.get(key);
  if (!instance) {
    instance = new Intl.DateTimeFormat(language, options);
    cache.set(key, instance);
  }
  return instance;
}

// formatRange costs about 30 times a plain format, and every render formats each event again.
const ranges = new Map<string, string>();

function formatRange(language: string, options: Intl.DateTimeFormatOptions, start: Date, end: Date): string {
  const key = `${language}|${JSON.stringify(options)}|${start.getTime()}|${end.getTime()}`;
  let text = ranges.get(key);
  if (text === undefined) {
    // Weeks a wall display moves through would otherwise pile up here for its whole uptime.
    if (ranges.size >= 1000) ranges.clear();
    text = formatter(language, options).formatRange(start, end);
    ranges.set(key, text);
  }
  return text;
}

export function resolveHourCycle(timeFormat: TimeFormat, locale: HassLocale): HourCycle {
  if (timeFormat === '12') return 'h12';
  if (timeFormat === '24') return 'h23';
  if (locale.time_format === '12') return 'h12';
  if (locale.time_format === '24') return 'h23';
  const language = locale.time_format === 'system' ? undefined : locale.language;
  const cycle = formatter(language, { hour: 'numeric' }).resolvedOptions().hourCycle;
  return cycle === 'h11' || cycle === 'h12' ? 'h12' : 'h23';
}

export function formatTime(date: Date, language: string, hourCycle: HourCycle): string {
  return formatter(language, { hour: 'numeric', minute: '2-digit', hourCycle }).format(date);
}

export function formatEventTime(item: DayEvent, language: string, hourCycle: HourCycle, showEnd: boolean): string {
  const { event, continued, endsLater } = item;
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hourCycle };
  const time = formatter(language, options);
  if (!showEnd || endsLater) return continued ? 'continues' : time.format(event.start);
  if (continued) return `until ${time.format(event.end)}`;
  if (event.end.getTime() <= event.start.getTime()) return time.format(event.start);
  return formatRange(language, options, event.start, event.end);
}

export function formatWeekday(date: Date, language: string, style: WeekdayFormat): string {
  return formatter(language, { weekday: style }).format(date);
}

export function formatTitle(dates: Date[], mode: TitleMode, language: string): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (mode === 'range') {
    return formatRange(language, { month: 'short', day: 'numeric' }, first, last);
  }
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return formatter(language, { month: 'long', year: 'numeric' }).format(first);
  }
  return formatRange(language, { month: 'short', year: 'numeric' }, first, last);
}
