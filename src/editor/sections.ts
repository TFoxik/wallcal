import { PAST_DAYS, PAST_EVENTS, VIEWS, WEEKDAYS } from '../config';
import { TIME_FORMATS, TITLE_MODES, WEEKDAY_FORMATS } from '../format';
import { THEME_NAMES } from '../theme/presets';
import { hexToRgb, isHex, rgbToHex } from './colors';
import { getAt, isPlainObject, type FieldRules, type Path, type Raw } from './raw-config';

export type Selector = Record<string, unknown>;
export interface FieldSchema {
  name: string;
  selector: Selector;
  required?: boolean;
}
export interface GridSchema {
  type: 'grid';
  name: '';
  schema: FieldSchema[];
}
export type FormSchema = FieldSchema | GridSchema;

export interface SchemaContext {
  days: number;
  /** Lowercased positions held by other overlays. */
  taken?: readonly string[];
}

export interface SectionDef {
  id: string;
  title: string;
  icon: string;
  prefix: Path;
  rules: FieldRules;
  /** Enum fields shown lowercased, as the card reads them; the YAML keeps its own case until edited. */
  lowercase?: readonly string[];
  /** Field labels for this section; they win over the shared ones. */
  labels?: Record<string, string>;
  toForm?: (values: Raw) => Raw;
  schema: (form: Raw, ctx: SchemaContext) => FormSchema[];
  finalize?: (root: Raw) => Raw;
}

export const COLOR_TOKENS = [
  'background', 'surface', 'text', 'muted', 'accent', 'today_background', 'divider', 'overlay_background',
  'period_color', 'fertile_color', 'ovulation_color', 'ring_color', 'moon_color',
] as const;
export const SIZE_TOKENS = [
  'radius', 'day_radius', 'chip_radius', 'gap', 'padding',
  'title_size', 'date_size', 'weekday_size', 'event_size', 'allday_size', 'time_size',
] as const;
export const TEXT_TOKENS = ['font_family', 'title_font'] as const;

const PX = /^\d+(\.\d+)?(px)?$/;

export function formData(section: SectionDef, root: unknown): Raw {
  const stored = getAt(root, section.prefix);
  const current = isPlainObject(stored) ? stored : {};
  const merged: Raw = {};
  for (const [key, fallback] of Object.entries(section.rules.defaults)) {
    const value = current[key] ?? fallback;
    if (value !== undefined) merged[key] = value;
  }
  for (const key of section.lowercase ?? []) {
    if (typeof merged[key] === 'string') merged[key] = (merged[key] as string).toLowerCase();
  }
  return section.toForm ? section.toForm(merged) : merged;
}

export function fieldNames(schema: FormSchema[]): string[] {
  return schema.flatMap((s) => ('type' in s && s.type === 'grid' ? s.schema.map((f) => f.name) : [s.name]));
}

const humanize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]/g, ' ');

export function select(options: readonly string[], extra: Selector = {}): Selector {
  return { select: { mode: 'dropdown', options: options.map((value) => ({ value, label: humanize(value) })), ...extra } };
}

export const grid = (...fields: (FieldSchema | false)[]): GridSchema => ({
  type: 'grid',
  name: '',
  schema: fields.filter((f): f is FieldSchema => f !== false),
});
export const bool = (name: string): FieldSchema => ({ name, selector: { boolean: {} } });
export const text = (name: string): FieldSchema => ({ name, selector: { text: {} } });
export const number = (name: string, min: number, max: number, unit?: string): FieldSchema => ({
  name,
  selector: { number: { min, max, step: 1, mode: 'box', ...(unit ? { unit_of_measurement: unit } : {}) } },
});

/** HA's colour picker for hex or unset values; anything it can't show (rgba, var(--…)) stays editable as text. */
export const colorField = (name: string, value: unknown): FieldSchema =>
  typeof value === 'string' ? text(name) : { name, selector: { color_rgb: {} } };

// HA hands an unquoted YAML date over as UTC midnight, so the UTC date is the one the user typed.
const toIsoDate = (value: unknown): unknown => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? value : value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value.slice(0, 10) : value;
};

const MONDAY_FIRST = [...WEEKDAYS.slice(1), WEEKDAYS[0]];

