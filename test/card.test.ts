// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { suggestCard, WallCalCard } from '../src/wallcal-card';
import type { HaCalendarEvent } from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';
import { dayKey } from '../src/date';
import { layOut, makeHass, stubCardHelpers, timed } from './fixtures';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function mount(config: Record<string, unknown>, hass: HomeAssistant): Promise<WallCalCard> {
  const el = document.createElement('wallcal-card') as WallCalCard;
  el.setConfig(config);
  el.hass = hass;
  document.body.append(el);
  await flush(el);
  return el;
}

async function flush(el: WallCalCard, ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  await el.updateComplete;
}

// Layout-dependent work waits for an animation frame.
const nextFrame = (el: WallCalCard) => flush(el, 16);

const root = (el: WallCalCard) => el.shadowRoot as ShadowRoot;
const firstDate = (el: WallCalCard) => root(el).querySelector('.day__date')?.textContent;
const chipTitles = (el: WallCalCard) => [...root(el).querySelectorAll('.chip__title')].map((n) => n.textContent);
const click = (el: WallCalCard, selector: string) => root(el).querySelector<HTMLButtonElement>(selector)?.click();

const config = { entities: ['calendar.family'] };

const startParam = (weekStart: Date) => `start=${encodeURIComponent(weekStart.toISOString())}`;
// Requests for the week starting on the given day; the card also prefetches the weeks either side.
const fetchesOf = (calls: string[], weekStart = new Date(2026, 9, 12)) =>
  calls.filter((path) => path.includes(startParam(weekStart)));

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 13, 10, 0) });
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.useRealTimers();
});

