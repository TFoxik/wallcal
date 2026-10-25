import { describe, expect, it } from 'vitest';
import { normalizeConfig, type PeriodConfig } from '../src/config';
import { cycleInputFrom, periodEntities } from '../src/cycle/source';
import type { HassEntity } from '../src/ha-types';

const period = (values: Record<string, unknown>): PeriodConfig =>
  normalizeConfig({ entities: ['calendar.family'], period: { enabled: true, ...values } }).period;

const states = (values: Record<string, string>): Record<string, HassEntity> =>
  Object.fromEntries(Object.entries(values).map(([id, state]) => [id, { state, last_changed: '2026-10-13T08:00:00Z' }]));

const ymd = (d: Date | undefined) => d && [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()];
const startFrom = (state: string) =>
  ymd(cycleInputFrom(period({ last_period: 'input_datetime.start' }), states({ 'input_datetime.start': state }))?.starts[0]);

describe('cycleInputFrom', () => {
  it('passes literal values through', () => {
    const input = cycleInputFrom(period({ last_period: '2026-10-02' }), {});
    expect(ymd(input?.starts[0])).toEqual([2026, 10, 2, 0]);
    expect(input).toMatchObject({ cycleLength: 28, periodLength: 5 });
  });

  it('reads a date helper, with or without a time', () => {
    expect(startFrom('2026-10-02')).toEqual([2026, 10, 2, 0]);
    expect(startFrom('2026-10-02 08:00:00')).toEqual([2026, 10, 2, 0]);
  });

  it('reads a timestamp sensor as its local date', () => {
    expect(startFrom('2026-10-24T22:30:00+00:00')).toEqual([2026, 10, 25, 0]);
    expect(startFrom('2026-10-24T10:00:00+00:00')).toEqual([2026, 10, 24, 0]);
    expect(startFrom('2026-10-24T22:30:00Z')).toEqual([2026, 10, 25, 0]);
  });

  it('rounds and clamps lengths from helpers', () => {
    const lengths = (cycle: string, days: string) =>
      cycleInputFrom(
        period({ last_period: '2026-10-02', cycle_length: 'input_number.cycle', period_length: 'input_number.days' }),
        states({ 'input_number.cycle': cycle, 'input_number.days': days }),
      );
    expect(lengths('28.0', '5.0')).toMatchObject({ cycleLength: 28, periodLength: 5 });
    expect(lengths('30.4', '4.6')).toMatchObject({ cycleLength: 30, periodLength: 5 });
    expect(lengths('60', '12')).toMatchObject({ cycleLength: 45, periodLength: 10 });
    expect(lengths('3', '0')).toMatchObject({ cycleLength: 20, periodLength: 1 });
  });

  it('gives no cycle for a missing or unusable date', () => {
    expect(cycleInputFrom(period({ last_period: 'input_datetime.start' }), {})).toBeNull();
    for (const state of ['unknown', 'unavailable', '', 'soon', '2026-13-40', '2026-02-30T10:00:00+00:00']) {
      expect(startFrom(state), state).toBeUndefined();
    }
  });

  it('gives no cycle for a missing or unusable length', () => {
    const withCycle = (values: Record<string, string>) =>
      cycleInputFrom(period({ last_period: '2026-10-02', cycle_length: 'input_number.cycle' }), states(values));
    expect(withCycle({})).toBeNull();
    for (const state of ['unknown', 'unavailable', '', 'abc', 'Infinity']) {
      expect(withCycle({ 'input_number.cycle': state }), state).toBeNull();
    }
  });

  it('gives no cycle while tracking is off', () => {
    const off = { ...period({ last_period: 'input_datetime.start' }), enabled: false };
    expect(cycleInputFrom(off, states({ 'input_datetime.start': '2026-10-02' }))).toBeNull();
    expect(periodEntities(off)).toEqual([]);
  });
});

describe('periodEntities', () => {
  it('lists the referenced entities in key order', () => {
    expect(periodEntities(period({ last_period: 'input_datetime.x', cycle_length: 'input_number.y', period_length: 6 }))).toEqual([
      'input_datetime.x',
      'input_number.y',
    ]);
    expect(periodEntities(period({ last_period: '2026-10-02' }))).toEqual([]);
  });
});
