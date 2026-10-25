import { CYCLE_LENGTH, PERIOD_LENGTH, type LengthRange, type PeriodConfig } from '../config';
import { parseLocalDate, startOfDay } from '../date';
import type { HassEntity } from '../ha-types';
import type { CycleInput } from './predict';

type States = Record<string, HassEntity>;

// A timestamp sensor reports UTC, so near midnight its first ten characters are a different day than here.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** No cycle at all when any referenced entity is missing or unusable: a wrong prediction is worse than none. */
export function cycleInputFrom(period: PeriodConfig, states: States): CycleInput | null {
  if (!period.enabled || period.last_period === null) return null;
  const start = typeof period.last_period === 'string' ? dateFrom(states[period.last_period]?.state) : period.last_period;
  const cycleLength = lengthFrom(period.cycle_length, states, CYCLE_LENGTH);
  const periodLength = lengthFrom(period.period_length, states, PERIOD_LENGTH);
  if (!start || cycleLength === null || periodLength === null) return null;
  return { starts: [start], cycleLength, periodLength };
}

export function periodEntities(period: PeriodConfig): string[] {
  if (!period.enabled) return [];
  return [period.last_period, period.cycle_length, period.period_length].filter((v): v is string => typeof v === 'string');
}

function dateFrom(state: string | undefined): Date | null {
  if (!state) return null;
  const day = parseLocalDate(state.slice(0, 10));
  if (!day || !TIMESTAMP.test(state)) return day;
  const instant = new Date(state);
  return Number.isNaN(instant.getTime()) ? null : startOfDay(instant);
}

function lengthFrom(value: number | string, states: States, range: LengthRange): number | null {
  if (typeof value === 'number') return value;
  const state = states[value]?.state?.trim();
  const n = state ? Number(state) : NaN;
  return Number.isFinite(n) ? Math.min(range.max, Math.max(range.min, Math.round(n))) : null;
}
