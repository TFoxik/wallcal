import { daysBetween } from '../date';

export interface CycleInput {
  starts: Date[];
  cycleLength: number;
  periodLength: number;
}

export interface CycleDay {
  day: number;
  length: number;
  isPeriod: boolean;
  isFertile: boolean;
  isOvulation: boolean;
}

const LUTEAL_LENGTH = 14;
const FERTILE_DAYS_BEFORE_OVULATION = 5;

export function cycleInfo(date: Date, input: CycleInput): CycleDay | null {
  let anchor: Date | null = null;
  for (const start of input.starts) {
    if (daysBetween(start, date) >= 0 && (!anchor || start.getTime() > anchor.getTime())) anchor = start;
  }
  if (!anchor) return null;

  const day = (daysBetween(anchor, date) % input.cycleLength) + 1;
  const ovulationDay = input.cycleLength - LUTEAL_LENGTH;
  return {
    day,
    length: input.cycleLength,
    isPeriod: day <= input.periodLength,
    isOvulation: day === ovulationDay,
    isFertile: day >= ovulationDay - FERTILE_DAYS_BEFORE_OVULATION && day <= ovulationDay,
  };
}
