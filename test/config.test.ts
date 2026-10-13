import { describe, expect, it } from 'vitest';
import { ENTITY_PALETTE, normalizeConfig } from '../src/config';

const minimal = { entities: ['calendar.family'] };

describe('normalizeConfig', () => {
  it('fills every default', () => {
    expect(normalizeConfig(minimal)).toEqual({
      entities: [{ entity: 'calendar.family', color: ENTITY_PALETTE[0] }],
      days: 7,
      first_day: 1,
      time_format: 'auto',
      show_end_time: false,
      past_days: 'normal',
      refresh_interval: 300,
      header: { show: true, title: 'month', subtitle: 'none', align: 'left', navigation: true, idle_return: 60 },
      moon: { enabled: false, show_name: false, hemisphere: 'north' },
      period: {
        enabled: false,
        last_period: null,
        cycle_length: 28,
        period_length: 5,
        show_fertile: true,
        show_ovulation: true,
      },
      theme: 'default',
      style: {},
      font_url: null,
    });
  });

  it('accepts shorthand and object entities, assigning palette colours by position', () => {
    const c = normalizeConfig({ entities: [{ entity: 'calendar.a', color: '#000', name: 'A' }, 'calendar.b'] });
    expect(c.entities).toEqual([
      { entity: 'calendar.a', color: '#000', name: 'A' },
      { entity: 'calendar.b', color: ENTITY_PALETTE[1] },
    ]);
  });

  it('reads header.title keywords case-insensitively and keeps any other text verbatim', () => {
    const title = (value: unknown) => normalizeConfig({ ...minimal, header: { title: value } }).header.title;
    expect(title('Range')).toBe('range');
    expect(title('NONE')).toBe('none');
    expect(title('Family calendar')).toEqual({ text: 'Family calendar' });
    expect(title(2026)).toEqual({ text: '2026' });
    expect(title('')).toBe('none');
  });

  it('reads header.subtitle like the title, defaulting to none', () => {
    const subtitle = (value: unknown) => normalizeConfig({ ...minimal, header: { subtitle: value } }).header.subtitle;
    expect(subtitle(undefined)).toBe('none');
    expect(subtitle('Range')).toBe('range');
    expect(subtitle('Kitchen')).toEqual({ text: 'Kitchen' });
  });

  it('validates past_days and show_end_time', () => {
    expect(normalizeConfig({ ...minimal, past_days: 'grey', show_end_time: true })).toMatchObject({
      past_days: 'grey',
      show_end_time: true,
    });
    expect(() => normalizeConfig({ ...minimal, past_days: 'hide' })).toThrow(/past_days/);
  });

  it('rejects a non-mapping config', () => {
    expect(() => normalizeConfig(null)).toThrow(/mapping/);
  });

  it('requires at least one entity', () => {
    expect(() => normalizeConfig({ entities: [] })).toThrow(/at least one calendar/);
  });

  it('rejects ids that are not calendar entities', () => {
    expect(() => normalizeConfig({ entities: ['sensor.x'] })).toThrow(/not a calendar entity id/);
    expect(() => normalizeConfig({ entities: ['calendar.x/../y'] })).toThrow(/not a calendar entity id/);
  });

  it('only allows 5 or 7 days', () => {
    expect(() => normalizeConfig({ ...minimal, days: 6 })).toThrow(/5 or 7/);
    expect(normalizeConfig({ ...minimal, days: 5 }).days).toBe(5);
  });

  it('parses first_day case-insensitively', () => {
    expect(normalizeConfig({ ...minimal, first_day: 'Sunday' }).first_day).toBe(0);
    expect(() => normalizeConfig({ ...minimal, first_day: 'funday' })).toThrow(/first_day/);
  });

  it('accepts numeric time_format', () => {
    expect(normalizeConfig({ ...minimal, time_format: 12 }).time_format).toBe('12');
  });

  it('requires last_period when period is enabled', () => {
    expect(() => normalizeConfig({ ...minimal, period: { enabled: true } })).toThrow(/last_period is required/);
  });

  it('reads last_period from a YYYY-MM-DD string as a local date', () => {
    const d = normalizeConfig({ ...minimal, period: { enabled: true, last_period: '2026-10-02' } }).period.last_period;
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 2, 0]);
  });

  it('reads last_period from a Date at UTC midnight (YAML timestamp) as that calendar date', () => {
    const d = normalizeConfig({ ...minimal, period: { enabled: true, last_period: new Date(Date.UTC(2026, 9, 2)) } })
      .period.last_period;
    expect(d && [d.getMonth(), d.getDate(), d.getHours()]).toEqual([9, 2, 0]);
  });

  it('reads last_period from an ISO datetime string', () => {
    const d = normalizeConfig({ ...minimal, period: { enabled: true, last_period: '2026-10-02T00:00:00.000Z' } })
      .period.last_period;
    expect(d && [d.getMonth(), d.getDate()]).toEqual([9, 2]);
  });

  it('rejects malformed last_period', () => {
    expect(() => normalizeConfig({ ...minimal, period: { enabled: true, last_period: '02.10.2026' } })).toThrow(
      /last_period must be a date/,
    );
  });

  it('bounds cycle and period length', () => {
    expect(() => normalizeConfig({ ...minimal, period: { cycle_length: 50 } })).toThrow(/cycle_length/);
    expect(() => normalizeConfig({ ...minimal, period: { period_length: 0 } })).toThrow(/period_length/);
  });

  it('rejects non-boolean flags', () => {
    expect(() => normalizeConfig({ ...minimal, moon: { enabled: 'yes' } })).toThrow(/moon.enabled must be true or false/);
  });

  it('turns numeric style values into px and rejects unknown style keys', () => {
    expect(normalizeConfig({ ...minimal, style: { date_size: 40, accent: '#D4537E' } }).style).toEqual({
      date_size: '40px',
      accent: '#D4537E',
    });
    expect(() => normalizeConfig({ ...minimal, style: { colour: 'red' } })).toThrow(/style.colour is not a known/);
  });

  it('only accepts https or same-origin font_url', () => {
    expect(normalizeConfig({ ...minimal, style: { font_url: 'https://fonts.googleapis.com/css2?family=Inter' } }).font_url)
      .toBe('https://fonts.googleapis.com/css2?family=Inter');
    expect(normalizeConfig({ ...minimal, style: { font_url: '/local/fonts.css' } }).font_url).toBe('/local/fonts.css');
    expect(() => normalizeConfig({ ...minimal, style: { font_url: 'http://x' } })).toThrow(/font_url/);
    expect(() => normalizeConfig({ ...minimal, style: { font_url: '//x' } })).toThrow(/font_url/);
  });

  it('rejects unknown themes', () => {
    expect(() => normalizeConfig({ ...minimal, theme: 'neon' })).toThrow(/theme must be one of/);
  });
});
