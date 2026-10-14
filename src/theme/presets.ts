export const THEME_NAMES = ['default', 'paper', 'midnight'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const TOKENS = [
  'background',
  'surface',
  'text',
  'muted',
  'accent',
  'today_background',
  'divider',
  'radius',
  'day_radius',
  'chip_radius',
  'gap',
  'padding',
  'font_family',
  'title_font',
  'title_size',
  'date_size',
  'weekday_size',
  'event_size',
  'allday_size',
  'time_size',
  'period_color',
  'fertile_color',
  'ovulation_color',
  'ring_color',
  'moon_color',
] as const;
export type Token = (typeof TOKENS)[number];

export const DEFAULT_TOKENS: Record<Token, string> = {
  background: 'var(--ha-card-background, var(--card-background-color, #fff))',
  surface: 'rgba(127, 127, 127, 0.1)',
  text: 'var(--primary-text-color, #212121)',
  muted: 'var(--secondary-text-color, #727272)',
  accent: 'var(--primary-color, #03a9f4)',
  today_background: 'var(--wallcal-accent)',
  divider: 'var(--divider-color, rgba(0, 0, 0, 0.12))',
  radius: 'var(--ha-card-border-radius, 16px)',
  day_radius: 'var(--wallcal-radius)',
  chip_radius: '10px',
  gap: '4px',
  padding: '8px',
  font_family: 'inherit',
  title_font: 'var(--wallcal-font-family)',
  title_size: '28px',
  date_size: '32px',
  weekday_size: '15px',
  event_size: '15px',
  allday_size: 'calc(var(--wallcal-event-size) - 2px)',
  time_size: '13px',
  period_color: '#E24B4A',
  fertile_color: '#5DCAA5',
  ovulation_color: '#1D9E75',
  ring_color: '#D4537E',
  moon_color: 'var(--wallcal-muted)',
};

export const PRESETS: Record<ThemeName, Partial<Record<Token, string>>> = {
  default: {},
  paper: {
    background: '#F7F3EC',
    surface: '#EEE8DD',
    text: '#2C2C2A',
    muted: '#7A756C',
    accent: '#B4543A',
    divider: '#DDD5C6',
    title_font: "Georgia, 'Times New Roman', serif",
  },
  midnight: {
    background: '#0B0B0D',
    surface: '#16161A',
    text: '#C9C7C0',
    muted: '#6E6C66',
    accent: '#8E87E0',
    divider: '#2A2A30',
    period_color: '#B5413F',
    fertile_color: '#1D9E75',
    ovulation_color: '#1A7F60',
    ring_color: '#A8506E',
  },
};

export function cssVar(token: Token): string {
  return `--wallcal-${token.replace(/_/g, '-')}`;
}

export function resolveTokens(theme: ThemeName, overrides: Partial<Record<Token, string>>): Record<string, string> {
  const merged = { ...DEFAULT_TOKENS, ...PRESETS[theme], ...overrides };
  return Object.fromEntries(TOKENS.map((token) => [cssVar(token), merged[token]]));
}
