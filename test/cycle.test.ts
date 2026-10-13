import { describe, expect, it } from 'vitest';
import { cycleInfo, type CycleInput } from '../src/cycle/predict';

const input: CycleInput = { starts: [new Date(2026, 9, 2)], cycleLength: 28, periodLength: 5 };
const on = (m: number, d: number, i: CycleInput = input) => cycleInfo(new Date(2026, m - 1, d), i);

describe('cycleInfo', () => {
  it('returns null before the first known start', () => {
    expect(on(10, 1)).toBeNull();
  });

  it('numbers days from 1 on the start date', () => {
    expect(on(10, 2)).toEqual({ day: 1, length: 28, isPeriod: true, isFertile: false, isOvulation: false });
  });

  it('marks period days up to period_length', () => {
    expect(on(10, 6)?.isPeriod).toBe(true);
    expect(on(10, 7)?.isPeriod).toBe(false);
  });

  it('puts ovulation at cycle_length - 14 with five fertile days before it', () => {
    expect(on(10, 15)).toMatchObject({ day: 14, isOvulation: true, isFertile: true });
    expect(on(10, 10)).toMatchObject({ day: 9, isFertile: true, isOvulation: false });
    expect(on(10, 9)?.isFertile).toBe(false);
    expect(on(10, 16)?.isFertile).toBe(false);
  });

  it('wraps into the next projected cycle', () => {
    expect(on(10, 30)).toMatchObject({ day: 1, isPeriod: true });
    expect(on(11, 26)?.day).toBe(28);
  });

  it('counts calendar days across DST end', () => {
    expect(on(10, 25)?.day).toBe(24);
  });

  it('uses the latest start on or before the date, regardless of order', () => {
    const two: CycleInput = { ...input, starts: [new Date(2026, 9, 27), new Date(2026, 9, 2)] };
    expect(on(10, 28, two)?.day).toBe(2);
    expect(on(10, 26, two)?.day).toBe(25);
  });

  it('lets the fertile window overlap the period in short cycles', () => {
    const short: CycleInput = { ...input, cycleLength: 21 };
    expect(on(10, 4, short)).toMatchObject({ day: 3, isPeriod: true, isFertile: true });
  });
});
