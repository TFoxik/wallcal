// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/wallcal-card';
import type { WallCalCard } from '../src/wallcal-card';
import type { HomeAssistant } from '../src/ha-types';
import type { HaCalendarEvent } from '../src/data/events';
import { allDay, calendars, makeHass, stubCardHelpers, timed } from './fixtures';

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

const root = (el: WallCalCard) => el.shadowRoot as ShadowRoot;
const text = (el: WallCalCard, selector: string) => root(el).querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
const texts = (el: WallCalCard, selector: string) =>
  [...root(el).querySelectorAll(selector)].map((n) => n.textContent?.replace(/\s+/g, ' ').trim());

const upcomingConfig = {
  view: 'upcoming',
  entities: [
    'calendar.family',
    { entity: 'calendar.work', toggle: true },
    { entity: 'calendar.namedays', display: 'label' },
  ],
};

const startParam = (day: Date) => `start=${encodeURIComponent(day.toISOString())}`;
const endParam = (day: Date) => `end=${encodeURIComponent(day.toISOString())}`;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 13, 10, 0) });
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.useRealTimers();
});

describe('phone views: range', () => {
  it('agenda fetches the 7 days from today, with no prefetch', async () => {
    const { hass, calls } = makeHass(async () => []);
    await mount({ entities: ['calendar.family'], view: 'agenda' }, hass);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toContain(startParam(new Date(2026, 9, 13)));
      expect(call).toContain(endParam(new Date(2026, 9, 20)));
    }
  });

  it('rolls the range forward at midnight', async () => {
    const { hass, calls } = makeHass(async () => []);
    await mount({ entities: ['calendar.family'], view: 'upcoming' }, hass);
    vi.setSystemTime(new Date(2026, 9, 13, 23, 59, 30));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(calls[calls.length - 1]).toContain(startParam(new Date(2026, 9, 14)));
  });
});

