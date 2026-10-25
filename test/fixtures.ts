import type { HaCalendarEvent, WallCalEvent } from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';

export function wallEvent(title: string, start: Date, end: Date, allDay = false): WallCalEvent {
  return { entity: 'calendar.family', title, start, end, allDay, color: '#7F77DD' };
}

export function timed(summary: string, startIso: string, endIso: string): HaCalendarEvent {
  return { summary, start: { dateTime: startIso }, end: { dateTime: endIso } };
}

export function allDay(summary: string, date: string, end: string): HaCalendarEvent {
  return { summary, start: { date }, end: { date: end } };
}

export function makeHass(
  handler: (path: string) => Promise<HaCalendarEvent[]>,
  lastChanged = '2026-10-13T08:00:00Z',
): { hass: HomeAssistant; calls: string[] } {
  const calls: string[] = [];
  const hass: HomeAssistant = {
    states: { 'calendar.family': { last_changed: lastChanged } },
    locale: { language: 'en-US', time_format: '24' },
    connection: { subscribeMessage: () => Promise.resolve(async () => undefined) },
    callApi: <T>(_method: string, path: string) => {
      calls.push(path);
      return handler(path) as Promise<T>;
    },
  };
  return { hass, calls };
}

// happy-dom has no layout: give the list a height and its chips heights, stacked with the 6px gap.
export function layOut(list: HTMLElement, height: number, chipHeights: number[]) {
  Object.defineProperty(list, 'clientHeight', { value: height, configurable: true });
  let top = 0;
  list.querySelectorAll<HTMLElement>('.chip').forEach((chip, i) => {
    const h = chipHeights[i] ?? 0;
    Object.defineProperty(chip, 'offsetTop', { value: top, configurable: true });
    Object.defineProperty(chip, 'offsetHeight', { value: h, configurable: true });
    if (h) top += h + 6;
  });
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value as object).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// Answers each calendar from its own list; a calendar mapped to an Error rejects.
export function calendars(byEntity: Record<string, HaCalendarEvent[] | Error>) {
  return makeHass(async (path) => {
    const entity = Object.keys(byEntity).find((e) => path.includes(`calendars/${e}?`));
    const answer = entity ? byEntity[entity] : [];
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

// Stand-in for HA's card factory: each hosted card is a div.hosted carrying its config's type and entity.
export function stubCardHelpers(): Array<HTMLElement & { hass?: unknown }> {
  const created: Array<HTMLElement & { hass?: unknown }> = [];
  window.loadCardHelpers = async () => ({
    createCardElement: (cardConfig: Record<string, unknown>) => {
      const el = document.createElement('div') as HTMLElement & { hass?: unknown };
      el.className = 'hosted';
      el.dataset.type = String(cardConfig.type);
      el.dataset.entity = String(cardConfig.entity);
      created.push(el);
      return el;
    },
  });
  return created;
}
