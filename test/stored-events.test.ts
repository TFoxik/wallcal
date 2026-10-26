// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { addDays } from '../src/date';
import type { WallCalEvent } from '../src/data/events';
import { loadStoredEvents, storeEvents } from '../src/data/stored-events';
import { rangeKeyOf } from '../src/data/weeks';

afterEach(() => localStorage.clear());

const monday = new Date(2026, 9, 12);
const tuesday = new Date(2026, 9, 13);
const event: WallCalEvent = {
  entity: 'calendar.names',
  title: 'Marek',
  start: tuesday,
  end: new Date(2026, 9, 14),
  allDay: true,
  color: '#7c4dff',
  suffix: 'SK',
};
const cache = { rangeKey: 'x', byEntity: { 'calendar.names': [event] } };

describe('stored events', () => {
  it('round-trips events with their dates, under the asked range', () => {
    storeEvents('a', monday, 7, tuesday, cache);
    expect(loadStoredEvents('a', monday, 7, tuesday)).toEqual({ rangeKey: rangeKeyOf(monday, 7), byEntity: cache.byEntity });
  });

  it('serves a later range that shares days with the stored one', () => {
    storeEvents('a', monday, 7, monday, cache);
    expect(loadStoredEvents('a', tuesday, 7, tuesday)?.byEntity).toEqual(cache.byEntity);
    expect(loadStoredEvents('b', tuesday, 7, tuesday)).toBeNull();
  });

  it('neither stores nor serves a range without today', () => {
    storeEvents('a', addDays(monday, 7), 7, tuesday, cache);
    expect(loadStoredEvents('a', addDays(monday, 7), 7, addDays(monday, 7))).toBeNull();
    storeEvents('a', monday, 7, tuesday, cache);
    expect(loadStoredEvents('a', addDays(monday, 7), 7, tuesday)).toBeNull();
  });

  it('keeps the four most recent calendar sets', () => {
    for (const source of ['a', 'b', 'c', 'd', 'e']) storeEvents(source, monday, 7, tuesday, cache);
    storeEvents('b', monday, 7, tuesday, cache);
    expect(['a', 'b', 'c', 'd', 'e'].map((s) => loadStoredEvents(s, monday, 7, tuesday) !== null)).toEqual([false, true, true, true, true]);
  });

  it.each([
    ['unparsable JSON', '{broken'],
    ['an event with the wrong shape', [{ title: 1 }]],
    ['a calendar entry that is not a list', 'x'],
  ])('ignores %s', (_, bad) => {
    const entry = { source: 'a', start: monday.getTime(), end: addDays(monday, 7).getTime(), byEntity: { c: bad } };
    localStorage.setItem('wallcal:events', bad === '{broken' ? bad : JSON.stringify([entry]));
    expect(loadStoredEvents('a', monday, 7, tuesday)).toBeNull();
  });
});