describe('upcoming view', () => {
  it("shows today's name day and the next events", async () => {
    const { hass } = calendars({
      'calendar.family': [
        timed('Swimming', '2026-10-13T15:30:00+02:00', '2026-10-13T16:30:00+02:00'),
        timed('Dentist', '2026-10-14T08:00:00+02:00', '2026-10-14T09:00:00+02:00'),
      ],
      'calendar.namedays': [allDay('Beáta', '2026-10-13', '2026-10-14')],
    });
    const el = await mount(upcomingConfig, hass);
    expect(text(el, '.upcoming__head')).toContain('Today');
    expect(text(el, '.upcoming__head')).toContain('Beáta');
    expect(texts(el, '.upcoming__row .upcoming__title')).toEqual(['Swimming', '08:00 Dentist']);
    expect(texts(el, '.upcoming__when')).toEqual(['15:30', 'Tomorrow']);
  });

  it('names later days by their short weekday', async () => {
    const { hass } = calendars({ 'calendar.family': [timed('Cinema', '2026-10-15T19:30:00+02:00', '2026-10-15T22:00:00+02:00')] });
    const el = await mount(upcomingConfig, hass);
    expect(texts(el, '.upcoming__when')).toEqual(['Thu']);
  });

  it('says nothing is planned for an empty week', async () => {
    const { hass } = calendars({});
    const el = await mount(upcomingConfig, hass);
    expect(text(el, '.upcoming__empty')).toBe('Nothing planned this week');
    expect(root(el).querySelector('.upcoming__warning')).toBeNull();
  });

  it('shows loaded events and a warning when one calendar fails', async () => {
    const { hass } = calendars({
      'calendar.family': [timed('Swimming', '2026-10-13T15:30:00+02:00', '2026-10-13T16:30:00+02:00')],
      'calendar.work': new Error('timeout'),
    });
    const el = await mount(upcomingConfig, hass);
    expect(root(el).querySelector('.upcoming__warning')?.getAttribute('title')).toContain('calendar.work');
    expect(texts(el, '.upcoming__title')).toEqual(['Swimming']);
  });

  it("says it couldn't load when every calendar fails", async () => {
    const failed = new Error('offline');
    const { hass } = calendars({ 'calendar.family': failed, 'calendar.work': failed, 'calendar.namedays': failed });
    const el = await mount(upcomingConfig, hass);
    expect(text(el, '.upcoming__empty')).toBe("Couldn't load calendars");
    expect(root(el).textContent).not.toContain('Nothing planned');
  });

  it('navigates to navigation_path on tap', async () => {
    const { hass } = calendars({});
    const el = await mount({ ...upcomingConfig, upcoming: { navigation_path: '/smart-home/calendar' } }, hass);
    const push = vi.spyOn(history, 'pushState');
    const changed = vi.fn();
    window.addEventListener('location-changed', changed);
    root(el).querySelector<HTMLElement>('ha-card')!.click();
    window.removeEventListener('location-changed', changed);
    expect(push).toHaveBeenCalledWith(null, '', '/smart-home/calendar');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(root(el).querySelector('.upcoming__chevron')).not.toBeNull();
    push.mockRestore();
  });

  it('does nothing on tap and shows no chevron without navigation_path', async () => {
    const { hass } = calendars({});
    const el = await mount(upcomingConfig, hass);
    const push = vi.spyOn(history, 'pushState');
    root(el).querySelector<HTMLElement>('ha-card')!.click();
    expect(push).not.toHaveBeenCalled();
    expect(root(el).querySelector('.upcoming__chevron')).toBeNull();
    push.mockRestore();
  });

  it('re-reads the hidden calendars when reattached', async () => {
    const { hass } = calendars({ 'calendar.work': [timed('Standup', '2026-10-13T15:00:00+02:00', '2026-10-13T15:15:00+02:00')] });
    const el = await mount(upcomingConfig, hass);
    expect(texts(el, '.upcoming__title')).toEqual(['Standup']);
    localStorage.setItem('wallcal:hidden-calendars', '["calendar.work"]');
    el.remove();
    document.body.append(el);
    await flush(el);
    expect(texts(el, '.upcoming__title')).toEqual([]);
  });

  it('follows a hidden-calendar change made in another tab', async () => {
    const { hass } = calendars({ 'calendar.work': [timed('Standup', '2026-10-13T15:00:00+02:00', '2026-10-13T15:15:00+02:00')] });
    const el = await mount(upcomingConfig, hass);
    expect(texts(el, '.upcoming__title')).toEqual(['Standup']);
    localStorage.setItem('wallcal:hidden-calendars', '["calendar.work"]');
    window.dispatchEvent(new StorageEvent('storage', { key: 'wallcal:hidden-calendars' }));
    await flush(el);
    expect(texts(el, '.upcoming__title')).toEqual([]);
  });

  it('reserves grid rows for its count', async () => {
    const { hass } = calendars({});
    const three = await mount(upcomingConfig, hass);
    expect(three.getGridOptions()).toEqual({ columns: 'full', rows: 2, min_rows: 2 });
    expect(three.getCardSize()).toBe(4);
    const five = await mount({ ...upcomingConfig, upcoming: { count: 5 } }, hass);
    expect(five.getGridOptions().rows).toBe(3);
    // A 56px row can't hold the header and even one event.
    const one = await mount({ ...upcomingConfig, upcoming: { count: 1 } }, hass);
    expect(one.getGridOptions().rows).toBe(2);
    const four = await mount({ ...upcomingConfig, upcoming: { count: 4 } }, hass);
    expect(four.getGridOptions().rows).toBe(3);
  });
});

describe('hidden calendars with storage blocked', () => {
  it('keeps the in-memory choice when reattached', async () => {
    const { hass } = calendars({ 'calendar.work': [timed('Standup', '2026-10-13T15:00:00+02:00', '2026-10-13T15:15:00+02:00')] });
    const el = await mount({ ...upcomingConfig, view: 'agenda' }, hass);
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    (el as unknown as { _hidden: Set<string> })._hidden = new Set(['calendar.work']);
    el.remove();
    document.body.append(el);
    await flush(el);
    expect((el as unknown as { _hidden: Set<string> })._hidden.has('calendar.work')).toBe(true);
    getItem.mockRestore();
  });
});

const agendaConfig = { ...upcomingConfig, view: 'agenda' };
const list = (el: WallCalCard) => root(el).querySelector<HTMLElement>('.agenda__list')!;
const cell = (el: WallCalCard, key: string) => root(el).querySelector<HTMLElement>(`.agenda__cell[data-day="${key}"]`)!;
const sectionTitles = (el: WallCalCard, key: string) =>
  [...root(el).querySelectorAll(`.agenda__day[data-day="${key}"] .chip__title`)].map((n) => n.textContent?.trim());

