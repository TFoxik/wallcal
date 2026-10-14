import type { HaCalendarEvent, WallCalEvent } from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';

export function wallEvent(title: string, start: Date, end: Date, allDay = false): WallCalEvent {
  return { entity: 'calendar.family', title, start, end, allDay, color: '#7F77DD' };
}

export function timed(summary: string, startIso: string, endIso: string): HaCalendarEvent {
  return { summary, start: { dateTime: startIso }, end: { dateTime: endIso } };
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
