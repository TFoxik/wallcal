import { parseLocalDate, type Weekday } from './date';
import type { Hemisphere } from './astro/moon';
import { TIME_FORMATS, TITLE_MODES, WEEKDAY_FORMATS, type TimeFormat, type WeekdayFormat } from './format';
import type { DayCount } from './week';
import { overlayKey } from './data/overlays';
import { THEME_NAMES, TOKENS, type ThemeName, type Token } from './theme/presets';

export const ENTITY_DISPLAYS = ['chip', 'label'] as const;
export type EntityDisplay = (typeof ENTITY_DISPLAYS)[number];

export interface EntityConfig {
  entity: string;
  color: string;
  name?: string;
  icon?: string;
  toggle: boolean;
  display: EntityDisplay;
  strip_prefix?: string;
  suffix?: string;
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

export const OVERLAY_POSITIONS = ['bottom-left', 'bottom-center', 'bottom-right'] as const;
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

export const OVERLAY_TOGGLES = ['header', 'pill', 'none'] as const;
export type OverlayToggle = (typeof OVERLAY_TOGGLES)[number];

export const PILL_STYLES = ['full', 'compact'] as const;
export type PillStyle = (typeof PILL_STYLES)[number];

export interface OverlayConfig {
  /** Position plus a hash of `card`: identifies the overlay's stored state and hosted card. */
  key: string;
  position: OverlayPosition;
  span: number;
  /** Share of the spanned columns, 0.1–1. */
  width: number;
  /** CSS length: a percentage of the grid height or pixels. */
  max_height: string;
  offset: number;
  toggle: OverlayToggle;
  /** `compact` leaves the name out of the pill: icon and count only. */
  pill: PillStyle;
  visible: boolean;
  icon: string;
  name?: string;
  card: Record<string, unknown>;
}

export const VIEWS = ['week', 'agenda', 'upcoming'] as const;
export type View = (typeof VIEWS)[number];

export interface UpcomingConfig {
  count: number;
  navigation_path: string | null;
}

export const AGENDA_STYLES = ['list', 'cards'] as const;
export type AgendaStyle = (typeof AGENDA_STYLES)[number];

export interface AgendaConfig {
  style: AgendaStyle;
  /** CSS length; null lets the dashboard size the card. */
  height: string | null;
}

export interface WallCalConfig {
  entities: EntityConfig[];
  days: DayCount;
  first_day: Weekday;
  time_format: TimeFormat;
  weekday_format: WeekdayFormat;
  show_end_time: boolean;
  past_days: PastDays;
  past_events: PastEvents;
  auto_scroll: boolean;
  refresh_interval: number;
  header: HeaderConfig;
  weather: WeatherConfig | null;
  moon: MoonConfig;
  period: PeriodConfig;
  overlays: OverlayConfig[];
  view: View;
  upcoming: UpcomingConfig;
  agenda: AgendaConfig;
  theme: ThemeName;
  style: Partial<Record<Token, string>>;
  font_url: string | null;
}

export const ENTITY_PALETTE = ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#BA7517'];

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const ENTITY_ID = /^calendar\.[a-z0-9_]+$/;
const WEATHER_ID = /^weather\.[a-z0-9_]+$/;
const ICON = /^[a-z0-9-]+:[a-z0-9-]+$/;
// Each label calendar gets its own header line; more than two would crowd out the events.
const MAX_LABEL_CALENDARS = 2;
const FONT_URL = /^(https:\/\/|\/(?!\/))/;
// A path inside Home Assistant, or a #hash that opens a pop-up. A full or protocol-relative URL would send
// the tap to another site, and browsers read a leading /\ as //.
const NAV_PATH = /^(?:\/(?![/\\])|#[\w-]+$)/;
// Plain lengths and calc() sums of them: the value becomes an inline height, so nothing else may get in.
const LENGTH = '\\d+(?:\\.\\d+)?(?:px|%|vh|dvh|svh|lvh|em|rem)';
const HEIGHT = new RegExp(`^(?:${LENGTH}|calc\\(\\s*${LENGTH}(?:\\s*[-+]\\s*${LENGTH})*\\s*\\))$`);
export const PERCENT = /^\d+(\.\d+)?%$/;

type Raw = Record<string, unknown>;

export function normalizeConfig(input: unknown): WallCalConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('WallCal configuration must be a mapping');
  }
  const raw = input as Raw;
  const header = section(raw.header, 'header');
  const moon = section(raw.moon, 'moon');
  const period = section(raw.period, 'period');
  const upcoming = section(raw.upcoming, 'upcoming');
  const agenda = section(raw.agenda, 'agenda');

  const periodEnabled = bool(period.enabled, false, 'period.enabled');
  const lastPeriod = toLocalDate(period.last_period, 'period.last_period');
  if (periodEnabled && !lastPeriod) {
    throw new Error('period.last_period is required when period.enabled is true (format YYYY-MM-DD)');
  }

  const { style, fontUrl } = parseStyle(section(raw.style, 'style'));
  const days = choice(raw.days, [5, 7] as const, 7, 'days');