export const WEEK: SectionDef = {
  id: 'week',
  title: 'Week',
  icon: 'mdi:calendar-week',
  prefix: [],
  rules: {
    defaults: {
      days: 7, first_day: 'monday', time_format: 'auto', weekday_format: 'short', show_end_time: false,
      past_days: 'normal', past_events: 'show', auto_scroll: true, refresh_interval: 300,
    },
    fromForm: (f) => ({ ...f, days: Number(f.days), time_format: f.time_format === 'auto' ? 'auto' : Number(f.time_format) }),
  },
  lowercase: ['first_day', 'weekday_format', 'past_days', 'past_events'],
  toForm: (v) => ({ ...v, days: String(v.days), time_format: String(v.time_format) }),
  schema: (f) => [
    grid(
      { name: 'days', selector: select(['7', '5']) },
      f.days !== '5' && { name: 'first_day', selector: select(MONDAY_FIRST) },
    ),
    grid({ name: 'time_format', selector: select(TIME_FORMATS) }, { name: 'weekday_format', selector: select(WEEKDAY_FORMATS) }),
    grid({ name: 'past_days', selector: select(PAST_DAYS) }, { name: 'past_events', selector: select(PAST_EVENTS) }),
    grid(bool('show_end_time'), bool('auto_scroll')),
    number('refresh_interval', 60, 86_400, 's'),
  ],
};

export const VIEW: SectionDef = {
  id: 'view',
  title: 'View',
  icon: 'mdi:cellphone',
  prefix: [],
  rules: { defaults: { view: 'week' } },
  lowercase: ['view'],
  schema: () => [{ name: 'view', selector: select(VIEWS) }],
};

export const UPCOMING: SectionDef = {
  id: 'upcoming',
  title: 'Home strip',
  icon: 'mdi:format-list-bulleted',
  prefix: ['upcoming'],
  rules: { defaults: { count: 3, navigation_path: '' } },
  schema: () => [number('count', 1, 5), text('navigation_path')],
};

const titleSelector = select([...TITLE_MODES, 'none'], { custom_value: true });

export const HEADER: SectionDef = {
  id: 'header',
  title: 'Top bar',
  icon: 'mdi:page-layout-header',
  prefix: ['header'],
  rules: { defaults: { show: true, title: 'month', subtitle: 'none', align: 'left', navigation: true, idle_return: 60 } },
  lowercase: ['align'],
  toForm: (v) => ({ ...v, title: String(v.title), subtitle: String(v.subtitle) }),
  schema: (f) =>
    f.show === false
      ? [bool('show')]
      : [
          bool('show'),
          grid({ name: 'title', selector: titleSelector }, { name: 'subtitle', selector: titleSelector }),
          grid({ name: 'align', selector: select(['left', 'center']) }, bool('navigation')),
          number('idle_return', 0, 86_400, 's'),
        ],
};

export const WEATHER: SectionDef = {
  id: 'weather',
  title: 'Weather',
  icon: 'mdi:weather-partly-cloudy',
  prefix: ['weather'],
  rules: { defaults: { entity: undefined, show_low: true } },
  schema: (f) => [
    { name: 'entity', selector: { entity: { filter: { domain: 'weather' } } } },
    ...(f.entity ? [bool('show_low')] : []),
  ],
  finalize: (root) => {
    if (getAt(root, ['weather', 'entity']) !== undefined) return root;
    const { weather: _removed, ...rest } = root;
    return rest;
  },
};

export const MOON: SectionDef = {
  id: 'moon',
  title: 'Moon',
  icon: 'mdi:moon-waning-crescent',
  prefix: ['moon'],
  rules: { defaults: { enabled: false, show_name: false, hemisphere: 'north' } },
  lowercase: ['hemisphere'],
  schema: (f) => (f.enabled ? [bool('enabled'), bool('show_name'), { name: 'hemisphere', selector: select(['north', 'south']) }] : [bool('enabled')]),
};

export const PERIOD: SectionDef = {
  id: 'period',
  title: 'Cycle',
  icon: 'mdi:water-outline',
  prefix: ['period'],
  rules: { defaults: { enabled: false, last_period: undefined, cycle_length: 28, period_length: 5, show_fertile: true, show_ovulation: true } },
  toForm: (v) => (v.last_period === undefined ? v : { ...v, last_period: toIsoDate(v.last_period) }),
  schema: (f) => {
    const lastPeriod: FieldSchema = { name: 'last_period', selector: { date: {} } };
    return f.enabled
      ? [
          bool('enabled'),
          { ...lastPeriod, required: true },
          grid(number('cycle_length', 20, 45, 'days'), number('period_length', 1, 10, 'days')),
          grid(bool('show_fertile'), bool('show_ovulation')),
        ]
      : [bool('enabled'), lastPeriod];
  },
};

