import { describe, expect, it } from 'vitest';
import { ENTITY_PALETTE, normalizeConfig } from '../src/config';

const minimal = { entities: ['calendar.family'] };

describe('normalizeConfig', () => {
  it('fills every default', () => {
    expect(normalizeConfig(minimal)).toEqual({
      entities: [{ entity: 'calendar.family', color: ENTITY_PALETTE[0], toggle: false, display: 'chip' }],
      days: 7,
      first_day: 1,
      time_format: 'auto',
      weekday_format: 'short',
      show_end_time: false,
      past_days: 'normal',
      past_events: 'show',
      auto_scroll: true,
      refresh_interval: 300,
      header: { show: true, title: 'month', subtitle: 'none', align: 'left', navigation: true, idle_return: 60 },
      weather: null,
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
      overlays: [],
    });
  });

  it('accepts shorthand and object entities, assigning palette colours by position', () => {
    const c = normalizeConfig({ entities: [{ entity: 'calendar.a', color: '#000', name: 'A' }, 'calendar.b'] });
    expect(c.entities).toEqual([
      { entity: 'calendar.a', color: '#000', name: 'A', toggle: false, display: 'chip' },
      { entity: 'calendar.b', color: ENTITY_PALETTE[1], toggle: false, display: 'chip' },
    ]);
  });

  it('reads toggle and icon on entities', () => {
    const c = normalizeConfig({ entities: [{ entity: 'calendar.a', toggle: true, icon: 'mdi:flag' }] });
    expect(c.entities[0]).toMatchObject({ toggle: true, icon: 'mdi:flag' });
    expect(() => normalizeConfig({ entities: [{ entity: 'calendar.a', icon: 'flag' }] })).toThrow(/icon/);
    expect(() => normalizeConfig({ entities: [{ entity: 'calendar.a', toggle: 'yes' }] })).toThrow(/toggle/);
  });

  it('reads display and strip_prefix on entities', () => {
    const c = normalizeConfig({ entities: [{ entity: 'calendar.a', display: 'Label', strip_prefix: 'Svátek: ', suffix: 'SK' }] });
    expect(c.entities[0]).toMatchObject({ display: 'label', strip_prefix: 'Svátek: ', suffix: 'SK' });
    expect(() => normalizeConfig({ entities: [{ entity: 'calendar.a', display: 'banner' }] })).toThrow(/display/);
    const label = (entity: string) => ({ entity, display: 'label' });
    expect(normalizeConfig({ entities: [label('calendar.a'), label('calendar.b')] }).entities).toHaveLength(2);
    expect(() => normalizeConfig({ entities: [label('calendar.a'), label('calendar.b'), label('calendar.c')] })).toThrow(
      /at most 2/,
    );
  });

  it('validates weekday_format', () => {
    expect(normalizeConfig({ ...minimal, weekday_format: 'long' }).weekday_format).toBe('long');
    expect(() => normalizeConfig({ ...minimal, weekday_format: 'narrow' })).toThrow(/weekday_format/);
  });

  it('validates past_events and auto_scroll', () => {
    expect(normalizeConfig({ ...minimal, past_events: 'Hide', auto_scroll: false })).toMatchObject({
      past_events: 'hide',
      auto_scroll: false,
    });
    expect(() => normalizeConfig({ ...minimal, past_events: 'grey' })).toThrow(/past_events/);
  });

  it('reads the weather section and requires a weather entity', () => {
    expect(normalizeConfig({ ...minimal, weather: { entity: 'weather.home' } }).weather).toEqual({
      entity: 'weather.home',
      show_low: true,
    });
    expect(() => normalizeConfig({ ...minimal, weather: { entity: 'sensor.temp' } })).toThrow(/weather entity/);
    expect(() => normalizeConfig({ ...minimal, weather: 'weather.home' })).toThrow(/weather must be a mapping/);
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

  describe('overlays', () => {
    const todo = { type: 'todo-list', entity: 'todo.shopping' };
    const overlay = (extra: Record<string, unknown> = {}) => ({ position: 'bottom-right', card: todo, ...extra });
    const parse = (...overlays: unknown[]) => normalizeConfig({ ...minimal, overlays }).overlays;

    it('fills overlay defaults', () => {
      expect(parse(overlay())).toEqual([
        {
          key: expect.stringMatching(/^bottom-right:/),
          position: 'bottom-right',
          span: 2,
          width: 0.9,
          max_height: '40%',
          offset: 8,
          toggle: 'header',
          pill: 'full',
          visible: false,
          icon: 'mdi:card-outline',
          card: todo,
        },
      ]);
    });

    it('reads sizes, name and toggle options', () => {
      const [o] = parse(
        overlay({ span: 1, width: '60%', max_height: 320, offset: 72, toggle: false, visible: true, name: 'Shop', icon: 'mdi:cart' }),
      );
      expect(o).toMatchObject({ span: 1, width: 0.6, max_height: '320px', offset: 72, toggle: 'none', visible: true, name: 'Shop', icon: 'mdi:cart' });
      expect(parse(overlay({ max_height: '25%' }))[0].max_height).toBe('25%');
      expect(parse(overlay({ max_height: '300px' }))[0].max_height).toBe('300px');
    });

    it('reads toggle as header, pill or none, with true and false as header and none', () => {
      expect(parse(overlay({ toggle: 'pill' }))[0].toggle).toBe('pill');
      expect(parse(overlay({ toggle: 'Header' }))[0].toggle).toBe('header');
      expect(parse(overlay({ toggle: 'none' }))[0].toggle).toBe('none');
      expect(parse(overlay({ toggle: true }))[0].toggle).toBe('header');
      expect(parse(overlay({ toggle: false }))[0].toggle).toBe('none');
      expect(() => parse(overlay({ toggle: 'banner' }))).toThrow(/overlays\[0\]\.toggle must be one of: header, pill, none/);
    });

    it('reads the pill style, full by default', () => {
      expect(parse(overlay({ toggle: 'pill', pill: 'compact' }))[0].pill).toBe('compact');
      expect(parse(overlay({ toggle: 'pill' }))[0].pill).toBe('full');
      expect(() => parse(overlay({ pill: 'tiny' }))).toThrow(/overlays\[0\]\.pill must be one of: full, compact/);
    });

    it('allows one overlay per position', () => {
      expect(parse(overlay(), overlay({ position: 'bottom-left' }))).toHaveLength(2);
      expect(() => parse(overlay(), overlay())).toThrow(/only one overlay can use bottom-right/);
    });

    it('rejects invalid overlays', () => {
      expect(() => normalizeConfig({ ...minimal, overlays: {} })).toThrow(/overlays must be a list/);
      expect(() => parse({ card: todo })).toThrow(/overlays\[0\]\.position is required/);
      expect(() => parse(overlay({ position: 'top-left' }))).toThrow(/position must be one of/);
      expect(() => parse(overlay({ span: 8 }))).toThrow(/span/);
      expect(() => parse(overlay({ span: 0 }))).toThrow(/span/);
      expect(() => parse(overlay({ width: 0.8 }))).toThrow(/width/);
      expect(() => parse(overlay({ width: '5%' }))).toThrow(/width/);
      expect(() => parse(overlay({ max_height: '120%' }))).toThrow(/max_height/);
      expect(() => parse(overlay({ max_height: 'tall' }))).toThrow(/max_height/);
      expect(() => parse(overlay({ offset: 500 }))).toThrow(/offset/);
      expect(() => parse({ position: 'bottom-left' })).toThrow(/card/);
      expect(() => parse({ position: 'bottom-left', card: { entity: 'todo.shopping' } })).toThrow(/card needs a type/);
      expect(() => parse(overlay({ icon: 'list' }))).toThrow(/icon/);
      expect(() => parse(overlay({ visible: 'yes' }))).toThrow(/visible/);
    });

    it('limits span to the number of days', () => {
      expect(() => normalizeConfig({ ...minimal, days: 5, overlays: [overlay({ span: 6 })] })).toThrow(
        /overlays\[0\]\.span must be a whole number from 1 to 5/,
      );
    });
  });
});
