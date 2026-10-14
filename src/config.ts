import { parseLocalDate, type Weekday } from './date';
import type { Hemisphere } from './astro/moon';
import { TIME_FORMATS, TITLE_MODES, type TimeFormat } from './format';
import type { DayCount } from './week';
import { THEME_NAMES, TOKENS, type ThemeName, type Token } from './theme/presets';

export interface EntityConfig {
  entity: string;
  color: string;
  name?: string;
  icon?: string;
  toggle: boolean;
}

const TITLE_SETTINGS = [...TITLE_MODES, 'none'] as const;
export type HeaderTitle = (typeof TITLE_SETTINGS)[number] | { text: string };

export interface HeaderConfig {
  show: boolean;
  title: HeaderTitle;
  subtitle: HeaderTitle;
  align: 'left' | 'center';
  navigation: boolean;
  idle_return: number;
}

export interface MoonConfig {
  enabled: boolean;
  show_name: boolean;
  hemisphere: Hemisphere;
}

export interface PeriodConfig {
  enabled: boolean;
  last_period: Date | null;
  cycle_length: number;
  period_length: number;
  show_fertile: boolean;
  show_ovulation: boolean;
}

export interface WeatherConfig {
  entity: string;
  show_low: boolean;
}

export const PAST_DAYS = ['normal', 'dim', 'grey'] as const;
export type PastDays = (typeof PAST_DAYS)[number];

export const PAST_EVENTS = ['show', 'dim', 'hide'] as const;
export type PastEvents = (typeof PAST_EVENTS)[number];

export interface WallCalConfig {
  entities: EntityConfig[];
  days: DayCount;
  first_day: Weekday;
  time_format: TimeFormat;
  show_end_time: boolean;
  past_days: PastDays;
  past_events: PastEvents;
  auto_scroll: boolean;
  refresh_interval: number;
  header: HeaderConfig;
  weather: WeatherConfig | null;
  moon: MoonConfig;
  period: PeriodConfig;
  theme: ThemeName;
  style: Partial<Record<Token, string>>;
  font_url: string | null;
}

export const ENTITY_PALETTE = ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#BA7517'];

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const ENTITY_ID = /^calendar\.[a-z0-9_]+$/;
const WEATHER_ID = /^weather\.[a-z0-9_]+$/;
const ICON = /^[a-z0-9-]+:[a-z0-9-]+$/;
const FONT_URL = /^(https:\/\/|\/(?!\/))/;

type Raw = Record<string, unknown>;

export function normalizeConfig(input: unknown): WallCalConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('WallCal configuration must be a mapping');
  }
  const raw = input as Raw;
  const header = section(raw.header, 'header');
  const moon = section(raw.moon, 'moon');
  const period = section(raw.period, 'period');

  const periodEnabled = bool(period.enabled, false, 'period.enabled');
  const lastPeriod = toLocalDate(period.last_period, 'period.last_period');
  if (periodEnabled && !lastPeriod) {
    throw new Error('period.last_period is required when period.enabled is true (format YYYY-MM-DD)');
  }

  const { style, fontUrl } = parseStyle(section(raw.style, 'style'));

  return {
    entities: parseEntities(raw.entities),
    days: choice(raw.days, [5, 7] as const, 7, 'days'),
    first_day: WEEKDAYS.indexOf(oneOf(raw.first_day, WEEKDAYS, 'monday', 'first_day')) as Weekday,
    time_format: oneOf(raw.time_format, TIME_FORMATS, 'auto', 'time_format'),
    show_end_time: bool(raw.show_end_time, false, 'show_end_time'),
    past_days: oneOf(raw.past_days, PAST_DAYS, 'normal', 'past_days'),
    past_events: oneOf(raw.past_events, PAST_EVENTS, 'show', 'past_events'),
    auto_scroll: bool(raw.auto_scroll, true, 'auto_scroll'),
    refresh_interval: int(raw.refresh_interval, 300, 60, 86_400, 'refresh_interval'),
    header: {
      show: bool(header.show, true, 'header.show'),
      title: headerTitle(header.title, 'month'),
      subtitle: headerTitle(header.subtitle, 'none'),
      align: oneOf(header.align, ['left', 'center'] as const, 'left', 'header.align'),
      navigation: bool(header.navigation, true, 'header.navigation'),
      idle_return: int(header.idle_return, 60, 0, 86_400, 'header.idle_return'),
    },
    weather: raw.weather === undefined || raw.weather === null ? null : parseWeather(section(raw.weather, 'weather')),
    moon: {
      enabled: bool(moon.enabled, false, 'moon.enabled'),
      show_name: bool(moon.show_name, false, 'moon.show_name'),
      hemisphere: oneOf(moon.hemisphere, ['north', 'south'] as const, 'north', 'moon.hemisphere'),
    },
    period: {
      enabled: periodEnabled,
      last_period: lastPeriod,
      cycle_length: int(period.cycle_length, 28, 20, 45, 'period.cycle_length'),
      period_length: int(period.period_length, 5, 1, 10, 'period.period_length'),
      show_fertile: bool(period.show_fertile, true, 'period.show_fertile'),
      show_ovulation: bool(period.show_ovulation, true, 'period.show_ovulation'),
    },
    theme: oneOf(raw.theme, THEME_NAMES, 'default', 'theme'),
    style,
    font_url: fontUrl,
  };
}

