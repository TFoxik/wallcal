import { describe, expect, it } from 'vitest';
import { hexToRgb, isHex, rgbToHex } from '../src/editor/colors';

describe('colors', () => {
  it('recognises hex colours only', () => {
    expect(isHex('#7F77DD')).toBe(true);
    expect(isHex('#abc')).toBe(true);
    expect(isHex('rgba(1, 2, 3, 0.5)')).toBe(false);
    expect(isHex('var(--primary-color)')).toBe(false);
    expect(isHex(12)).toBe(false);
  });

  it('converts both ways', () => {
    expect(hexToRgb('#7F77DD')).toEqual([127, 119, 221]);
    expect(hexToRgb('#fa0')).toEqual([255, 170, 0]);
    expect(rgbToHex([127, 119, 221])).toBe('#7F77DD');
    expect(rgbToHex([300, -4, 12.6])).toBe('#FF000D');
  });
});
