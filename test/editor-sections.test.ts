import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../src/config';
import { applyFormChange } from '../src/editor/raw-config';
import {
  COLOR_TOKENS,
  fieldNames,
  formData,
  HEADER,
  MOON,
  PERIOD,
  SIZE_TOKENS,
  STYLE,
  TEXT_TOKENS,
  THEME,
  WEATHER,
  WEEK,
  type SectionDef,
} from '../src/editor/sections';
import { TOKENS } from '../src/theme/presets';

const ctx = { days: 7, taken: [] };
const base = { type: 'custom:wallcal-card', entities: ['calendar.family'] };

function edit(section: SectionDef, root: Record<string, unknown>, change: Record<string, unknown>) {
  const before = formData(section, root);
  const next = applyFormChange(root, section.prefix, before, { ...before, ...change }, section.rules);
  return section.finalize ? section.finalize(next) : next;
}

describe('section defaults match the card', () => {
  it('uses the same defaults as normalizeConfig', () => {
    const n = normalizeConfig(base);
    expect(WEEK.rules.defaults).toMatchObject({
      days: n.days,
      time_format: n.time_format,
      weekday_format: n.weekday_format,
      show_end_time: n.show_end_time,
      past_days: n.past_days,
      past_events: n.past_events,
      auto_scroll: n.auto_scroll,
      refresh_interval: n.refresh_interval,
    });
    expect(HEADER.rules.defaults).toMatchObject({
      show: n.header.show,
      title: n.header.title,
      subtitle: n.header.subtitle,
      align: n.header.align,
      navigation: n.header.navigation,
      idle_return: n.header.idle_return,
    });
    expect(MOON.rules.defaults).toEqual(n.moon);
    expect(PERIOD.rules.defaults).toMatchObject({ enabled: false, cycle_length: 28, period_length: 5, show_fertile: true, show_ovulation: true });
  });

  it('covers every style token exactly once', () => {
    expect([...COLOR_TOKENS, ...SIZE_TOKENS, ...TEXT_TOKENS].sort()).toEqual([...TOKENS].sort());
    expect(Object.keys(STYLE.rules.defaults).sort()).toEqual([...TOKENS, 'font_url'].sort());
  });
});

describe('formData', () => {
  it('shows defaults and only governed keys', () => {
    expect(formData(MOON, { ...base, moon: { enabled: true, extra: 1 } })).toEqual({ enabled: true, show_name: false, hemisphere: 'north' });
  });

  it('turns a YAML date into a date-picker string', () => {
    const root = { ...base, period: { enabled: true, last_period: new Date(Date.UTC(2026, 9, 2)) } };
    expect(formData(PERIOD, root).last_period).toBe('2026-10-02');
  });
});

describe('conditional fields', () => {
  it('hides first_day with 5 days', () => {
    expect(fieldNames(WEEK.schema(formData(WEEK, { days: 5 }), ctx))).not.toContain('first_day');
    expect(fieldNames(WEEK.schema(formData(WEEK, {}), ctx))).toContain('first_day');
  });

  it('shows moon, cycle, weather and header options only when they apply', () => {
    expect(fieldNames(MOON.schema(formData(MOON, {}), ctx))).toEqual(['enabled']);
    expect(fieldNames(MOON.schema(formData(MOON, { moon: { enabled: true } }), ctx))).toEqual(['enabled', 'show_name', 'hemisphere']);
    expect(fieldNames(PERIOD.schema(formData(PERIOD, {}), ctx))).toEqual(['enabled', 'last_period']);
    expect(fieldNames(WEATHER.schema(formData(WEATHER, {}), ctx))).toEqual(['entity']);
    expect(fieldNames(HEADER.schema(formData(HEADER, { header: { show: false } }), ctx))).toEqual(['show']);
  });
});

describe('cycle date with tracking off', () => {
  const root = { ...base, period: { last_period: '2026-10-02' } };
  const fields = (r: Record<string, unknown>) => PERIOD.schema(formData(PERIOD, r), ctx).flatMap((s) => ('schema' in s ? s.schema : [s]));

  it('keeps the date field, optional, so it can be cleared', () => {
    expect(fieldNames(PERIOD.schema(formData(PERIOD, root), ctx))).toEqual(['enabled', 'last_period']);
    expect(fields(root).find((f) => f.name === 'last_period')!.required).toBeFalsy();
  });

  it('requires the date once tracking is on', () => {
    const on = { ...base, period: { enabled: true, last_period: '2026-10-02' } };
    expect(fields(on).find((f) => f.name === 'last_period')!.required).toBe(true);
  });

  it('removes the period block when the date is cleared', () => {
    expect(edit(PERIOD, root, { last_period: undefined })).toEqual(base);
  });
});

describe('case-insensitive enums', () => {
  it('shows hand-written mixed-case values in lower case', () => {
    expect(formData(HEADER, { header: { align: 'Center' } }).align).toBe('center');
    expect(formData(HEADER, { header: { title: 'Our Week' } }).title).toBe('Our Week');
    expect(formData(MOON, { moon: { hemisphere: 'South' } }).hemisphere).toBe('south');
    expect(formData(WEEK, { weekday_format: 'Long', past_days: 'Dim', past_events: 'Hide' })).toMatchObject({
      weekday_format: 'long', past_days: 'dim', past_events: 'hide',
    });
    expect(formData(THEME, { theme: 'Paper' }).theme).toBe('paper');
  });

  it('leaves a mixed-case value as written when another field is edited', () => {
    const root = { ...base, header: { align: 'Center' } };
    expect(edit(HEADER, root, { navigation: false })).toEqual({ ...base, header: { align: 'Center', navigation: false } });
  });
});

describe('edits', () => {
  it('writes numbers for days and time_format', () => {
    expect(edit(WEEK, base, { days: '5', time_format: '24' })).toEqual({ ...base, days: 5, time_format: 24 });
  });

  it('removes the weather block when the entity is cleared', () => {
    expect(edit(WEATHER, { ...base, weather: { entity: 'weather.home', show_low: false } }, { entity: undefined })).toEqual(base);
  });

  it('keeps hand-written values in fields that were not edited', () => {
    const root = { ...base, style: { accent: 'rgba(1, 2, 3, 0.5)', date_size: '2rem', text: '#112233' } };
    const before = formData(STYLE, root);
    expect(before.text).toEqual([17, 34, 51]);
    expect(before.accent).toBe('rgba(1, 2, 3, 0.5)');
    expect(edit(STYLE, root, { text: [255, 0, 0] })).toEqual({ ...base, style: { accent: 'rgba(1, 2, 3, 0.5)', date_size: '2rem', text: '#FF0000' } });
  });

  it('offers a picker for hex or unset colours and text otherwise', () => {
    const schema = STYLE.schema(formData(STYLE, { style: { accent: 'var(--x)', date_size: '2rem' } }), ctx);
    const field = (name: string) => schema.flatMap((s) => ('schema' in s ? s.schema : [s])).find((f) => f.name === name)!;
    expect(field('background').selector).toHaveProperty('color_rgb');
    expect(field('accent').selector).toHaveProperty('text');
    expect(field('gap').selector).toHaveProperty('number');
    expect(field('date_size').selector).toHaveProperty('text');
  });

  it('keeps a hand-written day count in another form when another field changes', () => {
    expect(edit(WEEK, { ...base, days: '5' }, { show_end_time: true })).toEqual({ ...base, days: '5', show_end_time: true });
  });
});
