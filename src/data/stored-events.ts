import { addDays, daysBetween } from '../date';
import type { EventCache, WallCalEvent } from './events';
import { readJson, writeJson } from './storage';
import { rangeKeyOf } from './weeks';

// The events a card last showed, per set of calendars, so a card created fresh (a page load, a pop-up
// opened for the first time) has something to show while its calendars answer.
const KEY = 'wallcal:events';
// A tablet and a phone pop-up use different calendar sets; a few entries cover every card on one device.
const SOURCES_KEPT = 4;

interface StoredEntry {
  source: string;
  start: number;
  end: number;
  byEntity: Record<string, WallCalEvent[]>;
}

// Only the range that holds today is kept: browsing to another week neither replaces it nor gets a
// neighbour week half filled from it.
function holdsToday(start: Date, days: number, today: Date): boolean {
  const offset = daysBetween(start, today);
  return offset >= 0 && offset < days;
}

// Yesterday's copy still fits today's range except for its last day, which shows empty until the
// calendars answer.
export function loadStoredEvents(source: string, start: Date, days: number, today: Date): EventCache | null {
  if (!holdsToday(start, days, today)) return null;
  const end = addDays(start, days).getTime();
  const entry = storedEntries().find((e) => e.source === source);
  if (!entry || entry.start >= end || entry.end <= start.getTime()) return null;
  const byEntity: Record<string, WallCalEvent[]> = {};
  for (const [entity, events] of Object.entries(entry.byEntity)) {
    if (!Array.isArray(events)) return null;
    const revived = events.map(revive);
    if (revived.some((e) => e === null)) return null;
    byEntity[entity] = revived as WallCalEvent[];
  }
  return { rangeKey: rangeKeyOf(start, days), byEntity };
}

export function storeEvents(source: string, start: Date, days: number, today: Date, cache: EventCache): void {
  if (!holdsToday(start, days, today)) return;
  const entry: StoredEntry = { source, start: start.getTime(), end: addDays(start, days).getTime(), byEntity: cache.byEntity };
  const others = storedEntries().filter((e) => e.source !== source);
  writeJson(KEY, [entry, ...others].slice(0, SOURCES_KEPT));
}

function storedEntries(): StoredEntry[] {
  const value = readJson(KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (e): e is StoredEntry =>
      !!e &&
      typeof e === 'object' &&
      typeof e.source === 'string' &&
      typeof e.start === 'number' &&
      typeof e.end === 'number' &&
      !!e.byEntity &&
      typeof e.byEntity === 'object',
  );
}

// JSON turned the dates into ISO strings.
function revive(raw: unknown): WallCalEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const start = new Date(e.start as string);
  const end = new Date(e.end as string);
  if (
    typeof e.entity !== 'string' ||
    typeof e.title !== 'string' ||
    typeof e.color !== 'string' ||
    typeof e.allDay !== 'boolean' ||
    typeof e.start !== 'string' ||
    typeof e.end !== 'string' ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }
  return {
    entity: e.entity,
    title: e.title,
    start,
    end,
    allDay: e.allDay,
    color: e.color,
    ...(typeof e.suffix === 'string' ? { suffix: e.suffix } : {}),
  };
}