export const THEME: SectionDef = {
  id: 'theme',
  title: 'Theme',
  icon: 'mdi:palette',
  prefix: [],
  rules: { defaults: { theme: 'default' } },
  lowercase: ['theme'],
  schema: () => [{ name: 'theme', selector: select(THEME_NAMES) }],
};

const styleDefaults: Raw = Object.fromEntries(
  [...COLOR_TOKENS, ...SIZE_TOKENS, ...TEXT_TOKENS, 'font_url'].map((token) => [token, undefined]),
);

export const STYLE: SectionDef = {
  id: 'style',
  title: 'Style',
  icon: 'mdi:format-paint',
  prefix: ['style'],
  rules: {
    defaults: styleDefaults,
    fromForm: (f) => {
      const out: Raw = { ...f };
      for (const token of COLOR_TOKENS) if (Array.isArray(f[token])) out[token] = rgbToHex(f[token] as number[]);
      return out;
    },
  },
  toForm: (v) => {
    const out: Raw = { ...v };
    for (const token of COLOR_TOKENS) if (isHex(v[token])) out[token] = hexToRgb(v[token] as string);
    for (const token of SIZE_TOKENS) {
      const value = v[token];
      if (typeof value === 'string' && PX.test(value)) out[token] = parseFloat(value);
    }
    return out;
  },
  schema: (f) => {
    const size = (token: string): FieldSchema => (typeof f[token] === 'string' ? text(token) : number(token, 0, 200, 'px'));
    return [
      grid(...COLOR_TOKENS.map((token) => colorField(token, f[token]))),
      grid(...SIZE_TOKENS.map(size)),
      text('font_url'),
      grid(...TEXT_TOKENS.map(text)),
    ];
  },
};

const LABELS: Record<string, string> = {
  view: 'Layout',
  count: 'Events shown',
  navigation_path: 'Open on tap',
  days: 'Days shown',
  first_day: 'Week starts on',
  time_format: 'Time format',
  weekday_format: 'Weekday names',
  past_days: 'Earlier days',
  past_events: "Today's finished events",
  show_end_time: 'Show end times',
  auto_scroll: 'Scroll today to the next event',
  refresh_interval: 'Refresh every',
  show: 'Show the top bar',
  title: 'Title',
  subtitle: 'Subtitle',
  align: 'Align',
  navigation: 'Week navigation',
  idle_return: 'Back to this week after',
  entity: 'Entity',
  show_low: 'Show the low temperature',
  enabled: 'Enabled',
  show_name: 'Show the phase name',
  hemisphere: 'Hemisphere',
  last_period: 'Last period started',
  cycle_length: 'Cycle length',
  period_length: 'Period length',
  show_fertile: 'Show the fertile window',
  show_ovulation: 'Show ovulation',
  theme: 'Theme',
  font_url: 'Font stylesheet URL',
};

const HELPERS: Record<string, string> = {
  view: 'week for a wall tablet, agenda for a phone tab, upcoming for a small next-up card',
  navigation_path: 'A dashboard path, for example /smart-home/calendar',
  title: 'month, range, none, or your own text',
  idle_return: '0 never jumps back',
  font_url: 'Must start with https:// or /',
  last_period: 'Stored in the dashboard configuration: anyone who can open this dashboard can read it.',
};

function computeLabel(schema: { name: string }): string {
  return LABELS[schema.name] ?? humanize(schema.name);
}

const sectionLabels = new WeakMap<SectionDef, (schema: { name: string }) => string>();

/** One stable label function per section, so ha-form isn't handed a new one on every render. */
export function labelsFor(section: SectionDef): (schema: { name: string }) => string {
  let fn = sectionLabels.get(section);
  if (!fn) {
    fn = (schema) => section.labels?.[schema.name] ?? computeLabel(schema);
    sectionLabels.set(section, fn);
  }
  return fn;
}

export function computeHelper(schema: { name: string }): string | undefined {
  return HELPERS[schema.name];
}
