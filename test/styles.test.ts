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

describe('weekday and forecast beside the date', () => {
  it('reserves less room for short weekday names than for long ones', () => {
    const css = cardStyles.cssText.replace(/\s+/g, ' ');
    expect(css).toContain('.day--weather .day__meta { flex: 1 0 calc(var(--wallcal-weekday-size) * 5); }');
    expect(css).toContain('.grid--weekday-short .day--weather .day__meta { flex-basis: calc(var(--wallcal-weekday-size) * 3.4 + 26px); }');
  });
});

describe('weekend shade', () => {
  it('lays the weekend tint over surface and leaves today alone', () => {
    const css = cardStyles.cssText.replace(/\s+/g, ' ');
    expect(css).toContain(
      '.day--weekend:not(.day--today) { background-image: linear-gradient(var(--wallcal-weekend-background), var(--wallcal-weekend-background)); }',
    );
  });
});

describe('compact', () => {
  const css = cardStyles.cssText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
  };

  it('keeps every compact rule behind the .compact class', () => {
    const compactRules = css.match(/[^{}]*\.compact[^{}]*\{/g) ?? [];
    expect(compactRules.length).toBeGreaterThan(0);
    for (const rule of compactRules) {
      for (const selector of rule.replace('{', '').split(',')) expect(selector.trim()).toMatch(/^\.compact /);
    }
  });

  it('keeps a 44px touch target on the 36px bar buttons, and on the 32px compact ones', () => {
    const px = (rule: string, prop: string) => Number(new RegExp(`(?:^|[ ;{])${prop}: (-?\\d+)px`).exec(rule)?.[1]);
    const hitArea = block('.nav::after, .bar .toggle::after');
    expect(hitArea).toContain("content: '';");
    expect(hitArea).toContain('position: absolute;');
    expect(block('.nav')).toContain('position: relative;');
    for (const [button, after, size] of [
      ['.nav', '.nav::after, .bar .toggle::after', 36],
      ['.bar .toggle', '.bar .toggle::after', 36],
      ['.compact .nav', '.compact .nav::after', 32],
      ['.compact .toggle', '.compact .toggle::after', 32],
    ] as const) {
      const height = px(block(button), 'height');
      expect(height, button).toBe(size);
      expect(height - 2 * px(block(after), 'inset'), button).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('panel layout height', () => {
  it('subtracts the kiosk-mode header height when set, else the HA header height', () => {
    const css = cardStyles.cssText.replace(/\s+/g, ' ');
    expect(css).toContain(
      ":host([layout='panel']) { height: calc(100vh - var(--kiosk-header-height, var(--header-height, 56px))); }",
    );
  });

  it('measures agenda days from the scrolling list, not the card', () => {
    const css = cardStyles.cssText.replace(/\s+/g, ' ');
    expect(css).toMatch(/\.agenda__list \{[^}]*position: relative;/);
  });
});
