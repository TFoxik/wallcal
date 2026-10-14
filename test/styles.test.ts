import { describe, expect, it } from 'vitest';
import { cardStyles } from '../src/theme/styles';

// HA resolves its derived variables (e.g. --mdc-theme-text-primary-on-background) once on the page,
// so only remapping --primary-text-color leaves a hosted card in the HA theme's colours.
describe('overlay theming', () => {
  it('maps the derived HA text, form and accent variables onto WallCal tokens', () => {
    const css = cardStyles.cssText.replace(/\s+/g, ' ');
    for (const [name, token] of [
      ['--mdc-theme-text-primary-on-background', '--wallcal-text'],
      ['--mdc-theme-text-secondary-on-background', '--wallcal-muted'],
      ['--mdc-theme-on-surface', '--wallcal-text'],
      ['--mdc-theme-primary', '--wallcal-accent'],
      ['--mdc-theme-secondary', '--wallcal-accent'],
      ['--mdc-checkbox-unchecked-color', '--wallcal-muted'],
      ['--ha-color-fill-primary-loud-resting', '--wallcal-accent'],
      ['--ha-color-fill-primary-loud-hover', '--wallcal-accent'],
      ['--ha-color-text-primary', '--wallcal-text'],
      ['--ha-color-text-secondary', '--wallcal-muted'],
      ['--wa-color-text-normal', '--wallcal-text'],
      ['--wa-color-text-quiet', '--wallcal-muted'],
      ['--wa-form-control-value-color', '--wallcal-text'],
      ['--wa-form-control-placeholder-color', '--wallcal-muted'],
      ['--ha-color-form-background', '--wallcal-surface'],
      ['--wa-form-control-background-color', '--wallcal-surface'],
    ]) {
      expect(css).toContain(`${name}: var(${token});`);
    }
  });
});