  return {
    entities: parseEntities(raw.entities),
    days,
    first_day: WEEKDAYS.indexOf(oneOf(raw.first_day, WEEKDAYS, 'monday', 'first_day')) as Weekday,
    time_format: oneOf(raw.time_format, TIME_FORMATS, 'auto', 'time_format'),
    weekday_format: oneOf(raw.weekday_format, WEEKDAY_FORMATS, 'short', 'weekday_format'),
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
    overlays: parseOverlays(raw.overlays, days),
    view: oneOf(raw.view, VIEWS, 'week', 'view'),
    upcoming: {
      count: int(upcoming.count, 3, 1, 5, 'upcoming.count'),
      navigation_path: navigationPath(upcoming.navigation_path),
    },
    agenda: {
      style: oneOf(agenda.style, AGENDA_STYLES, 'list', 'agenda.style'),
      height: agendaHeight(agenda.height),
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
  const entities = value.map((item, i) => {
    const obj: Raw = typeof item === 'string' ? { entity: item } : section(item, `entities[${i}]`);
    const entity = String(obj.entity ?? '');
    if (!ENTITY_ID.test(entity)) {
      throw new Error(`entities[${i}]: "${entity}" is not a calendar entity id (expected calendar.something)`);
    }
    const color = obj.color === undefined ? ENTITY_PALETTE[i % ENTITY_PALETTE.length] : String(obj.color);
    const result: EntityConfig = {
      entity,
      color,
      toggle: bool(obj.toggle, false, `entities[${i}].toggle`),
      display: oneOf(obj.display, ENTITY_DISPLAYS, 'chip', `entities[${i}].display`),
    };
    if (obj.name !== undefined) result.name = String(obj.name);
    if (obj.strip_prefix !== undefined) result.strip_prefix = String(obj.strip_prefix);
    if (obj.suffix !== undefined) result.suffix = String(obj.suffix);
    if (obj.icon !== undefined) result.icon = icon(obj.icon, `entities[${i}].icon`);
    return result;
  });
  if (entities.filter((e) => e.display === 'label').length > MAX_LABEL_CALENDARS) {
    throw new Error(`at most ${MAX_LABEL_CALENDARS} entities can use display: label`);
  }
  return entities;
}

function parseWeather(raw: Raw): WeatherConfig {
  const entity = String(raw.entity ?? '');
  if (!WEATHER_ID.test(entity)) {
    throw new Error(`weather.entity: "${entity}" is not a weather entity id (expected weather.something)`);
  }
  return { entity, show_low: bool(raw.show_low, true, 'weather.show_low') };
}

function parseOverlays(value: unknown, days: number): OverlayConfig[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('overlays must be a list');
  const used = new Set<OverlayPosition>();
  return value.map((item, i) => {
    const path = `overlays[${i}]`;
    const obj = section(item, path);
    if (obj.position === undefined || obj.position === null) {
      throw new Error(`${path}.position is required (${OVERLAY_POSITIONS.join(', ')})`);
    }
    const position = oneOf(obj.position, OVERLAY_POSITIONS, 'bottom-right', `${path}.position`);
    if (used.has(position)) throw new Error(`${path}.position: only one overlay can use ${position}`);
    used.add(position);

    const card = section(obj.card, `${path}.card`);
    if (typeof card.type !== 'string' || !card.type) {
      throw new Error(`${path}.card needs a type, for example type: todo-list`);
    }
    const result: OverlayConfig = {
      key: overlayKey({ position, card }),
      position,
      span: int(obj.span, 2, 1, days, `${path}.span`),
      width: percent(obj.width, 90, `${path}.width`) / 100,
      max_height: maxHeight(obj.max_height, `${path}.max_height`),
      offset: int(obj.offset, 8, 0, 400, `${path}.offset`),
      toggle: overlayToggle(obj.toggle, `${path}.toggle`),
      pill: oneOf(obj.pill, PILL_STYLES, 'full', `${path}.pill`),
      visible: bool(obj.visible, false, `${path}.visible`),
      icon: obj.icon === undefined ? 'mdi:card-outline' : icon(obj.icon, `${path}.icon`),
      card,
    };
    if (obj.name !== undefined) result.name = String(obj.name);
    return result;
  });
}

function overlayToggle(value: unknown, path: string): OverlayToggle {
  if (value === true) return 'header';
  if (value === false) return 'none';
  return oneOf(value, OVERLAY_TOGGLES, 'header', path);
}

function percent(value: unknown, fallback: number, path: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim();
  const n = PERCENT.test(text) ? parseFloat(text) : NaN;
  if (!(n >= 10 && n <= 100)) throw new Error(`${path} must be a percentage from 10% to 100%`);
  return n;
}

function maxHeight(value: unknown, path: string): string {
  if (value === undefined || value === null || value === '') return '40%';
  const text = String(value).trim();
  if (text.endsWith('%')) return `${percent(text, 40, path)}%`;
  return `${int(text.replace(/px$/, ''), 0, 1, 2000, `${path} (pixels)`)}px`;
}

function navigationPath(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const path = String(value).trim();
  if (!NAV_PATH.test(path)) {
    throw new Error('upcoming.navigation_path must start with / (a path in Home Assistant) or be #name (a pop-up)');
  }
  return path;
}

function agendaHeight(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const height = String(value).trim();
  if (!HEIGHT.test(height)) throw new Error('agenda.height must be a length like 75vh, 600px or calc(100vh - 120px)');
  return height;
}

function icon(value: unknown, path: string): string {
  const text = String(value);
  if (!ICON.test(text)) throw new Error(`${path} must look like mdi:flag`);
  return text;
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
