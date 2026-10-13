import { html, nothing, type TemplateResult } from 'lit';
import { PHASE_LABELS, litOnRight, moonPath, type MoonPhase } from '../astro/moon';

export function renderMoonIcon(phase: MoonPhase, hemisphere: 'north' | 'south', showName: boolean): TemplateResult {
  const label = PHASE_LABELS[phase.phase];
  return html`<span class="moon" title=${label}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle class="moon__dark" cx="12" cy="12" r="11"></circle>
      <path class="moon__lit" d=${moonPath(phase.illumination, litOnRight(phase, hemisphere), 11, 12, 12)}></path>
    </svg>
    ${showName ? html`<span class="moon__name">${label}</span>` : nothing}
  </span>`;
}
