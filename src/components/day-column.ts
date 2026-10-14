import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { moonPhase } from '../astro/moon';
import type { MoonConfig } from '../config';
import type { CycleDay } from '../cycle/predict';
import { isEnded, type DayEvent } from '../data/events';
import { conditionIcon, type DayForecast } from '../data/weather';
import { formatWeekday, type HourCycle } from '../format';
import { renderCycleRing } from './cycle-ring';
import { renderEventChip } from './event-chip';
import { dropIcon, eggIcon, icon } from './icons';
import { renderMoonIcon } from './moon-icon';

export interface DayColumnProps {
  date: Date;
  isToday: boolean;
  events: DayEvent[];
  language: string;
  hourCycle: HourCycle;
  moon: MoonConfig;
  cycle: CycleDay | null;
  showFertile: boolean;
  showOvulation: boolean;
  showEndTime: boolean;
  isPast: boolean;
  /** Set only for today's column: events that ended before it are marked ended. */
  now: Date | null;
  weather: DayForecast | null;
  showLow: boolean;
}

export function renderDayColumn(p: DayColumnProps): TemplateResult {
  const { cycle } = p;
  const fertile = !!cycle && p.showFertile && cycle.isFertile;
  const ovulation = !!cycle && p.showOvulation && cycle.isOvulation;
  const dateNumber = html`<span class="day__date">${p.date.getDate()}</span>`;
  const now = p.now;
  const ended = (item: DayEvent) => now !== null && isEnded(item, now);
  const allDay = p.events.filter((e) => e.event.allDay);
  const timed = p.events.filter((e) => !e.event.allDay);

  return html`<section class=${classMap({
    day: true,
    'day--today': p.isToday,
    'day--fertile': fertile,
    'day--past': p.isPast,
  })}>
    <header class="day__header">
      ${cycle ? renderCycleRing(cycle, dateNumber) : dateNumber}
      <div class="day__meta">
        <span class="day__weekday">${formatWeekday(p.date, p.language)}</span>
        <span class="day__markers">
          ${cycle?.isPeriod ? icon(dropIcon, 'marker marker--period', 'Expected period') : nothing}
          ${ovulation ? icon(eggIcon, 'marker marker--ovulation', 'Expected ovulation') : nothing}
          ${p.moon.enabled ? renderMoonIcon(moonPhase(p.date), p.moon.hemisphere, p.moon.show_name) : nothing}
        </span>
      </div>
      ${p.weather ? renderWeather(p.weather, p.showLow) : nothing}
    </header>
    ${allDay.length
      ? html`<div class="day__allday">${allDay.map((e) => renderEventChip(e, p.language, p.hourCycle))}</div>`
      : nothing}
    <div class="day__events">
      ${timed.map((e) => renderEventChip(e, p.language, p.hourCycle, p.showEndTime, ended(e)))}
    </div>
  </section>`;
}

function renderWeather(day: DayForecast, showLow: boolean): TemplateResult {
  const low = showLow && day.low !== null ? html`<span class="day__low">/${Math.round(day.low)}°</span>` : nothing;
  return html`<span class="day__weather" title=${day.condition}>
    <ha-icon icon=${conditionIcon(day.condition)}></ha-icon>
    <span class="day__temp">${Math.round(day.high)}°${low}</span>
  </span>`;
}
