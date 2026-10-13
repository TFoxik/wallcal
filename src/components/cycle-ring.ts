import { html, type TemplateResult } from 'lit';
import type { CycleDay } from '../cycle/predict';

const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ringDash(cycle: CycleDay): string {
  const filled = (cycle.day / cycle.length) * CIRCUMFERENCE;
  return `${filled.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`;
}

export function renderCycleRing(cycle: CycleDay, content: TemplateResult): TemplateResult {
  return html`<div class="ring ${cycle.isPeriod ? 'ring--period' : ''}" title="Cycle day ${cycle.day} of ${cycle.length}">
    <svg viewBox="0 0 52 52" aria-hidden="true">
      <circle class="ring__track" cx="26" cy="26" r=${RADIUS}></circle>
      <circle
        class="ring__fill"
        cx="26"
        cy="26"
        r=${RADIUS}
        stroke-dasharray=${ringDash(cycle)}
        transform="rotate(-90 26 26)"
      ></circle>
    </svg>
    <span class="ring__content">${content}</span>
  </div>`;
}
