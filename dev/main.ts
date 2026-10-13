import '../src/wallcal-card';
import type { WallCalCard } from '../src/wallcal-card';
import type { HaCalendarEvent } from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';
import { addDays, startOfDay } from '../src/date';
import fixture from './ha/config/wallcal_fixture.json';

const today = startOfDay(new Date());

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const at = (offset: number, hhmm: string) => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const d = addDays(today, offset);
  d.setHours(hours, minutes);
  return d.toISOString();
};

// Format documented in dev/ha/config/custom_components/wallcal_fixture/calendar.py. Same file as the
// local Home Assistant fixture calendars, so both harnesses show the same week.
type FixtureItem = { summary: string; day: number } & (
  | { start?: undefined; days?: number }
  | { start: string; end: string; end_day?: number }
);

const toEvent = (item: FixtureItem): HaCalendarEvent =>
  item.start === undefined
    ? {
        summary: item.summary,
        start: { date: ymd(addDays(today, item.day)) },
        end: { date: ymd(addDays(today, item.day + (item.days ?? 1))) },
      }
    : {
        summary: item.summary,
        start: { dateTime: at(item.day, item.start) },
        end: { dateTime: at(item.end_day ?? item.day, item.end) },
      };

const FIXTURES: Record<string, HaCalendarEvent[]> = Object.fromEntries(
  Object.entries(fixture as Record<string, FixtureItem[]>).map(([key, items]) => [
    `calendar.${key}`,
    items.map(toEvent),
  ]),
);

const hass = {
  states: {
    'calendar.family': { last_changed: today.toISOString() },
    'calendar.work': { last_changed: today.toISOString() },
  },
  locale: { language: navigator.language, time_format: 'language' },
  callApi: async <T>(_method: string, path: string): Promise<T> => {
    const id = path.slice('calendars/'.length).split('?')[0];
    await new Promise((resolve) => setTimeout(resolve, 150));
    return (FIXTURES[id] ?? []) as T;
  },
} as HomeAssistant;

const lastPeriod = ymd(addDays(today, -9));
const base = { entities: [{ entity: 'calendar.family', color: '#7F77DD' }, 'calendar.work'] };

const VARIANTS: Array<[string, Record<string, unknown>]> = [
  ['No overlays', base],
  ['End times, greyed past days', { ...base, show_end_time: true, past_days: 'grey' }],
  [
    'Custom title, week as subtitle, dimmed past days',
    { ...base, past_days: 'dim', header: { title: 'Family calendar', subtitle: 'range' } },
  ],
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
      period: { enabled: true, last_period: ymd(addDays(today, -1)) },
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
