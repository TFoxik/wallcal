import type { EntityConfig } from '../config';
import { addDays, parseLocalDate, startOfDay } from '../date';
import type { HomeAssistant } from '../ha-types';

export interface HaCalendarEvent {
  summary?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

export interface WallCalEvent {
  entity: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  suffix?: string;
}

export interface DayEvent {
  event: WallCalEvent;
  continued: boolean;
  endsLater: boolean;
}

export interface FetchResult {
  entity: string;
  events?: WallCalEvent[];
  error?: string;
}

export interface EventCache {
  rangeKey: string;
  byEntity: Record<string, WallCalEvent[]>;
}

export function normalizeEvent(raw: HaCalendarEvent, source: EntityConfig): WallCalEvent | null {
  const base = {
    entity: source.entity,
    title: eventTitle(raw.summary, source.strip_prefix),
    color: source.color,
    ...(source.suffix ? { suffix: source.suffix } : {}),
  };

  if (raw.start?.date) {
    const start = parseLocalDate(raw.start.date);
    if (!start) return null;
    const end = raw.end?.date ? parseLocalDate(raw.end.date) : null;
    return { ...base, start, end: end && end.getTime() > start.getTime() ? end : addDays(start, 1), allDay: true };
  }

  if (raw.start?.dateTime) {
    const start = new Date(raw.start.dateTime);
    if (Number.isNaN(start.getTime())) return null;
    const end = raw.end?.dateTime ? new Date(raw.end.dateTime) : start;
    const validEnd = !Number.isNaN(end.getTime()) && end.getTime() >= start.getTime() ? end : start;
    return { ...base, start, end: validEnd, allDay: false };
  }

  return null;
}

function eventTitle(summary: string | undefined, stripPrefix: string | undefined): string {
  let title = summary?.trim() ?? '';
  if (stripPrefix && title.startsWith(stripPrefix)) title = title.slice(stripPrefix.length).trim();
  return title || '(no title)';
}

export function eventsForDay(events: WallCalEvent[], day: Date): DayEvent[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(day, 1).getTime();
  return events
    .filter((e) => {
      const start = e.start.getTime();
      const end = e.end.getTime();
      return start < dayEnd && (end > dayStart || start >= dayStart);
    })
    .map((event) => ({
      event,
      continued: !event.allDay && event.start.getTime() < dayStart,
      endsLater: !event.allDay && event.end.getTime() > dayEnd,
    }))
    .sort(compareDayEvents);
}

export function isEnded(item: DayEvent, now: Date): boolean {
  return !item.event.allDay && item.event.end.getTime() <= now.getTime();
}

// The earliest moment after now, still today, at which a timed event ends.
export function nextEventEnd(events: WallCalEvent[], now: Date): Date | null {
  const from = now.getTime();
  const until = addDays(now, 1).getTime();
  let next: number | null = null;
  for (const e of events) {
    const end = e.end.getTime();
    if (!e.allDay && end > from && end < until && (next === null || end < next)) next = end;
  }
  return next === null ? null : new Date(next);
}

function compareDayEvents(a: DayEvent, b: DayEvent): number {
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  if (a.continued !== b.continued) return a.continued ? -1 : 1;
  const byStart = a.event.start.getTime() - b.event.start.getTime();
  return byStart !== 0 ? byStart : a.event.title.localeCompare(b.event.title);
}

// onResult hears each calendar as it answers: a remote one can take seconds while a local one is instant.
export async function fetchEvents(
  hass: HomeAssistant,
  entities: EntityConfig[],
  start: Date,
  end: Date,
  onResult?: (result: FetchResult) => void,
): Promise<FetchResult[]> {
  const query = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  return Promise.all(
    entities.map(async (source) => {
      let result: FetchResult;
      try {
        const raw = await hass.callApi<HaCalendarEvent[]>('GET', `calendars/${source.entity}?${query}`);
        const events = raw.map((r) => normalizeEvent(r, source)).filter((e): e is WallCalEvent => e !== null);
        result = { entity: source.entity, events };
      } catch (error) {
        result = { entity: source.entity, error: `${calendarName(hass, source)}: ${errorMessage(error)}` };
      }
      onResult?.(result);
      return result;
    }),
  );
}

function calendarName(hass: HomeAssistant, source: EntityConfig): string {
  const friendly = hass.states[source.entity]?.attributes?.friendly_name;
  return source.name ?? (typeof friendly === 'string' && friendly.trim() ? friendly : source.entity);
}

// Within the same range, a calendar that failed or hasn't answered yet keeps its last events. Returns
// prev itself when nothing changed, so the card skips the render.
export function mergeResults(prev: EventCache | null, rangeKey: string, results: FetchResult[]): EventCache {
  const kept = prev && prev.rangeKey === rangeKey ? prev.byEntity : {};
  const byEntity: Record<string, WallCalEvent[]> = { ...kept };
  for (const result of results) {
    if (result.events) byEntity[result.entity] = result.events;
  }
  const unchanged = prev !== null && kept === prev.byEntity && JSON.stringify(byEntity) === JSON.stringify(kept);
  return unchanged ? prev : { rangeKey, byEntity };
}

export function cachedEvents(cache: EventCache | null): WallCalEvent[] {
  return cache ? Object.values(cache.byEntity).flat() : [];
}

// hass.callApi rejects with { error, status_code, body } rather than an Error; the server's own message,
// when its reply has one, says more than the status line.
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const { message, error: status, body } = error as { message?: unknown; error?: unknown; body?: unknown };
    if (typeof message === 'string') return message;
    const reply = body && typeof body === 'object' ? (body as { message?: unknown }).message : undefined;
    if (typeof reply === 'string' && reply) return reply;
    if (typeof status === 'string') return status;
  }
  return 'Unknown error';
}
