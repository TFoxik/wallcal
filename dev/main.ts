import '../src/wallcal-card';
import type { WallCalCard } from '../src/wallcal-card';
import type { HaCalendarEvent } from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';
import { addDays, startOfDay } from '../src/date';

const today = startOfDay(new Date());

const at = (offset: number, hours: number, minutes = 0) => {
  const d = addDays(today, offset);
  d.setHours(hours, minutes);
  return d.toISOString();
};

const day = (offset: number) => {
  const d = addDays(today, offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FIXTURES: Record<string, HaCalendarEvent[]> = {
  'calendar.family': [
    { summary: 'School trip', start: { date: day(0) }, end: { date: day(2) } },
    { summary: 'Dentist', start: { dateTime: at(0, 8, 30) }, end: { dateTime: at(0, 9, 15) } },
    {
      summary: 'Swimming lessons with a rather long title that wraps',
      start: { dateTime: at(1, 17) },
      end: { dateTime: at(1, 18) },
    },
    { summary: 'Dinner at grandma', start: { dateTime: at(3, 18, 30) }, end: { dateTime: at(3, 21) } },
    { summary: '<b>Should render as text</b>', start: { dateTime: at(4, 12) }, end: { dateTime: at(4, 13) } },
  ],
  'calendar.work': [
    { summary: 'Night deploy', start: { dateTime: at(-1, 23) }, end: { dateTime: at(0, 1) } },
    { summary: 'Standup', start: { dateTime: at(0, 9, 30) }, end: { dateTime: at(0, 9, 45) } },
    { summary: 'Release', start: { dateTime: at(2, 14) }, end: { dateTime: at(2, 15) } },
  ],
};

const entity = (id: string) => ({
  entity_id: id,
  state: 'off',
  last_changed: today.toISOString(),
  last_updated: today.toISOString(),
  attributes: {},
});

const hass = {
  states: { 'calendar.family': entity('calendar.family'), 'calendar.work': entity('calendar.work') },
  locale: { language: navigator.language, time_format: 'language' },
  callApi: async <T>(_method: string, path: string): Promise<T> => {
    const id = path.slice('calendars/'.length).split('?')[0];
    await new Promise((resolve) => setTimeout(resolve, 150));
    return (FIXTURES[id] ?? []) as T;
  },
} as HomeAssistant;

const lastPeriod = day(-9);
const base = { entities: [{ entity: 'calendar.family', color: '#7F77DD' }, 'calendar.work'] };

const VARIANTS: Array<[string, Record<string, unknown>]> = [
  ['No overlays', base],
  ['Moon with names', { ...base, moon: { enabled: true, show_name: true } }],
  ['Period', { ...base, period: { enabled: true, last_period: lastPeriod } }],
  [
    'Moon + period, paper, 12h',
    { ...base, theme: 'paper', time_format: 12, moon: { enabled: true }, period: { enabled: true, last_period: lastPeriod } },
  ],
  [
    'Midnight, 5 days, range title, centred',
    {
      ...base,
      theme: 'midnight',
      days: 5,
      header: { title: 'range', align: 'center' },
      moon: { enabled: true },
      period: { enabled: true, last_period: day(-1) },
    },
  ],
];

const container = document.getElementById('variants') as HTMLElement;
for (const [label, config] of VARIANTS) {
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = label;
  const card = document.createElement('wallcal-card') as WallCalCard;
  card.setConfig(config);
  card.hass = hass;
  section.append(heading, card);
  container.append(section);
}
