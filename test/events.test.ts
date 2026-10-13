import { describe, expect, it } from 'vitest';
import {
  cachedEvents,
  eventsForDay,
  fetchEvents,
  mergeResults,
  normalizeEvent,
  type WallCalEvent,
} from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';

const family = { entity: 'calendar.family', color: '#7F77DD' };
const ev = (title: string, start: Date, end: Date, allDay = false): WallCalEvent => ({
  entity: 'calendar.family',
  title,
  start,
  end,
  allDay,
  color: '#7F77DD',
});
const titles = (day: Date, events: WallCalEvent[]) => eventsForDay(events, day).map((d) => d.event.title);

describe('normalizeEvent', () => {
  it('reads all-day events as local dates with exclusive end', () => {
    const e = normalizeEvent({ summary: 'Trip', start: { date: '2026-10-12' }, end: { date: '2026-10-15' } }, family);
    expect(e).toMatchObject({ title: 'Trip', allDay: true, color: '#7F77DD', entity: 'calendar.family' });
    expect(e?.start.getDate()).toBe(12);
    expect(e?.end.getDate()).toBe(15);
  });

  it('reads timed events', () => {
    const e = normalizeEvent(
      { summary: 'Dentist', start: { dateTime: '2026-10-13T08:30:00+02:00' }, end: { dateTime: '2026-10-13T09:15:00+02:00' } },
      family,
    );
    expect(e?.allDay).toBe(false);
    expect([e?.start.getHours(), e?.start.getMinutes()]).toEqual([8, 30]);
  });

  it('gives untitled events a placeholder', () => {
    expect(normalizeEvent({ start: { date: '2026-10-12' }, end: { date: '2026-10-13' } }, family)?.title).toBe('(no title)');
  });

  it('drops events without a usable start', () => {
    expect(normalizeEvent({ summary: 'x', start: {}, end: {} }, family)).toBeNull();
    expect(normalizeEvent({ summary: 'x', start: { dateTime: 'garbage' }, end: {} }, family)).toBeNull();
  });

  it('repairs an end before the start', () => {
    const e = normalizeEvent({ summary: 'x', start: { date: '2026-10-12' }, end: { date: '2026-10-12' } }, family);
    expect(e?.end.getDate()).toBe(13);
  });
});

describe('eventsForDay', () => {
  it('shows multi-day all-day events on each covered day and not on the exclusive end', () => {
    const trip = ev('Trip', new Date(2026, 9, 12), new Date(2026, 9, 15), true);
    expect(titles(new Date(2026, 9, 12), [trip])).toEqual(['Trip']);
    expect(titles(new Date(2026, 9, 14), [trip])).toEqual(['Trip']);
    expect(titles(new Date(2026, 9, 15), [trip])).toEqual([]);
  });

  it('marks timed events that started on a previous day as continued', () => {
    const deploy = ev('Deploy', new Date(2026, 9, 12, 23), new Date(2026, 9, 13, 1));
    expect(eventsForDay([deploy], new Date(2026, 9, 12))[0].continued).toBe(false);
    expect(eventsForDay([deploy], new Date(2026, 9, 13))[0].continued).toBe(true);
  });

  it('does not show an event ending exactly at midnight on the next day', () => {
    const late = ev('Late', new Date(2026, 9, 12, 22), new Date(2026, 9, 13, 0));
    expect(titles(new Date(2026, 9, 13), [late])).toEqual([]);
  });

  it('keeps zero-length events', () => {
    const ping = ev('Ping', new Date(2026, 9, 13, 10), new Date(2026, 9, 13, 10));
    expect(titles(new Date(2026, 9, 13), [ping])).toEqual(['Ping']);
  });

  it('sorts all-day, then continued, then by start, then by title', () => {
    const day = new Date(2026, 9, 13);
    const list = [
      ev('B 10:00', new Date(2026, 9, 13, 10), new Date(2026, 9, 13, 11)),
      ev('A 10:00', new Date(2026, 9, 13, 10), new Date(2026, 9, 13, 11)),
      ev('Early', new Date(2026, 9, 13, 8), new Date(2026, 9, 13, 9)),
      ev('Overnight', new Date(2026, 9, 12, 23), new Date(2026, 9, 13, 2)),
      ev('Holiday', new Date(2026, 9, 13), new Date(2026, 9, 14), true),
    ];
    expect(titles(day, list)).toEqual(['Holiday', 'Overnight', 'Early', 'A 10:00', 'B 10:00']);
  });
});

describe('mergeResults', () => {
  const a = [ev('A', new Date(2026, 9, 13, 9), new Date(2026, 9, 13, 10))];
  const b = [ev('B', new Date(2026, 9, 13, 9), new Date(2026, 9, 13, 10))];

  it('keeps the last good events of a failed entity for the same range', () => {
    const prev = { rangeKey: 'r1', byEntity: { 'calendar.a': a, 'calendar.b': b } };
    const next = mergeResults(prev, 'r1', [{ entity: 'calendar.a', error: 'boom' }, { entity: 'calendar.b', events: [] }]);
    expect(next.byEntity).toEqual({ 'calendar.a': a, 'calendar.b': [] });
  });

  it('drops a failed entity when the range changed', () => {
    const prev = { rangeKey: 'r1', byEntity: { 'calendar.a': a } };
    expect(mergeResults(prev, 'r2', [{ entity: 'calendar.a', error: 'boom' }]).byEntity).toEqual({});
  });

  it('flattens cached events', () => {
    expect(cachedEvents({ rangeKey: 'r', byEntity: { x: a, y: b } }).map((e) => e.title)).toEqual(['A', 'B']);
    expect(cachedEvents(null)).toEqual([]);
  });
});

describe('fetchEvents', () => {
  it('queries each entity for the range and reports failures per entity', async () => {
    const paths: string[] = [];
    const hass = {
      states: {},
      locale: { language: 'en', time_format: 'language' },
      callApi: async <T>(_method: string, path: string): Promise<T> => {
        paths.push(path);
        if (path.startsWith('calendars/calendar.broken')) throw new Error('not found');
        return [{ summary: 'X', start: { date: '2026-10-13' }, end: { date: '2026-10-14' } }] as T;
      },
    } as HomeAssistant;
    const start = new Date(Date.UTC(2026, 9, 12));
    const end = new Date(Date.UTC(2026, 9, 19));

    const results = await fetchEvents(hass, [family, { entity: 'calendar.broken', color: '#000' }], start, end);

    expect(paths[0]).toBe(
      'calendars/calendar.family?start=2026-10-12T00%3A00%3A00.000Z&end=2026-10-19T00%3A00%3A00.000Z',
    );
    expect(results[0].events?.map((e) => e.title)).toEqual(['X']);
    expect(results[1]).toEqual({ entity: 'calendar.broken', error: 'calendar.broken: not found' });
  });
});
