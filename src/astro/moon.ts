export type MoonPhaseName =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

export interface MoonPhase {
  age: number;
  fraction: number;
  illumination: number;
  waxing: boolean;
  phase: MoonPhaseName;
}

export const SYNODIC_MONTH = 29.530588853;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const MS_PER_DAY = 86_400_000;

const PHASES: MoonPhaseName[] = [
  'new',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent',
];

export const PHASE_LABELS: Record<MoonPhaseName, string> = {
  new: 'New moon',
  waxing_crescent: 'Waxing crescent',
  first_quarter: 'First quarter',
  waxing_gibbous: 'Waxing gibbous',
  full: 'Full moon',
  waning_gibbous: 'Waning gibbous',
  last_quarter: 'Last quarter',
  waning_crescent: 'Waning crescent',
};

export function moonPhase(date: Date): MoonPhase {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const days = (noon.getTime() - REFERENCE_NEW_MOON) / MS_PER_DAY;
  const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const fraction = age / SYNODIC_MONTH;
  return {
    age,
    fraction,
    illumination: (1 - Math.cos(2 * Math.PI * fraction)) / 2,
    waxing: fraction < 0.5,
    phase: PHASES[Math.floor(fraction * 8 + 0.5) % 8],
  };
}

export function litOnRight(phase: MoonPhase, hemisphere: 'north' | 'south'): boolean {
  return phase.waxing !== (hemisphere === 'south');
}

const round = (n: number) => Number(n.toFixed(2));

// Lit area = outer half-disc on the lit side + an elliptical terminator back to the top.
// SVG sweep flag 1 = clockwise on screen; the terminator bulges toward the lit side for a
// crescent and away from it for a gibbous moon.
export function moonPath(illumination: number, litRight: boolean, r: number, cx: number, cy: number): string {
  const rx = round(Math.abs(1 - 2 * illumination) * r);
  const gibbous = illumination > 0.5;
  const outerSweep = litRight ? 1 : 0;
  const innerSweep = litRight === gibbous ? 1 : 0;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`;
}
