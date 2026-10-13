import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { moonPhase } from '../astro/moon';
import type { MoonConfig, PeriodConfig } from '../config';
import type { CycleDay } from '../cycle/predict';
import type { DayEvent } from '../data/events';
import { formatWeekday, type HourCycle } from '../format';
import { renderCycleRing } from './cycle-ring';
import { renderEventChip } from './event-chip';
import { dropIcon, eggIcon } from './icons';
import { renderMoonIcon } from './moon-icon';

export interface DayColumnProps {
  date: Date;
  isToday: boolean;
  events: DayEvent[];
  language: string;
  hourCycle: HourCycle;
  moon: MoonConfig;
  period: PeriodConfig;
  cycle: CycleDay | null;
}

export function renderDayColumn(p: DayColumnProps): TemplateResult {
  const cycle = p.period.enabled ? p.cycle : null;
  const fertile = !!cycle && p.period.show_fertile && cycle.isFertile;
  const ovulation = !!cycle && p.period.show_ovulation && cycle.isOvulation;
  const dateNumber = html`<span class="day__date">${p.date.getDate()}</span>`;

  return html`<section class=${classMap({ day: true, 'day--today': p.isToday, 'day--fertile': fertile })}>
    <header class="day__header">
      ${cycle ? renderCycleRing(cycle, dateNumber) : dateNumber}
      <div class="day__meta">
        <span class="day__weekday">${formatWeekday(p.date, p.language)}</span>
        <span class="day__markers">
          ${cycle?.isPeriod
            ? html`<svg class="marker marker--period" viewBox="0 0 24 24" role="img" aria-label="Expected period">${dropIcon}</svg>`
            : nothing}
          ${ovulation
            ? html`<svg class="marker marker--ovulation" viewBox="0 0 24 24" role="img" aria-label="Expected ovulation">${eggIcon}</svg>`
            : nothing}
          ${p.moon.enabled ? renderMoonIcon(moonPhase(p.date), p.moon.hemisphere, p.moon.show_name) : nothing}
        </span>
      </div>
    </header>
    <div class="day__events">${p.events.map((e) => renderEventChip(e, p.language, p.hourCycle))}</div>
  </section>`;
}
