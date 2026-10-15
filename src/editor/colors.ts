export type Rgb = [number, number, number];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

export function hexToRgb(hex: string): Rgb {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex(rgb: readonly number[]): string {
  const channel = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  return `#${rgb.slice(0, 3).map(channel).join('')}`.toUpperCase();
}
