import { describe, expect, it } from 'vitest';
import {
  cachedEvents,
  errorMessage,
  eventsForDay,
  isEnded,
  nextEventEnd,
  fetchEvents,
  mergeResults,
  normalizeEvent,
  type WallCalEvent,
} from '../src/data/events';
import { makeHass, wallEvent as ev } from './fixtures';

const family = { entity: 'calendar.family', color: '#7F77DD', toggle: false, display: 'chip' as const };
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

  it('strips the configured title prefix and carries the suffix', () => {
    const namedays = { ...family, display: 'label' as const, strip_prefix: 'Svátek:' };
    const raw = { start: { date: '2026-10-12' }, end: { date: '2026-10-13' } };
    expect(normalizeEvent({ ...raw, summary: 'Svátek: Sabina' }, namedays)).toMatchObject({ title: 'Sabina' });
    expect(normalizeEvent({ ...raw, summary: 'Státní svátek' }, namedays)?.title).toBe('Státní svátek');
    expect(normalizeEvent({ ...raw, summary: 'Svátek:' }, namedays)?.title).toBe('(no title)');
    expect(normalizeEvent({ ...raw, summary: 'Sabina' }, { ...namedays, suffix: 'SK' })?.suffix).toBe('SK');
    expect(normalizeEvent({ ...raw, summary: 'Trip' }, family)).not.toHaveProperty('suffix');
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

  it('marks timed events that end after this day', () => {
    const deploy = ev('Deploy', new Date(2026, 9, 12, 23), new Date(2026, 9, 13, 1));
    expect(eventsForDay([deploy], new Date(2026, 9, 12))[0].endsLater).toBe(true);
    expect(eventsForDay([deploy], new Date(2026, 9, 13))[0].endsLater).toBe(false);
    const late = ev('Late', new Date(2026, 9, 12, 22), new Date(2026, 9, 13, 0));
    expect(eventsForDay([late], new Date(2026, 9, 12))[0].endsLater).toBe(false);
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

  it('keeps the previous cache when a refetch brings the same events', () => {
    const prev = { rangeKey: 'r1', byEntity: { 'calendar.a': a, 'calendar.b': b } };
    const same = [
      { entity: 'calendar.a', events: a.map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })) },
      { entity: 'calendar.b', error: 'boom' },
    ];
    expect(mergeResults(prev, 'r1', same)).toBe(prev);
  });

  it('makes a new cache when an event moved', () => {
    const prev = { rangeKey: 'r1', byEntity: { 'calendar.a': a } };
    const moved = [{ ...a[0], end: new Date(2026, 9, 13, 11) }];
    expect(mergeResults(prev, 'r1', [{ entity: 'calendar.a', events: moved }]).byEntity['calendar.a']).toBe(moved);
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
    const { hass, calls: paths } = makeHass(async (path) => {
      if (path.startsWith('calendars/calendar.broken')) throw new Error('not found');
      return [{ summary: 'X', start: { date: '2026-10-13' }, end: { date: '2026-10-14' } }];
    });
    const start = new Date(Date.UTC(2026, 9, 12));
    const end = new Date(Date.UTC(2026, 9, 19));

    const results = await fetchEvents(hass, [family, { entity: 'calendar.broken', color: '#000', toggle: false, display: 'chip' as const }], start, end);

    expect(paths[0]).toBe(
      'calendars/calendar.family?start=2026-10-12T00%3A00%3A00.000Z&end=2026-10-19T00%3A00%3A00.000Z',
    );
    expect(results[0].events?.map((e) => e.title)).toEqual(['X']);
    expect(results[1]).toEqual({ entity: 'calendar.broken', error: 'calendar.broken: not found' });
  });

  it('names a failed calendar by its configured name, then its friendly name', async () => {
    const { hass } = makeHass(async () => {
      throw { error: 'Request error', status_code: undefined, body: undefined };
    });
    hass.states['calendar.work'] = { last_changed: '', attributes: { friendly_name: 'Work' } };
    const chip = { color: '#000', toggle: false, display: 'chip' as const };
    const results = await fetchEvents(
      hass,
      [{ entity: 'calendar.work', ...chip }, { entity: 'calendar.family', name: 'Our family', ...chip }, { entity: 'calendar.other', ...chip }],
      new Date(2026, 9, 12),
      new Date(2026, 9, 19),
    );
    expect(results.map((r) => r.error)).toEqual(['Work: Request error', 'Our family: Request error', 'calendar.other: Request error']);
  });
});

describe('isEnded', () => {
  const now = new Date(2026, 9, 13, 12, 0);
  const at = (h: number, m = 0) => new Date(2026, 9, 13, h, m);
  const item = (e: WallCalEvent, continued = false) => ({ event: e, continued, endsLater: false });

  it('is true once a timed event has ended, including at its exact end', () => {
    expect(isEnded(item(ev('Standup', at(9), at(9, 15))), now)).toBe(true);
    expect(isEnded(item(ev('Lunch', at(11), at(12))), now)).toBe(true);
    expect(isEnded(item(ev('Review', at(11), at(13))), now)).toBe(false);
  });

  it('never ends an all-day event during its day', () => {
    expect(isEnded(item(ev('Holiday', new Date(2026, 9, 12), new Date(2026, 9, 13), true)), now)).toBe(false);
  });

  it('ends an event carried over from yesterday when it finishes today', () => {
    expect(isEnded(item(ev('Night shift', new Date(2026, 9, 12, 22), at(6)), true), now)).toBe(true);
  });
});

describe('nextEventEnd', () => {
  const now = new Date(2026, 9, 13, 12, 0);
  const at = (h: number, m = 0) => new Date(2026, 9, 13, h, m);

  it('finds the earliest end still ahead today', () => {
    const events = [ev('A', at(9), at(10)), ev('B', at(11), at(14)), ev('C', at(12, 30), at(13))];
    expect(nextEventEnd(events, now)).toEqual(at(13));
  });

  it('ignores all-day events and ends after today', () => {
    const events = [ev('Trip', at(0), new Date(2026, 9, 14), true), ev('Late', at(23), new Date(2026, 9, 14, 1))];
    expect(nextEventEnd(events, now)).toBeNull();
  });
});

// Shapes thrown by Home Assistant's frontend fetch helper (hass.callApi), copied from its bundle.
describe('errorMessage', () => {
  it('reads the error of a failed Home Assistant request', () => {
    expect(errorMessage({ error: 'Request error', status_code: undefined, body: undefined })).toBe('Request error');
    expect(errorMessage({ error: 'Unable to parse JSON response', status_code: undefined, body: null })).toBe(
      'Unable to parse JSON response',
    );
  });

  it("prefers the server's own message over the status line", () => {
    expect(errorMessage({ error: 'Response error: 400', status_code: 400, body: { message: 'Invalid date' } })).toBe('Invalid date');
    expect(errorMessage({ error: 'Response error: 500', status_code: 500, body: 'Internal Server Error' })).toBe(
      'Response error: 500',
    );
  });

  it('keeps Errors, messages and strings', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage({ message: 'unknown entity' })).toBe('unknown entity');
    expect(errorMessage('offline')).toBe('offline');
  });

  it('never shows [object Object]', () => {
    expect(errorMessage({ code: 42 })).toBe('Unknown error');
    expect(errorMessage(null)).toBe('Unknown error');
  });
});
