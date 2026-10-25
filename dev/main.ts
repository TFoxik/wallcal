import '../src/wallcal-card';
import type { WallCalCard } from '../src/wallcal-card';
import type { HaCalendarEvent } from '../src/data/events';
import type { HomeAssistant } from '../src/ha-types';
import { addDays, dayKey, startOfDay } from '../src/date';
import fixture from './ha/config/wallcal_fixture.json';

const today = startOfDay(new Date());

const ymd = dayKey;

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

const CONDITIONS = ['sunny', 'partlycloudy', 'rainy', 'cloudy', 'pouring', 'lightning-rainy', 'snowy', 'fog', 'windy'];
const forecast = Array.from({ length: 10 }, (_, i) => ({
  datetime: addDays(today, i - 1).toISOString(),
  condition: CONDITIONS[i % CONDITIONS.length],
  temperature: 18 - i + (i % 3),
  templow: 8 - (i % 4),
}));

// Outside HA there is no ha-icon; show a glyph so icons are visible in the harness.
const GLYPHS: Record<string, string> = {
  'mdi:weather-sunny': '☀️',
  'mdi:weather-partly-cloudy': '⛅',
  'mdi:weather-rainy': '🌧️',
  'mdi:weather-cloudy': '☁️',
  'mdi:weather-pouring': '🌧️',
  'mdi:weather-lightning-rainy': '⛈️',
  'mdi:weather-snowy': '❄️',
  'mdi:weather-fog': '🌫️',
  'mdi:weather-windy': '💨',
  'mdi:briefcase': '💼',
  'mdi:format-list-checks': '☑️',
  'mdi:card-outline': '▢',
};
customElements.define(
  'ha-icon',
  class extends HTMLElement {
    static observedAttributes = ['icon'];
    attributeChangedCallback() {
      this.textContent = GLYPHS[this.getAttribute('icon') ?? ''] ?? '•';
    }
  },
);

// Stand-in for HA's card factory so overlay placement and theming can be checked outside HA.
window.loadCardHelpers = async () => ({
  createCardElement: (config: Record<string, unknown>) => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:12px 16px;color:var(--primary-text-color)';
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.textContent = String(config.title ?? config.entity ?? config.type);
    const rows = ['Milk', 'Bread', 'Call grandma', 'Water the plants', 'Return library books'].map((text) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--divider-color)';
      const box = document.createElement('input');
      box.type = 'checkbox';
      row.append(box, text);
      return row;
    });
    card.append(title, ...rows);
    return card;
  },
});

const hass = {
  states: {
    'calendar.family': { last_changed: today.toISOString() },
    'calendar.work': { last_changed: today.toISOString(), attributes: { friendly_name: 'Work' } },
    'calendar.namedays': { last_changed: today.toISOString(), attributes: { friendly_name: 'Svátky' } },
    'calendar.namedays_sk': { last_changed: today.toISOString(), attributes: { friendly_name: 'Meniny' } },
    'weather.home': { last_changed: today.toISOString(), attributes: { supported_features: 1 } },
    'input_datetime.last_period': { state: ymd(addDays(today, -9)), last_changed: today.toISOString() },
    'input_number.cycle_length': { state: '28.0', last_changed: today.toISOString() },
    'input_number.period_length': { state: '5.0', last_changed: today.toISOString() },
  },
  connection: {
    subscribeMessage: async (callback: (message: unknown) => void) => {
      setTimeout(() => callback({ type: 'daily', forecast }), 200);
      return async () => undefined;
    },
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

const chips = {
  entities: [
    { entity: 'calendar.family', color: '#7F77DD' },
    { entity: 'calendar.work', color: '#378ADD', toggle: true, icon: 'mdi:briefcase' },
    { entity: 'calendar.namedays', color: '#F4A27A', toggle: true, display: 'label', strip_prefix: 'Svátek:', suffix: 'CZ' },
    { entity: 'calendar.namedays_sk', color: '#8FB8E8', toggle: true, display: 'label', suffix: 'SK' },
  ],
};

const VARIANTS: Array<[string, Record<string, unknown>]> = [
  [
    'Overlays: todo over the weekend, entity bottom-left',
    {
      ...chips,
      weather: { entity: 'weather.home' },
      overlays: [
        { position: 'bottom-right', toggle: 'pill', name: 'Shopping', icon: 'mdi:format-list-checks', card: { type: 'todo-list', entity: 'todo.shopping' } },
        { position: 'bottom-left', span: 2, width: '45%', visible: true, icon: 'mdi:weather-partly-cloudy', card: { type: 'tile', entity: 'weather.home' } },
      ],
    },
  ],
  ['Toggle chips, weather, dimmed past events, auto-scroll', { ...chips, past_events: 'dim', weather: { entity: 'weather.home' } }],
  ['Hidden past events, high temperature only', { ...chips, past_events: 'hide', weather: { entity: 'weather.home', show_low: false } }],
  ['No overlays', base],
  ['End times, greyed past days', { ...base, show_end_time: true, past_days: 'grey' }],
  [
    'Custom title, week as subtitle, dimmed past days',
    { ...base, past_days: 'dim', header: { title: 'Family calendar', subtitle: 'range' } },
  ],
  ['Moon with names', { ...base, moon: { enabled: true, show_name: true } }],
  ['Period', { ...base, period: { enabled: true, last_period: lastPeriod } }],
  [
    'Period from helpers',
    {
      ...base,
      period: {
        enabled: true,
        last_period: 'input_datetime.last_period',
        cycle_length: 'input_number.cycle_length',
        period_length: 'input_number.period_length',
      },
    },
  ],
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

const PHONE_VARIANTS: Array<[string, Record<string, unknown>]> = [
  ['Phone: agenda', { ...chips, view: 'agenda', past_events: 'dim', moon: { enabled: true } }],
  ['Phone: upcoming', { ...chips, view: 'upcoming', upcoming: { navigation_path: '/wallcal-phone/calendar' } }],
];

const container = document.getElementById('variants') as HTMLElement;
for (const [label, config] of [...VARIANTS, ...PHONE_VARIANTS]) {
  const section = document.createElement('section');
  if (PHONE_VARIANTS.some(([phone]) => phone === label)) section.className = 'phone';
  const heading = document.createElement('h2');
  heading.textContent = label;
  const card = document.createElement('wallcal-card') as WallCalCard;
  card.setConfig(config);
  card.hass = hass;
  section.append(heading, card);
  container.append(section);
}