// happy-dom has no layout: stack the day sections 200px apart in a 600px scroller.
function layOutDays(el: WallCalCard) {
  Object.defineProperty(list(el), 'clientHeight', { value: 600, configurable: true });
  root(el).querySelectorAll<HTMLElement>('.agenda__day').forEach((section, i) => {
    Object.defineProperty(section, 'offsetTop', { value: i * 200, configurable: true });
    Object.defineProperty(section, 'offsetHeight', { value: 200, configurable: true });
  });
}

describe('agenda view', () => {
  it('renders a strip of 7 days from today', async () => {
    const { hass } = calendars({});
    const el = await mount(agendaConfig, hass);
    const keys = [...root(el).querySelectorAll<HTMLElement>('.agenda__cell')].map((c) => c.dataset.day);
    expect(keys).toEqual(['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']);
    expect(cell(el, '2026-10-13').classList.contains('agenda__cell--today')).toBe(true);
    expect(cell(el, '2026-10-13').classList.contains('agenda__cell--active')).toBe(true);
  });

  it('puts a dot per event on the strip, coloured by calendar', async () => {
    const { hass } = calendars({ 'calendar.family': [timed('Dentist', '2026-10-14T08:00:00+02:00', '2026-10-14T09:00:00+02:00')] });
    const el = await mount(agendaConfig, hass);
    const dots = cell(el, '2026-10-14').querySelectorAll<HTMLElement>('.agenda__dot');
    expect(dots).toHaveLength(1);
    expect(dots[0].style.getPropertyValue('--dot-color')).toBe('#7F77DD');
    expect(cell(el, '2026-10-13').querySelectorAll('.agenda__dot')).toHaveLength(0);
  });

  it('names today and tomorrow', async () => {
    const { hass } = calendars({});
    const el = await mount(agendaConfig, hass);
    expect(texts(el, '.agenda__name').slice(0, 3)).toEqual(['Today', 'Tomorrow', 'Thu']);
  });

  it('shows the name day line under the date', async () => {
    const { hass } = calendars({ 'calendar.namedays': [allDay('Beáta', '2026-10-13', '2026-10-14')] });
    const el = await mount(agendaConfig, hass);
    expect(text(el, '.agenda__day[data-day="2026-10-13"] .agenda__head')).toContain('Beáta');
    expect(sectionTitles(el, '2026-10-13')).toEqual([]);
  });

  it('shows "Nothing planned" on empty days', async () => {
    const { hass } = calendars({ 'calendar.family': [timed('Dentist', '2026-10-14T08:00:00+02:00', '2026-10-14T09:00:00+02:00')] });
    const el = await mount(agendaConfig, hass);
    expect(text(el, '.agenda__day[data-day="2026-10-13"] .agenda__empty')).toBe('Nothing planned');
    expect(root(el).querySelector('.agenda__day[data-day="2026-10-14"] .agenda__empty')).toBeNull();
    expect(sectionTitles(el, '2026-10-14')).toEqual(['Dentist']);
  });

  it('shows a multi-day event on each day', async () => {
    const { hass } = calendars({ 'calendar.family': [allDay('Trip', '2026-10-13', '2026-10-16')] });
    const el = await mount(agendaConfig, hass);
    for (const key of ['2026-10-13', '2026-10-14', '2026-10-15']) expect(sectionTitles(el, key)).toEqual(['Trip']);
    expect(sectionTitles(el, '2026-10-16')).toEqual([]);
  });

  it('dims ended events with past_events: dim', async () => {
    const { hass } = calendars({ 'calendar.family': [timed('Early', '2026-10-13T08:00:00+02:00', '2026-10-13T09:00:00+02:00')] });
    const el = await mount({ ...agendaConfig, past_events: 'dim' }, hass);
    expect(list(el).classList.contains('agenda__list--events-dim')).toBe(true);
    expect(root(el).querySelector('.agenda__day[data-day="2026-10-13"] .chip')?.classList.contains('chip--ended')).toBe(true);
  });

  it('jumps the list to a day tapped on the strip', async () => {
    const { hass } = calendars({});
    const el = await mount(agendaConfig, hass);
    layOutDays(el);
    cell(el, '2026-10-16').click();
    await flush(el);
    expect(list(el).scrollTop).toBe(600);
    expect(cell(el, '2026-10-16').classList.contains('agenda__cell--active')).toBe(true);
    expect(cell(el, '2026-10-13').classList.contains('agenda__cell--active')).toBe(false);
  });

  it('keeps a tapped day highlighted when the list cannot scroll it to the top', async () => {
    const { hass } = calendars({});
    const el = await mount(agendaConfig, hass);
    layOutDays(el);
    // Seven 200px days in a 600px scroller: it stops at 800, short of the last days.
    let top = 0;
    Object.defineProperty(list(el), 'scrollHeight', { value: 1400, configurable: true });
    Object.defineProperty(list(el), 'scrollTop', {
      get: () => top,
      set: (v: number) => (top = Math.max(0, Math.min(800, v))),
      configurable: true,
    });
    cell(el, '2026-10-18').click();
    list(el).dispatchEvent(new Event('scroll'));
    await flush(el, 16);
    expect(list(el).scrollTop).toBe(800);
    expect(cell(el, '2026-10-18').classList.contains('agenda__cell--active')).toBe(true);
    list(el).dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    top = 410;
    list(el).dispatchEvent(new Event('scroll'));
    await flush(el, 16);
    expect(cell(el, '2026-10-15').classList.contains('agenda__cell--active')).toBe(true);
  });

  it('moves the highlight while scrolling and offers a way back to today', async () => {
    const { hass } = calendars({});
    const el = await mount(agendaConfig, hass);
    layOutDays(el);
    expect(root(el).querySelector('.agenda__today')).toBeNull();
    list(el).scrollTop = 410;
    list(el).dispatchEvent(new Event('scroll'));
    await flush(el, 16);
    expect(cell(el, '2026-10-15').classList.contains('agenda__cell--active')).toBe(true);
    root(el).querySelector<HTMLButtonElement>('.agenda__today')!.click();
    await flush(el, 16);
    expect(list(el).scrollTop).toBe(0);
    expect(root(el).querySelector('.agenda__today')).toBeNull();
    expect(cell(el, '2026-10-13').classList.contains('agenda__cell--active')).toBe(true);
  });

  it('hides a calendar with its filter chip', async () => {
    const { hass } = calendars({ 'calendar.work': [timed('Standup', '2026-10-13T15:00:00+02:00', '2026-10-13T15:15:00+02:00')] });
    const el = await mount(agendaConfig, hass);
    expect(sectionTitles(el, '2026-10-13')).toEqual(['Standup']);
    root(el).querySelector<HTMLButtonElement>('.agenda__list .toggle')!.click();
    await flush(el);
    expect(sectionTitles(el, '2026-10-13')).toEqual([]);
  });

  it('shows a warning row when a calendar fails', async () => {
    const { hass } = calendars({ 'calendar.work': new Error('timeout') });
    const el = await mount(agendaConfig, hass);
    expect(text(el, '.agenda__warning')).toContain('calendar.work');
  });

  it('goes back to today on a tick only after the list was left alone for a minute', async () => {
    const { hass } = calendars({});
    const el = await mount(agendaConfig, hass);
    layOutDays(el);
    list(el).dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    list(el).scrollTop = 600;
    await vi.advanceTimersByTimeAsync(30_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush(el);
    expect(list(el).scrollTop).toBe(600);
    await vi.advanceTimersByTimeAsync(40_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush(el);
    expect(list(el).scrollTop).toBe(0);
  });
});

describe('phone views while loading', () => {
  function pending() {
    let resolve!: (events: HaCalendarEvent[]) => void;
    const { hass } = makeHass(() => new Promise<HaCalendarEvent[]>((r) => (resolve = r)));
    return { hass, resolve: (events: HaCalendarEvent[]) => resolve(events) };
  }

  it('agenda does not claim an empty day before the calendars answer', async () => {
    const { hass, resolve } = pending();
    const el = await mount({ entities: ['calendar.family'], view: 'agenda' }, hass);
    expect(root(el).querySelectorAll('.agenda__day')).toHaveLength(7);
    expect(root(el).textContent).not.toContain('Nothing planned');
    resolve([]);
    await flush(el);
    expect(texts(el, '.agenda__empty')).toHaveLength(7);
  });

  it('upcoming does not claim an empty week before the calendars answer', async () => {
    const { hass, resolve } = pending();
    const el = await mount({ entities: ['calendar.family'], view: 'upcoming' }, hass);
    expect(root(el).textContent).not.toContain('Nothing planned');
    resolve([]);
    await flush(el);
    expect(text(el, '.upcoming__empty')).toBe('Nothing planned this week');
  });
});

describe('phone views: review fixes', () => {
  it('agenda says it could not load, not "Nothing planned", when every calendar fails', async () => {
    const failed = new Error('offline');
    const { hass } = calendars({ 'calendar.family': failed, 'calendar.work': failed, 'calendar.namedays': failed });
    const el = await mount(agendaConfig, hass);
    expect(text(el, '.agenda__failed')).toBe("Couldn't load calendars");
    expect(root(el).textContent).not.toContain('Nothing planned');
  });

  it('upcoming says only the loaded calendars are empty when one failed', async () => {
    const { hass } = calendars({ 'calendar.work': new Error('timeout') });
    const el = await mount(upcomingConfig, hass);
    expect(text(el, '.upcoming__empty')).toBe('Nothing planned in the calendars that loaded');
  });

  it('forgets an earlier total failure when the config changes', async () => {
    const failed = new Error('offline');
    const { hass } = calendars({ 'calendar.family': failed, 'calendar.work': failed, 'calendar.namedays': failed });
    const el = await mount(upcomingConfig, hass);
    expect(text(el, '.upcoming__empty')).toBe("Couldn't load calendars");
    el.hass = { ...hass, callApi: () => new Promise(() => undefined) } as HomeAssistant;
    el.setConfig({ ...upcomingConfig, entities: ['calendar.family'] });
    await flush(el);
    expect(root(el).querySelector('.upcoming__empty')).toBeNull();
    expect(root(el).querySelector('.upcoming__warning')).toBeNull();
  });
});

describe('agenda floating cards', () => {
  const navbar = { type: 'custom:navbar-card', template: 'phone' };
  const todo = { type: 'todo-list', entity: 'todo.shopping' };

  beforeEach(() => {
    stubCardHelpers();
  });

  afterEach(() => {
    delete window.loadCardHelpers;
  });

  const settle = async (el: WallCalCard) => {
    await flush(el);
    await flush(el);
  };

  it('hosts an always-shown card, such as the phone navbar', async () => {
    const { hass } = calendars({});
    const el = await mount({ ...agendaConfig, overlays: [{ position: 'bottom-right', toggle: 'none', card: navbar }] }, hass);
    await settle(el);
    expect(root(el).querySelector('.agenda .overlay--bottom-right .hosted')?.getAttribute('data-type')).toBe('custom:navbar-card');
  });

  it('shows a header-toggled card from a button in the chip row', async () => {
    const { hass } = calendars({});
    const el = await mount({ ...agendaConfig, overlays: [{ position: 'bottom-left', name: 'Shopping', card: todo }] }, hass);
    expect(root(el).querySelector('.agenda .overlay')).toBeNull();
    root(el).querySelector<HTMLButtonElement>('.agenda__list .toggle[aria-label="Show Shopping"]')!.click();
    await settle(el);
    expect(root(el).querySelector('.agenda .overlay--bottom-left .hosted')).not.toBeNull();
  });

  it('upcoming still leaves floating cards out', async () => {
    const { hass } = calendars({});
    const el = await mount({ ...upcomingConfig, overlays: [{ position: 'bottom-right', toggle: 'none', card: navbar }] }, hass);
    await settle(el);
    expect(root(el).querySelector('.overlay')).toBeNull();
  });
});

describe('agenda style and height', () => {
  it('sizes itself from agenda.height and leaves its rows to its content', async () => {
    const { hass } = calendars({});
    const el = await mount({ ...agendaConfig, agenda: { height: '75vh' } }, hass);
    expect(el.style.height).toBe('75vh');
    expect(el.getGridOptions()).toEqual({ columns: 'full', rows: 'auto' });
    el.setConfig(agendaConfig);
    await flush(el);
    expect(el.style.height).toBe('');
    expect(el.getGridOptions().rows).toBe(8);
  });

  it('draws days as a date column with the events beside it by default', async () => {
    const { hass } = calendars({ 'calendar.family': [timed('Dentist', '2026-10-14T08:00:00+02:00', '2026-10-14T09:00:00+02:00')] });
    const el = await mount(agendaConfig, hass);
    expect(root(el).querySelector('.agenda')?.classList.contains('agenda--list')).toBe(true);
    const day = root(el).querySelector('.agenda__day[data-day="2026-10-14"]')!;
    expect(day.querySelector('.agenda__datecol .agenda__date')?.textContent).toBe('14');
    expect(day.querySelector('.agenda__datecol .agenda__name')?.textContent).toBe('Tomorrow');
    expect(day.querySelector('.agenda__body .chip__title')?.textContent).toBe('Dentist');
  });

  it('draws each day as its own card with agenda.style: cards', async () => {
    const { hass } = calendars({});
    const el = await mount({ ...agendaConfig, agenda: { style: 'cards' } }, hass);
    expect(root(el).querySelector('.agenda')?.classList.contains('agenda--cards')).toBe(true);
    expect(root(el).querySelector('.agenda__day .agenda__head .agenda__date')?.textContent).toBe('13');
    expect(root(el).querySelector('.agenda__datecol')).toBeNull();
  });
});

describe('upcoming opening a pop-up', () => {
  it('sets the hash and tells HA the location changed', async () => {
    const { hass } = calendars({});
    const el = await mount({ ...upcomingConfig, upcoming: { navigation_path: '#calendar' } }, hass);
    const push = vi.spyOn(history, 'pushState');
    const changed = vi.fn();
    window.addEventListener('location-changed', changed);
    root(el).querySelector<HTMLElement>('ha-card')!.click();
    window.removeEventListener('location-changed', changed);
    expect(push).toHaveBeenCalledWith(null, '', '#calendar');
    expect(changed).toHaveBeenCalledTimes(1);
    push.mockRestore();
  });
});

describe('agenda showing one day', () => {
  const dayConfig = { ...agendaConfig, agenda: { show: 'day' } };
  const shownDays = (el: WallCalCard) => [...root(el).querySelectorAll<HTMLElement>('.agenda__day')].map((d) => d.dataset.day);

  it('shows only today at first, with the whole week on the strip', async () => {
    const { hass } = calendars({});
    const el = await mount(dayConfig, hass);
    expect(shownDays(el)).toEqual(['2026-10-13']);
    expect(root(el).querySelectorAll('.agenda__cell')).toHaveLength(7);
    expect(root(el).querySelector('.agenda__today')).toBeNull();
  });

  it('shows the day tapped on the strip, and Today goes back', async () => {
    const { hass } = calendars({ 'calendar.family': [timed('Dentist', '2026-10-16T08:00:00+02:00', '2026-10-16T09:00:00+02:00')] });
    const el = await mount(dayConfig, hass);
    cell(el, '2026-10-16').click();
    await flush(el);
    expect(shownDays(el)).toEqual(['2026-10-16']);
    expect(sectionTitles(el, '2026-10-16')).toEqual(['Dentist']);
    expect(cell(el, '2026-10-16').classList.contains('agenda__cell--active')).toBe(true);
    root(el).querySelector<HTMLButtonElement>('.agenda__today')!.click();
    await flush(el);
    expect(shownDays(el)).toEqual(['2026-10-13']);
  });

  it('keeps the chosen day while the list scrolls', async () => {
    const { hass } = calendars({});
    const el = await mount(dayConfig, hass);
    cell(el, '2026-10-17').click();
    await flush(el);
    list(el).dispatchEvent(new Event('scroll'));
    await flush(el, 16);
    expect(shownDays(el)).toEqual(['2026-10-17']);
  });

  it('goes back to today on a tick after a minute left alone', async () => {
    const { hass } = calendars({});
    const el = await mount(dayConfig, hass);
    cell(el, '2026-10-15').click();
    await flush(el);
    await vi.advanceTimersByTimeAsync(30_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush(el);
    expect(shownDays(el)).toEqual(['2026-10-15']);
    await vi.advanceTimersByTimeAsync(40_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await flush(el);
    expect(shownDays(el)).toEqual(['2026-10-13']);
  });
});
