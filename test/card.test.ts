// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/wallcal-card';
import type { WallCalCard } from '../src/wallcal-card';
import type { HaCalendarEvent } from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeHass(handler: (path: string) => Promise<HaCalendarEvent[]>, lastChanged = '2026-10-13T08:00:00Z') {
  const calls: string[] = [];
  const hass = {
    states: {
      'calendar.family': {
        entity_id: 'calendar.family',
        state: 'off',
        last_changed: lastChanged,
        last_updated: lastChanged,
        attributes: {},
      },
    },
    locale: { language: 'en-US', time_format: '24' },
    callApi: <T>(_method: string, path: string) => {
      calls.push(path);
      return handler(path) as Promise<T>;
    },
  } as HomeAssistant;
  return { hass, calls };
}

const timed = (summary: string, startIso: string, endIso: string): HaCalendarEvent => ({
  summary,
  start: { dateTime: startIso },
  end: { dateTime: endIso },
});

async function mount(config: Record<string, unknown>, hass: HomeAssistant): Promise<WallCalCard> {
  const el = document.createElement('wallcal-card') as WallCalCard;
  el.setConfig(config);
  el.hass = hass;
  document.body.append(el);
  await flush(el);
  return el;
}

async function flush(el: WallCalCard) {
  await vi.advanceTimersByTimeAsync(0);
  await el.updateComplete;
}

const root = (el: WallCalCard) => el.shadowRoot as ShadowRoot;
const firstDate = (el: WallCalCard) => root(el).querySelector('.day__date')?.textContent;
const chipTitles = (el: WallCalCard) => [...root(el).querySelectorAll('.chip__title')].map((n) => n.textContent);
const click = (el: WallCalCard, selector: string) => root(el).querySelector<HTMLButtonElement>(selector)?.click();

const config = { entities: ['calendar.family'] };

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 13, 10, 0) });
});

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('wallcal-card', () => {
  it('rejects invalid config', () => {
    const el = document.createElement('wallcal-card') as WallCalCard;
    expect(() => el.setConfig({})).toThrow(/at least one calendar/);
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
    expect(calls).toHaveLength(1);

    el.hass = { ...hass };
    await flush(el);
    expect(calls).toHaveLength(1);

    const family = hass.states['calendar.family'];
    el.hass = { ...hass, states: { 'calendar.family': { ...family, last_changed: '2026-10-13T09:00:00Z' } } };
    await flush(el);
    expect(calls).toHaveLength(2);
  });

  it('does not re-render on hass updates that do not concern it', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount(config, hass);
    const renders = vi.spyOn(el as unknown as { render(): unknown }, 'render');
    el.hass = { ...hass, states: { ...hass.states, 'light.kitchen': hass.states['calendar.family'] } };
    await flush(el);
    expect(renders).not.toHaveBeenCalled();
  });

  it('refetches on the refresh interval', async () => {
    const { hass, calls } = makeHass(async () => []);
    await mount({ ...config, refresh_interval: 60 }, hass);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(2);
  });

  it('ignores a response that arrives after a newer request', async () => {
    const first = deferred<HaCalendarEvent[]>();
    const second = deferred<HaCalendarEvent[]>();
    const queue = [first, second];
    const { hass } = makeHass(() => queue.shift()!.promise);
    const el = await mount(config, hass);

    click(el, 'button[aria-label="Next week"]');
    second.resolve([timed('Next week', '2026-10-20T10:00:00+02:00', '2026-10-20T11:00:00+02:00')]);
    await flush(el);
    first.resolve([timed('Stale', '2026-10-20T12:00:00+02:00', '2026-10-20T13:00:00+02:00')]);
    await flush(el);

    expect(chipTitles(el)).toEqual(['Next week']);
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

  it('applies theme tokens as CSS custom properties', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, theme: 'paper', style: { date_size: 40 } }, hass);
    const card = root(el).querySelector('ha-card') as HTMLElement;
    expect(card.style.getPropertyValue('--wallcal-background')).toBe('#F7F3EC');
    expect(card.style.getPropertyValue('--wallcal-date-size')).toBe('40px');
  });

  it('provides a stub config using the first calendar', () => {
    const Card = customElements.get('wallcal-card') as unknown as { getStubConfig(h: HomeAssistant): unknown };
    expect(Card.getStubConfig(makeHass(async () => []).hass)).toEqual({ entities: ['calendar.family'] });
  });
});
