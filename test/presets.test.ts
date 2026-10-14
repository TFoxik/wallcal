import { describe, expect, it } from 'vitest';
import { PRESETS, THEME_NAMES, TOKENS, cssVar, resolveTokens } from '../src/theme/presets';

describe('theme tokens', () => {
  it('maps token names to CSS custom properties', () => {
    expect(cssVar('date_size')).toBe('--wallcal-date-size');
  });

  it('resolves every token for every theme', () => {
    for (const theme of THEME_NAMES) {
      const vars = resolveTokens(theme, {});
      expect(Object.keys(vars)).toHaveLength(TOKENS.length);
      expect(Object.values(vars).every((v) => v.length > 0)).toBe(true);
    }
  });

  it('defaults derive from HA theme variables', () => {
    expect(resolveTokens('default', {})['--wallcal-text']).toContain('--primary-text-color');
    expect(resolveTokens('default', {})['--wallcal-date-size']).toBe('32px');
  });

  it('day columns follow the card radius unless day_radius is set', () => {
    expect(resolveTokens('default', {})['--wallcal-day-radius']).toBe('var(--wallcal-radius)');
    expect(resolveTokens('default', { radius: '0', day_radius: '12px' })['--wallcal-day-radius']).toBe('12px');
  });

  it('all-day titles default a little smaller than event titles', () => {
    expect(resolveTokens('default', {})['--wallcal-allday-size']).toBe('calc(var(--wallcal-event-size) - 2px)');
  });

  it('presets override defaults', () => {
    expect(resolveTokens('paper', {})['--wallcal-background']).toBe(PRESETS.paper.background);
  });

  it('user overrides beat presets', () => {
    expect(resolveTokens('paper', { background: 'red' })['--wallcal-background']).toBe('red');
  });
});
