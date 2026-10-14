// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/wallcal-card';
import type { WallCalCard } from '../src/wallcal-card';
import type { HaCalendarEvent } from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';
import { makeHass, timed } from './fixtures';

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
    expect(calls).toHaveLength(1);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
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

  it('applies theme tokens as CSS custom properties', async () => {
    const { hass } = makeHass(async () => []);
    const el = await mount({ ...config, theme: 'paper', style: { date_size: 40 } }, hass);
    const card = root(el).querySelector('ha-card') as HTMLElement;
    expect(card.style.getPropertyValue('--wallcal-background')).toBe('#F7F3EC');
    expect(card.style.getPropertyValue('--wallcal-date-size')).toBe('40px');
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
    expect(calls).toHaveLength(1);
    expect(root(el).querySelector('.chip--ended .chip__title')?.textContent).toBe('Standup');
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
      created = [];
      window.loadCardHelpers = async () => ({
        createCardElement: (cardConfig: Record<string, unknown>) => {
          const el = document.createElement('div') as HTMLElement & { hass?: unknown };
          el.className = 'hosted';
          el.dataset.entity = String(cardConfig.entity);
          created.push(el);
          return el;
        },
      });
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

    it('creates a new card when the card config changes', async () => {
      const el = await mount(withOverlays(right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      el.setConfig(withOverlays(right({ visible: true, card: { ...todo, entity: 'todo.chores' } })));
      await settle(el);
      expect(created).toHaveLength(2);
      expect(hosted(el)?.dataset.entity).toBe('todo.chores');
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