describe('wallcal-card', () => {
  it('rejects invalid config', () => {
    const el = document.createElement('wallcal-card') as WallCalCard;
    expect(() => el.setConfig({})).toThrow(/at least one calendar/);
  });

  it('shows a custom title with the week range as subtitle', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, header: { title: 'Family calendar', subtitle: 'range' } }, hass);
    expect(root(el).querySelector('.bar__title')?.textContent).toBe('Family calendar');
    expect(root(el).querySelector('.bar__subtitle')?.textContent?.replace(/\s+/g, ' ')).toBe('Oct 12 – 18');
  });

  it('marks the days before today and the past_days mode on the grid', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, past_days: 'dim' }, hass);
    expect(root(el).querySelector('.grid')?.classList.contains('grid--past-dim')).toBe(true);
    expect([...root(el).querySelectorAll('.day--past .day__date')].map((n) => n.textContent)).toEqual(['12']);
  });

  it('renders 7 or 5 day columns', async () => {
    const { hass } = makeHass(async () => []);
    const seven = await mount(config, hass);
    expect(root(seven).querySelectorAll('.day')).toHaveLength(7);
    const five = await mount({ ...config, days: 5 }, hass);
    expect(root(five).querySelectorAll('.day')).toHaveLength(5);
  });

  it('shows fetched events on their day', async () => {
    const { hass } = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
    const el = await mount(config, hass);
    expect(chipTitles(el)).toEqual(['Dentist']);
  });

  it('fetches once on connect and refetches only when a calendar entity changes', async () => {
    const { hass, calls } = makeHass(async () => []);
    const el = await mount(config, hass);
    expect(fetchesOf(calls)).toHaveLength(1);

    el.hass = { ...hass };
    await flush(el);
    expect(fetchesOf(calls)).toHaveLength(1);

    const family = hass.states['calendar.family'];
    el.hass = { ...hass, states: { 'calendar.family': { ...family, last_changed: '2026-10-13T09:00:00Z' } } };
    await flush(el);
    expect(fetchesOf(calls)).toHaveLength(2);
  });

  it('does not re-render on hass updates that do not concern it', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount(config, hass);
    const renders = vi.spyOn(el as unknown as { render(): unknown }, 'render');
    el.hass = { ...hass, states: { ...hass.states, 'light.kitchen': hass.states['calendar.family'] } };
    await flush(el);
    expect(renders).not.toHaveBeenCalled();
  });

  it('does not re-render when a refetch brings the same events', async () => {
    const { hass, calls } = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
    const el = await mount(config, hass);
    const renders = vi.spyOn(el as unknown as { render(): unknown }, 'render');
    el.hass = { ...hass, states: { 'calendar.family': { last_changed: '2026-10-13T09:00:00Z' } } };
    await flush(el);
    expect(fetchesOf(calls)).toHaveLength(2);
    expect(renders).not.toHaveBeenCalled();
  });

  it('refetches on the refresh interval', async () => {
    const { hass, calls } = makeHass(async () => []);
    await mount({ ...config, refresh_interval: 60 }, hass);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchesOf(calls)).toHaveLength(2);
  });

  it('ignores a response that arrives after a newer request', async () => {
    const first = deferred<HaCalendarEvent[]>();
    const second = deferred<HaCalendarEvent[]>();
    const queue = [first, second];
    // Any later request prefetches a neighbouring week and never answers.
    const { hass } = makeHass(() => queue.shift()?.promise ?? new Promise<HaCalendarEvent[]>(() => undefined));
    const el = await mount(config, hass);

    click(el, 'button[aria-label="Next week"]');
    second.resolve([timed('Next week', '2026-10-20T10:00:00+02:00', '2026-10-20T11:00:00+02:00')]);
    await flush(el);
    first.resolve([timed('Stale', '2026-10-20T12:00:00+02:00', '2026-10-20T13:00:00+02:00')]);
    await flush(el);

    expect(chipTitles(el)).toEqual(['Next week']);
  });

  it('shows each calendar as soon as it answers', async () => {
    const slow = deferred<HaCalendarEvent[]>();
    const { hass } = makeHass((path) =>
      path.startsWith('calendars/calendar.names')
        ? slow.promise
        : Promise.resolve([timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]),
    );
    const el = await mount({ entities: ['calendar.family', 'calendar.names'] }, hass);
    expect(chipTitles(el)).toEqual(['Dentist']);
    slow.resolve([timed('Name day', '2026-10-13T10:00:00+02:00', '2026-10-13T11:00:00+02:00')]);
    await flush(el);
    expect(chipTitles(el)).toEqual(['Dentist', 'Name day']);
  });

  describe('stored events', () => {
    const silent = () => makeHass(() => new Promise<HaCalendarEvent[]>(() => undefined)).hass;

    it('shows the events an earlier load stored at once, while the calendars answer', async () => {
      const { hass } = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
      (await mount(config, hass)).remove();
      const el = await mount(config, silent());
      expect(chipTitles(el)).toEqual(['Dentist']);
    });

    it('replaces them with what the calendars answer', async () => {
      const { hass } = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
      (await mount(config, hass)).remove();
      const el = await mount(config, makeHass(async () => []).hass);
      expect(chipTitles(el)).toEqual([]);
    });

    it('ignores events stored for other calendars', async () => {
      const { hass } = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
      (await mount(config, hass)).remove();
      const el = await mount({ entities: [{ entity: 'calendar.family', color: '#000000' }] }, silent());
      expect(chipTitles(el)).toEqual([]);
    });

    it('does not write again when a refresh brings the same events', async () => {
      const { hass } = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
      const el = await mount(config, hass);
      const setItem = vi.spyOn(localStorage, 'setItem');
      el.hass = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')], '2026-10-13T09:00:00Z').hass;
      await flush(el);
      expect(setItem).not.toHaveBeenCalledWith('wallcal:events', expect.anything());
      setItem.mockRestore();
    });

    it('stores only the range that holds today', async () => {
      const { hass } = makeHass(async (path) =>
        path.includes(startParam(new Date(2026, 9, 12))) ? [timed('This week', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')] : [],
      );
      const el = await mount(config, hass);
      click(el, 'button[aria-label="Next week"]');
      await flush(el);
      el.remove();
      expect(chipTitles(await mount(config, silent()))).toEqual(['This week']);
    });
  });

  it('drops a response for the previous config that lands after setConfig', async () => {
    const first = deferred<HaCalendarEvent[]>();
    let calls = 0;
    const { hass } = makeHass(() => (++calls === 1 ? first.promise : new Promise<HaCalendarEvent[]>(() => undefined)));
    const el = await mount(config, hass);

    el.remove();
    el.setConfig({ ...config, days: 5 });
    first.resolve([timed('Old config', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
    await flush(el);
    document.body.append(el);
    await flush(el);

    expect(chipTitles(el)).toEqual([]);
  });

  it('keeps its events without refetching when setConfig only changes how the card looks', async () => {
    const { hass, calls } = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
    const el = await mount(config, hass);
    expect(fetchesOf(calls)).toHaveLength(1);

    el.setConfig({ ...config, theme: 'paper', past_events: 'dim', header: { title: 'range' } });
    await flush(el);
    expect(chipTitles(el)).toEqual(['Dentist']);
    expect(fetchesOf(calls)).toHaveLength(1);
  });

  it('refetches when setConfig changes the calendars, their labels or the range', async () => {
    const { hass, calls } = makeHass(async () => [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')]);
    const el = await mount(config, hass);
    el.setConfig({ entities: [{ entity: 'calendar.family', color: '#000000' }] });
    await flush(el);
    expect(fetchesOf(calls)).toHaveLength(2);
    el.setConfig({ entities: [{ entity: 'calendar.family', color: '#000000', strip_prefix: 'Event:' }] });
    await flush(el);
    expect(fetchesOf(calls)).toHaveLength(3);
    el.setConfig({ entities: [{ entity: 'calendar.family', color: '#000000', strip_prefix: 'Event:' }], first_day: 'sunday' });
    await flush(el);
    expect(fetchesOf(calls, new Date(2026, 9, 11))).toHaveLength(1);
  });

  it('navigates weeks and returns to today', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, header: { idle_return: 0 } }, hass);
    expect(firstDate(el)).toBe('12');
    click(el, 'button[aria-label="Next week"]');
    await flush(el);
    expect(firstDate(el)).toBe('19');
    click(el, 'button[aria-label="Previous week"]');
    click(el, 'button[aria-label="Previous week"]');
    await flush(el);
    expect(firstDate(el)).toBe('5');
    click(el, '.nav--today');
    await flush(el);
    expect(firstDate(el)).toBe('12');
  });

  it('returns to the current week after the idle timeout', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, header: { idle_return: 60 } }, hass);
    click(el, 'button[aria-label="Next week"]');
    await flush(el);
    expect(firstDate(el)).toBe('19');
    await vi.advanceTimersByTimeAsync(60_000);
    await el.updateComplete;
    expect(firstDate(el)).toBe('12');
  });

  it('moves to the new week at midnight when showing the current week', async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 23, 59, 30));
    const { hass } = makeHass(async () => []);
    const el = await mount(config, hass);
    expect(firstDate(el)).toBe('12');
    await vi.advanceTimersByTimeAsync(31_000);
    await el.updateComplete;
    expect(firstDate(el)).toBe('19');
    expect(root(el).querySelector('.day--today .day__date')?.textContent).toBe('19');
  });

  it('catches up on the date when reattached after a view change or sleep', async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 22, 0));
    const { hass } = makeHass(async () => []);
    const el = await mount(config, hass);
    el.remove();
    vi.setSystemTime(new Date(2026, 9, 19, 7, 0));
    document.body.append(el);
    await flush(el);
    expect(firstDate(el)).toBe('19');
    expect(root(el).querySelector('.day--today .day__date')?.textContent).toBe('19');
  });

  it('catches up on the date when the page becomes visible again', async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 22, 0));
    const { hass } = makeHass(async () => []);
    const el = await mount(config, hass);
    vi.setSystemTime(new Date(2026, 9, 19, 7, 0));
    document.dispatchEvent(new Event('visibilitychange'));
    await flush(el);
    expect(firstDate(el)).toBe('19');
  });

  it('catches up on the date on the refresh tick when the midnight timer slept', async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 22, 0));
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, refresh_interval: 60 }, hass);
    vi.setSystemTime(new Date(2026, 9, 19, 7, 0));
    await vi.advanceTimersByTimeAsync(60_000);
    await el.updateComplete;
    expect(firstDate(el)).toBe('19');
  });

  it('returns to the current week right away when reattached after the idle timeout passed', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, header: { idle_return: 60 } }, hass);
    click(el, 'button[aria-label="Next week"]');
    await flush(el);
    el.remove();
    await vi.advanceTimersByTimeAsync(120_000);
    document.body.append(el);
    await flush(el);
    expect(firstDate(el)).toBe('12');
  });

  it('keeps the remaining idle time when reattached before the timeout', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, header: { idle_return: 60 } }, hass);
    click(el, 'button[aria-label="Next week"]');
    await flush(el);
    el.remove();
    await vi.advanceTimersByTimeAsync(30_000);
    document.body.append(el);
    await flush(el);
    expect(firstDate(el)).toBe('19');
    await vi.advanceTimersByTimeAsync(30_000);
    await el.updateComplete;
    expect(firstDate(el)).toBe('12');
  });

  it('does not refetch while the page is hidden and catches up when it is shown', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { hass, calls } = makeHass(async () => []);
    hidden.mockReturnValue(false);
    await mount({ ...config, refresh_interval: 60 }, hass);
    hidden.mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchesOf(calls)).toHaveLength(1);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchesOf(calls)).toHaveLength(2);
    hidden.mockRestore();
  });

  it('shows no cycle overlay while period is disabled, even with a last_period set', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, period: { enabled: false, last_period: '2026-10-12' } }, hass);
    expect(root(el).querySelector('.ring, .marker')).toBeNull();
  });

  it('keeps the last events and shows a warning when a refetch fails', async () => {
    let fail = false;
    const handler = async () => {
      if (fail) throw new Error('boom');
      return [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')];
    };
    const { hass } = makeHass(handler);
    const el = await mount(config, hass);
    fail = true;
    el.hass = makeHass(handler, '2026-10-13T09:00:00Z').hass;
    await flush(el);
    expect(chipTitles(el)).toEqual(['Dentist']);
    expect(root(el).querySelector('.bar__warning')?.getAttribute('title')).toBe('calendar.family: boom');
  });

  it('shows cycle and moon overlays from config', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount(
      { ...config, moon: { enabled: true }, period: { enabled: true, last_period: '2026-10-12' } },
      hass,
    );
    expect(root(el).querySelectorAll('.moon')).toHaveLength(7);
    expect(root(el).querySelectorAll('.ring')).toHaveLength(7);
    expect(root(el).querySelectorAll('.marker--period')).toHaveLength(5);
  });

  describe('cycle from helpers', () => {
    const helpers = {
      ...config,
      period: {
        enabled: true,
        last_period: 'input_datetime.last_period',
        cycle_length: 'input_number.cycle',
        period_length: 'input_number.period',
      },
    };
    const withStates = (hass: HomeAssistant, values: Record<string, string>): HomeAssistant => ({
      ...hass,
      states: {
        ...hass.states,
        ...Object.fromEntries(Object.entries(values).map(([id, state]) => [id, { state, last_changed: '2026-10-13T08:00:00Z' }])),
      },
    });
    const valid = { 'input_datetime.last_period': '2026-10-12', 'input_number.cycle': '28.0', 'input_number.period': '5.0' };

    it('shows the cycle from helper states', async () => {
      const { hass } = makeHass(async () => []);
      const el = await mount(helpers, withStates(hass, valid));
      expect(root(el).querySelectorAll('.ring')).toHaveLength(7);
      expect(root(el).querySelectorAll('.marker--period')).toHaveLength(5);
    });

    it('shows no cycle markers when a helper is missing or unusable', async () => {
      const { hass } = makeHass(async () => []);
      const cases = [
        { ...valid, 'input_datetime.last_period': 'unknown' },
        { ...valid, 'input_number.period': 'unavailable' },
        { 'input_number.cycle': '28.0', 'input_number.period': '5.0' },
      ];
      for (const states of cases) {
        const el = await mount(helpers, withStates(hass, states));
        expect(root(el).querySelector('.ring, .marker'), JSON.stringify(states)).toBeNull();
        el.remove();
      }
    });

    it('redraws when a helper changes', async () => {
      const { hass } = makeHass(async () => []);
      const el = await mount(helpers, withStates(hass, valid));
      el.hass = withStates(hass, { ...valid, 'input_datetime.last_period': '2026-10-15' });
      await flush(el);
      expect(root(el).querySelectorAll('.ring')).toHaveLength(4);
      el.hass = withStates(hass, { ...valid, 'input_datetime.last_period': 'unknown' });
      await flush(el);
      expect(root(el).querySelector('.ring, .marker')).toBeNull();
    });

    it('does not redraw for an unrelated state change', async () => {
      const { hass } = makeHass(async () => []);
      const el = await mount(helpers, withStates(hass, valid));
      el.hass = withStates(hass, { ...valid, 'sensor.other': '1' });
      expect(el.isUpdatePending).toBe(false);
    });
  });

  it('applies theme tokens as CSS custom properties', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, theme: 'paper', style: { date_size: 40 } }, hass);
    const card = root(el).querySelector('ha-card') as HTMLElement;
    expect(card.style.getPropertyValue('--wallcal-background')).toBe('#F7F3EC');
    expect(card.style.getPropertyValue('--wallcal-date-size')).toBe('40px');
  });

  describe('week cache', () => {
    // One event per week, titled by the week's first day and the label at request time, so a chip
    // shows which week and which fetch it came from. A hold delays one request for that week.
    function weekly() {
      const state = { label: 'v1', gate: null as Promise<void> | null, holds: new Map<string, Promise<void>>() };
      const { hass, calls } = makeHass(async (path) => {
        const day = dayKey(new Date(decodeURIComponent(/start=([^&]+)/.exec(path)![1])));
        const label = state.label;
        const gate = state.holds.get(day) ?? state.gate;
        state.holds.delete(day);
        if (gate) await gate;
        return [timed(`${label} ${day}`, `${day}T10:00:00+02:00`, `${day}T11:00:00+02:00`)];
      });
      const hold = (day: string) => {
        const gate = deferred<void>();
        state.holds.set(day, gate.promise);
        return gate;
      };
      return { hass, calls, state, hold };
    }
    const never = new Promise<void>(() => undefined);
    const next = (el: WallCalCard) => click(el, 'button[aria-label="Next week"]');
    const prev = (el: WallCalCard) => click(el, 'button[aria-label="Previous week"]');

    it('prefetches the weeks before and after once the shown week has loaded', async () => {
      const { hass, calls } = weekly();
      await mount(config, hass);
      expect(fetchesOf(calls, new Date(2026, 9, 5))).toHaveLength(1);
      expect(fetchesOf(calls, new Date(2026, 9, 19))).toHaveLength(1);
    });

    it('shows a prefetched week at once and refreshes it in the background', async () => {
      const { hass, state, hold } = weekly();
      const el = await mount(config, hass);
      state.label = 'v2';
      const refresh = hold('2026-10-19');
      next(el);
      await flush(el);
      expect(chipTitles(el)).toEqual(['v1 2026-10-19']);
      refresh.resolve();
      await flush(el);
      expect(chipTitles(el)).toEqual(['v2 2026-10-19']);
    });

    it('does not prefetch a week it already holds', async () => {
      const { hass, calls } = weekly();
      await mount({ ...config, refresh_interval: 60 }, hass);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchesOf(calls)).toHaveLength(2);
      expect(calls).toHaveLength(4);
    });

    it('drops a prefetch that lands after the calendars changed', async () => {
      const { hass, state, hold } = weekly();
      const stale = hold('2026-10-19');
      const el = await mount(config, hass);
      state.gate = never;
      el.setConfig({ entities: [{ entity: 'calendar.family', color: '#123456' }] });
      await flush(el);
      stale.resolve();
      await flush(el);
      next(el);
      await flush(el);
      expect(chipTitles(el)).toEqual([]);
    });

    it('does not keep a prefetched week in which a calendar failed', async () => {
      let gate: Promise<void> | null = null;
      const nextWeek = startParam(new Date(2026, 9, 19));
      const { hass } = makeHass(async (path) => {
        if (gate) await gate;
        if (path.startsWith('calendars/calendar.work') && path.includes(nextWeek)) throw new Error('timeout');
        return [timed('Family', '2026-10-20T10:00:00+02:00', '2026-10-20T11:00:00+02:00')];
      });
      hass.states['calendar.work'] = { last_changed: '' };
      const el = await mount({ entities: ['calendar.family', 'calendar.work'] }, hass);
      gate = never;
      next(el);
      await flush(el);
      expect(chipTitles(el)).toEqual([]);
    });

    it('does not retry a failed prefetch on every refresh', async () => {
      const nextWeek = startParam(new Date(2026, 9, 19));
      const { hass, calls } = makeHass(async (path) => {
        if (path.includes(nextWeek)) throw new Error('timeout');
        return [];
      });
      await mount({ ...config, refresh_interval: 60 }, hass);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(fetchesOf(calls)).toHaveLength(3);
      expect(fetchesOf(calls, new Date(2026, 9, 19))).toHaveLength(1);
    });

    it('forgets the cached weeks when the calendars change', async () => {
      const { hass, state } = weekly();
      const el = await mount(config, hass);
      next(el);
      await flush(el);
      state.gate = never;
      el.setConfig({ entities: [{ entity: 'calendar.family', color: '#123456' }] });
      await flush(el);
      prev(el);
      await flush(el);
      expect(chipTitles(el)).toEqual([]);
    });

    it('keeps only the most recently stored weeks', async () => {
      const { hass, state } = weekly();
      const el = await mount(config, hass);
      for (let i = 0; i < 4; i++) {
        next(el);
        await flush(el);
      }
      state.gate = never;
      prev(el);
      await flush(el);
      expect(chipTitles(el)).toEqual(['v1 2026-11-02']);
      // The stored copy of this week would fill it too.
      localStorage.clear();
      click(el, '.nav--today');
      await flush(el);
      expect(chipTitles(el)).toEqual([]);
    });
  });

  describe('calendar toggles', () => {
    const twoCalendars = {
      entities: [{ entity: 'calendar.family', name: 'Family' }, { entity: 'calendar.work', toggle: true, name: 'Work' }],
    };
    const byCalendar = async (path: string) =>
      path.startsWith('calendars/calendar.work')
        ? [timed('Standup', '2026-10-13T09:00:00+02:00', '2026-10-13T09:15:00+02:00')]
        : [timed('Dentist', '2026-10-13T08:30:00+02:00', '2026-10-13T09:00:00+02:00')];

    it('shows a chip only for toggleable calendars and hides their events when tapped', async () => {
      const el = await mount(twoCalendars, makeHass(byCalendar).hass);
      expect(root(el).querySelectorAll('.toggle')).toHaveLength(1);
      expect(chipTitles(el)).toEqual(['Dentist', 'Standup']);

      click(el, '.toggle');
      await flush(el);
      expect(chipTitles(el)).toEqual(['Dentist']);
      expect(root(el).querySelector('.toggle')?.getAttribute('aria-pressed')).toBe('false');

      click(el, '.toggle');
      await flush(el);
      expect(chipTitles(el)).toEqual(['Dentist', 'Standup']);
    });

    it('remembers hidden calendars on this device', async () => {
      const first = await mount(twoCalendars, makeHass(byCalendar).hass);
      click(first, '.toggle');
      const second = await mount(twoCalendars, makeHass(byCalendar).hass);
      expect(chipTitles(second)).toEqual(['Dentist']);
    });

    it('ignores the stored choice for a calendar this card has no chip for', async () => {
      localStorage.setItem('wallcal:hidden-calendars', JSON.stringify(['calendar.work']));
      const el = await mount({ entities: ['calendar.family', 'calendar.work'] }, makeHass(byCalendar).hass);
      expect(chipTitles(el)).toEqual(['Dentist', 'Standup']);
    });

    it('survives unreadable storage', async () => {
      localStorage.setItem('wallcal:hidden-calendars', '{broken');
      const el = await mount(twoCalendars, makeHass(byCalendar).hass);
      expect(chipTitles(el)).toEqual(['Dentist', 'Standup']);
    });

    it('toggles back and forth when storage is blocked', async () => {
      const blocked = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
      const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(blocked);
      const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(blocked);
      try {
        const el = await mount(twoCalendars, makeHass(byCalendar).hass);
        click(el, '.toggle');
        await flush(el);
        expect(chipTitles(el)).toEqual(['Dentist']);

        click(el, '.toggle');
        await flush(el);
        expect(chipTitles(el)).toEqual(['Dentist', 'Standup']);
        expect(getItem).toHaveBeenCalled();
      } finally {
        getItem.mockRestore();
        setItem.mockRestore();
      }
    });

    it('toggles back and forth when storage is readable but writes fail', async () => {
      const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      try {
        const el = await mount(twoCalendars, makeHass(byCalendar).hass);
        click(el, '.toggle');
        await flush(el);
        expect(chipTitles(el)).toEqual(['Dentist']);

        click(el, '.toggle');
        await flush(el);
        expect(chipTitles(el)).toEqual(['Dentist', 'Standup']);
        expect(setItem).toHaveBeenCalled();
      } finally {
        setItem.mockRestore();
      }
    });
  });

  describe('weather', () => {
    function weatherHass(supported_features = 1) {
      const { hass } = makeHass(async () => []);
      const stop = vi.fn(async () => undefined);
      const subscribe = vi.fn(async (callback: (message: unknown) => void, _message: Record<string, unknown>) => {
        callback({
          type: 'daily',
          forecast: [{ datetime: '2026-10-14T00:00:00+02:00', condition: 'sunny', temperature: 18, templow: 9 }],
        });
        return stop;
      });
      hass.states['weather.home'] = { last_changed: '', attributes: { supported_features } };
      hass.connection = { subscribeMessage: subscribe as HomeAssistant['connection']['subscribeMessage'] };
      return { hass, subscribe, stop };
    }
    const weatherConfig = { ...config, weather: { entity: 'weather.home' } };

    it('subscribes once to the daily forecast and shows it on its day', async () => {
      const { hass, subscribe } = weatherHass();
      const el = await mount(weatherConfig, hass);
      el.hass = { ...hass };
      await flush(el);
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(subscribe.mock.calls[0][1]).toEqual({
        type: 'weather/subscribe_forecast',
        forecast_type: 'daily',
        entity_id: 'weather.home',
      });
      expect(root(el).querySelectorAll('.day__weather')).toHaveLength(1);
      expect(root(el).querySelectorAll('.day')[2].querySelector('.day__temp')?.textContent?.replace(/\s+/g, '')).toBe(
        '18°/9°',
      );
    });

    it('does not re-render when the forecast repeats', async () => {
      const { hass, subscribe } = weatherHass();
      const el = await mount(weatherConfig, hass);
      const [push] = subscribe.mock.calls[0];
      const render = vi.spyOn(el as unknown as { render(): unknown }, 'render');
      push({ type: 'daily', forecast: [{ datetime: '2026-10-14T00:00:00+02:00', condition: 'sunny', temperature: 18, templow: 9 }] });
      await flush(el);
      expect(render).not.toHaveBeenCalled();
      push({ type: 'daily', forecast: [{ datetime: '2026-10-14T00:00:00+02:00', condition: 'rainy', temperature: 18, templow: 9 }] });
      await flush(el);
      expect(render).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes when detached', async () => {
      const { hass, stop } = weatherHass();
      const el = await mount(weatherConfig, hass);
      el.remove();
      await flush(el);
      expect(stop).toHaveBeenCalledTimes(1);
    });

    it('does not retry a failed subscription on every hass update', async () => {
      const { hass, subscribe } = weatherHass();
      subscribe.mockRejectedValue(new Error('unknown entity'));
      const el = await mount(weatherConfig, hass);
      el.hass = { ...hass };
      el.hass = { ...hass };
      await flush(el);
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(root(el).querySelector('.bar__warning')?.getAttribute('title')).toBe('weather.home: unknown entity');
    });

    it('keeps the forecast and its subscription when setConfig leaves the weather entity alone', async () => {
      const { hass, subscribe, stop } = weatherHass();
      const el = await mount(weatherConfig, hass);
      el.setConfig({ ...weatherConfig, theme: 'paper', weather: { entity: 'weather.home', show_low: false } });
      await flush(el);
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(stop).not.toHaveBeenCalled();
      expect(root(el).querySelectorAll('.day')[2].querySelector('.day__temp')?.textContent?.replace(/\s+/g, '')).toBe('18°');
    });

    it('resubscribes when setConfig changes the weather entity and stops when weather is removed', async () => {
      const { hass, subscribe, stop } = weatherHass();
      hass.states['weather.cottage'] = { last_changed: '', attributes: { supported_features: 1 } };
      const el = await mount(weatherConfig, hass);
      el.setConfig({ ...config, weather: { entity: 'weather.cottage' } });
      await flush(el);
      expect(stop).toHaveBeenCalledTimes(1);
      expect(subscribe).toHaveBeenCalledTimes(2);
      expect(subscribe.mock.calls[1][1]).toMatchObject({ entity_id: 'weather.cottage' });
      el.setConfig(config);
      await flush(el);
      expect(stop).toHaveBeenCalledTimes(2);
      expect(root(el).querySelector('.day__weather')).toBeNull();
    });

    it('retries a failed subscription when the card is reconfigured', async () => {
      const { hass, subscribe } = weatherHass();
      subscribe.mockRejectedValueOnce(new Error('not ready'));
      const el = await mount(weatherConfig, hass);
      expect(root(el).querySelector('.bar__warning')).not.toBeNull();
      el.setConfig({ ...weatherConfig });
      await flush(el);
      expect(subscribe).toHaveBeenCalledTimes(2);
      expect(root(el).querySelector('.bar__warning')).toBeNull();
    });

    it('warns when the entity offers no daily forecast', async () => {
      const { hass, subscribe } = weatherHass(2);
      const el = await mount(weatherConfig, hass);
      expect(subscribe).not.toHaveBeenCalled();
      expect(root(el).querySelector('.bar__warning')?.getAttribute('title')).toBe(
        'weather.home: no daily forecast available',
      );
    });
  });

  it('wakes when an event ends so it can be dimmed on time, without refetching', async () => {
    const { hass, calls } = makeHass(async () => [
      timed('Standup', '2026-10-13T10:00:00+02:00', '2026-10-13T10:30:00+02:00'),
    ]);
    const el = await mount({ ...config, past_events: 'dim', refresh_interval: 86_400 }, hass);
    expect(root(el).querySelector('.grid')?.classList.contains('grid--events-dim')).toBe(true);
    expect(root(el).querySelector('.chip--ended')).toBeNull();
    await vi.advanceTimersByTimeAsync(30 * 60_000 + 1000);
    await el.updateComplete;
    expect(fetchesOf(calls)).toHaveLength(1);
    expect(root(el).querySelector('.chip--ended .chip__title')?.textContent).toBe('Standup');
  });

  it('shows how many events of a day are below its visible list, following the scroll position', async () => {
    const at = (h: number) => `2026-10-14T${String(h).padStart(2, '0')}:00:00+02:00`;
    const { hass } = makeHass(async () => [8, 9, 10, 11].map((h) => timed(`E${h}`, at(h), at(h + 1))));
    const el = await mount(config, hass);
    const list = root(el).querySelector<HTMLElement>('.day__events[data-day="2026-10-14"]')!;
    const more = () => root(el).querySelector('.day__more')?.textContent?.trim();
    layOut(list, 100, [40, 40, 40, 40]);
    list.dispatchEvent(new Event('scroll'));
    await nextFrame(el);
    expect(more()).toBe('+2 more');
    expect(root(el).querySelectorAll('.day__more')).toHaveLength(1);

    list.scrollTop = 92;
    list.dispatchEvent(new Event('scroll'));
    await nextFrame(el);
    expect(more()).toBeUndefined();
  });

  it('reflects the layout HA assigns so the panel view can fit it to the screen', async () => {
    const el = await mount(config, makeHass(async () => []).hass);
    el.layout = 'panel';
    await flush(el);
    expect(el.getAttribute('layout')).toBe('panel');
  });

  it('provides a stub config using the first calendar', () => {
    const Card = customElements.get('wallcal-card') as unknown as { getStubConfig(h: HomeAssistant): unknown };
    expect(Card.getStubConfig(makeHass(async () => []).hass)).toEqual({ entities: ['calendar.family'] });
  });

  describe('overlays', () => {
    const todo = { type: 'todo-list', entity: 'todo.shopping' };
    const withOverlays = (...overlays: Record<string, unknown>[]) => ({ ...config, overlays });
    const right = (extra: Record<string, unknown> = {}) => ({ position: 'bottom-right', card: todo, ...extra });
    const hosted = (el: WallCalCard, position = 'bottom-right') =>
      root(el).querySelector<HTMLElement>(`.overlay--${position} .hosted`);
    let created: Array<HTMLElement & { hass?: unknown }>;

    const settle = async (el: WallCalCard) => {
      await flush(el);
      await flush(el);
    };

    beforeEach(() => {
      created = stubCardHelpers();
    });

    afterEach(() => {
      delete window.loadCardHelpers;
    });

    it('starts hidden with a header button and shows the card when tapped', async () => {
      const el = await mount(withOverlays(right()), makeHass(async () => []).hass);
      expect(root(el).querySelector('.overlay')).toBeNull();
      const button = root(el).querySelector<HTMLButtonElement>('.toggle');
      expect(button?.getAttribute('aria-label')).toBe('Show todo.shopping');

      button?.click();
      await settle(el);
      expect(hosted(el)).not.toBeNull();
      expect(root(el).querySelector('.toggle')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('names the button from the card title or the entity friendly name', async () => {
      const { hass } = makeHass(async () => []);
      hass.states['todo.shopping'] = { last_changed: '', attributes: { friendly_name: 'Shopping' } };
      const named = await mount(withOverlays(right()), hass);
      expect(root(named).querySelector('.toggle')?.getAttribute('aria-label')).toBe('Show Shopping');
      const titled = await mount(withOverlays(right({ card: { ...todo, title: 'Groceries' } })), hass);
      expect(root(titled).querySelector('.toggle')?.getAttribute('aria-label')).toBe('Show Groceries');
    });

    it('passes every hass update to the hosted card', async () => {
      const { hass } = makeHass(async () => []);
      const el = await mount(withOverlays(right({ visible: true })), hass);
      await settle(el);
      expect(created[0].hass).toBe(hass);
      const next = { ...hass };
      el.hass = next;
      expect(created[0].hass).toBe(next);
    });

    it('keeps the same hosted node across re-renders and when the other overlay hides', async () => {
      const left = { position: 'bottom-left', span: 1, card: { type: 'tile', entity: 'weather.home' }, visible: true };
      const el = await mount(withOverlays(left, right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      const node = hosted(el);
      expect(node).not.toBeNull();
      click(el, '.nav[aria-label="Next week"]');
      await settle(el);
      expect(hosted(el)).toBe(node);
      click(el, '.toggle');
      await settle(el);
      expect(root(el).querySelector('.overlay--bottom-left')).toBeNull();
      expect(hosted(el)).toBe(node);
    });

    it('reuses the card element across hide and show', async () => {
      const el = await mount(withOverlays(right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      const node = hosted(el);
      click(el, '.toggle');
      await settle(el);
      expect(root(el).querySelector('.overlay')).toBeNull();
      click(el, '.toggle');
      await settle(el);
      expect(hosted(el)).toBe(node);
      expect(created).toHaveLength(1);
    });

    it('remembers the choice on this device', async () => {
      const first = await mount(withOverlays(right()), makeHass(async () => []).hass);
      click(first, '.toggle');
      const second = await mount(withOverlays(right()), makeHass(async () => []).hass);
      await settle(second);
      expect(hosted(second)).not.toBeNull();
    });

    it('always shows an overlay with toggle: false and gives it no button', async () => {
      const el = await mount(withOverlays(right({ toggle: false })), makeHass(async () => []).hass);
      await settle(el);
      expect(root(el).querySelector('.toggle')).toBeNull();
      expect(hosted(el)).not.toBeNull();
    });

    it('keeps the hosted card when HA applies an identical config again', async () => {
      const overlayConfig = withOverlays(right({ visible: true }));
      const el = await mount(overlayConfig, makeHass(async () => []).hass);
      await settle(el);
      const node = hosted(el);
      expect(node).not.toBeNull();
      el.setConfig(structuredClone(overlayConfig));
      await settle(el);
      expect(hosted(el)).toBe(node);
      expect(created).toHaveLength(1);
    });

    it('creates a new card when the card config changes', async () => {
      const el = await mount(withOverlays(right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      el.setConfig(withOverlays(right({ visible: true, card: { ...todo, entity: 'todo.chores' } })));
      await settle(el);
      expect(created).toHaveLength(2);
      expect(hosted(el)?.dataset.entity).toBe('todo.chores');
    });

    describe('pill mode', () => {
      const pill = (extra: Record<string, unknown> = {}) => right({ toggle: 'pill', name: 'Shopping', ...extra });
      const withCount = (count: string) => {
        const { hass } = makeHass(async () => []);
        hass.states['todo.shopping'] = { state: count, last_changed: '' };
        return hass;
      };

      it('starts as a pill with the open-item count and no header button', async () => {
        const el = await mount(withOverlays(pill()), withCount('4'));
        expect(root(el).querySelector('.toggle')).toBeNull();
        expect(root(el).querySelector('.overlay')).toBeNull();
        expect(root(el).querySelector('.pill--bottom-right .pill__count')?.textContent).toBe('4');
      });

      it('expands from the pill and minimizes back with the handle', async () => {
        const el = await mount(withOverlays(pill()), withCount('4'));
        click(el, '.pill');
        await settle(el);
        expect(root(el).querySelector('.pill')).toBeNull();
        expect(hosted(el)).not.toBeNull();

        click(el, '.overlay__handle');
        await settle(el);
        expect(root(el).querySelector('.overlay')).toBeNull();
        expect(root(el).querySelector('.pill')).not.toBeNull();
        expect(created).toHaveLength(1);
      });

      it('remembers being expanded on this device', async () => {
        const first = await mount(withOverlays(pill()), withCount('4'));
        click(first, '.pill');
        const second = await mount(withOverlays(pill()), withCount('4'));
        await settle(second);
        expect(hosted(second)).not.toBeNull();
      });

      it('updates the count when the entity changes, without re-rendering for anything else', async () => {
        const hass = withCount('4');
        const el = await mount(withOverlays(pill()), hass);
        const renders = vi.spyOn(el as unknown as { render(): unknown }, 'render');
        el.hass = { ...hass, states: { ...hass.states, 'light.kitchen': { last_changed: 'x' } } };
        await flush(el);
        expect(renders).not.toHaveBeenCalled();

        el.hass = { ...hass, states: { ...hass.states, 'todo.shopping': { state: '3', last_changed: '' } } };
        await flush(el);
        expect(root(el).querySelector('.pill__count')?.textContent).toBe('3');
      });

      it('does not count a tap on the pill as touching the day lists', async () => {
        const el = await mount(withOverlays(pill()), withCount('4'));
        const probe = el as unknown as { _lastListTouch: number };
        const pillButton = root(el).querySelector('.pill');
        expect(pillButton).not.toBeNull();
        pillButton?.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        expect(probe._lastListTouch).toBe(0);
      });
    });

    it('counts a touch on an overlay as activity but not as touching the day lists', async () => {
      const el = await mount(withOverlays(right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      const probe = el as unknown as { _lastListTouch: number; _lastTouch: number };
      hosted(el)?.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
      expect(probe._lastListTouch).toBe(0);
      expect(probe._lastTouch).toBe(Date.now());
    });
  });
});

describe('editor wiring', () => {
  it('returns the visual editor, registering it only when asked for', () => {
    expect(customElements.get('wallcal-card-editor')).toBeUndefined();
    expect(WallCalCard.getConfigElement().tagName).toBe('WALLCAL-CARD-EDITOR');
    expect(customElements.get('wallcal-card-editor')).toBeDefined();
  });

  it('registers a previewable picker entry with docs and calendar suggestions', () => {
    const entry = window.customCards!.find((c) => c.type === 'wallcal-card')!;
    expect(entry.preview).toBe(true);
    expect(entry.documentationURL).toBe('https://tfoxik.github.io/wallcal/docs/');
    expect(entry.getEntitySuggestion).toBe(suggestCard);
    expect(suggestCard({}, 'calendar.family')).toEqual({ config: { type: 'custom:wallcal-card', entities: ['calendar.family'] } });
    expect(suggestCard({}, 'light.kitchen')).toBeNull();
  });
});