// Keywords pick a generated title; any other text is shown as is.
function headerTitle(value: unknown, fallback: HeaderTitle): HeaderTitle {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  if (!text) return 'none';
  const keyword = TITLE_SETTINGS.find((setting) => setting === text.toLowerCase());
  return keyword ?? { text };
}

function section(value: unknown, path: string): Raw {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be a mapping`);
  return value as Raw;
}

function bool(value: unknown, fallback: boolean, path: string): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  throw new Error(`${path} must be true or false`);
}

function int(value: unknown, fallback: number, min: number, max: number, path: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${path} must be a whole number from ${min} to ${max}`);
  }
  return n;
}

function choice<T extends number>(value: unknown, options: readonly T[], fallback: T, path: string): T {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if ((options as readonly number[]).includes(n)) return n as T;
  throw new Error(`${path} must be ${options.join(' or ')}`);
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T, path: string): T {
  if (value === undefined || value === null) return fallback;
  const s = String(value).toLowerCase();
  if ((options as readonly string[]).includes(s)) return s as T;
  throw new Error(`${path} must be one of: ${options.join(', ')}`);
}

// HA's YAML handling can hand an unquoted date over as a Date at UTC midnight or as an ISO
// datetime string; both must mean the calendar date the user typed.
function toLocalDate(value: unknown, path: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value === 'string') {
    const parsed = parseLocalDate(value.slice(0, 10));
    if (parsed) return parsed;
  }
  throw new Error(`${path} must be a date like 2026-10-02`);
}

function parseEntities(value: unknown): EntityConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('entities must list at least one calendar entity');
  }
  return value.map((item, i) => {
    const obj: Raw = typeof item === 'string' ? { entity: item } : section(item, `entities[${i}]`);
    const entity = String(obj.entity ?? '');
    if (!ENTITY_ID.test(entity)) {
      throw new Error(`entities[${i}]: "${entity}" is not a calendar entity id (expected calendar.something)`);
    }
    const color = obj.color === undefined ? ENTITY_PALETTE[i % ENTITY_PALETTE.length] : String(obj.color);
    const result: EntityConfig = { entity, color, toggle: bool(obj.toggle, false, `entities[${i}].toggle`) };
    if (obj.name !== undefined) result.name = String(obj.name);
    if (obj.icon !== undefined) {
      const icon = String(obj.icon);
      if (!ICON.test(icon)) throw new Error(`entities[${i}].icon must look like mdi:flag`);
      result.icon = icon;
    }
    return result;
  });
}

function parseWeather(raw: Raw): WeatherConfig {
  const entity = String(raw.entity ?? '');
  if (!WEATHER_ID.test(entity)) {
    throw new Error(`weather.entity: "${entity}" is not a weather entity id (expected weather.something)`);
  }
  return { entity, show_low: bool(raw.show_low, true, 'weather.show_low') };
}

function parseStyle(raw: Raw): { style: Partial<Record<Token, string>>; fontUrl: string | null } {
  const { font_url, ...tokens } = raw;
  const fontUrl = font_url === undefined || font_url === null ? null : String(font_url);
  if (fontUrl !== null && !FONT_URL.test(fontUrl)) throw new Error('style.font_url must start with https:// or /');

  const style: Partial<Record<Token, string>> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (!(TOKENS as readonly string[]).includes(key)) {
      throw new Error(`style.${key} is not a known style option. Known: ${[...TOKENS, 'font_url'].join(', ')}`);
    }
    style[key as Token] = typeof value === 'number' ? `${value}px` : String(value);
  }
  return { style, fontUrl };
}

export function isCalendarEntityId(id: string): boolean {
  return ENTITY_ID.test(id);
}
