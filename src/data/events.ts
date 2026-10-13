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
  const base = { entity: source.entity, title: raw.summary?.trim() || '(no title)', color: source.color };

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

function compareDayEvents(a: DayEvent, b: DayEvent): number {
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  if (a.continued !== b.continued) return a.continued ? -1 : 1;
  const byStart = a.event.start.getTime() - b.event.start.getTime();
  return byStart !== 0 ? byStart : a.event.title.localeCompare(b.event.title);
}

export async function fetchEvents(
  hass: HomeAssistant,
  entities: EntityConfig[],
  start: Date,
  end: Date,
): Promise<FetchResult[]> {
  const query = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  const settled = await Promise.allSettled(
    entities.map((e) => hass.callApi<HaCalendarEvent[]>('GET', `calendars/${e.entity}?${query}`)),
  );
  return settled.map((outcome, i) => {
    const source = entities[i];
    if (outcome.status === 'rejected') {
      return { entity: source.entity, error: `${source.entity}: ${errorMessage(outcome.reason)}` };
    }
    const events = outcome.value
      .map((raw) => normalizeEvent(raw, source))
      .filter((e): e is WallCalEvent => e !== null);
    return { entity: source.entity, events };
  });
}

export function mergeResults(prev: EventCache | null, rangeKey: string, results: FetchResult[]): EventCache {
  const kept = prev && prev.rangeKey === rangeKey ? prev.byEntity : {};
  const byEntity: Record<string, WallCalEvent[]> = {};
  for (const result of results) {
    if (result.events) byEntity[result.entity] = result.events;
    else if (kept[result.entity]) byEntity[result.entity] = kept[result.entity];
  }
  return { rangeKey, byEntity };
}

export function cachedEvents(cache: EventCache | null): WallCalEvent[] {
  return cache ? Object.values(cache.byEntity).flat() : [];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return String(error);
}
