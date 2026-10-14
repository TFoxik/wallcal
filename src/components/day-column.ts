import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { moonPhase } from '../astro/moon';
import type { MoonConfig } from '../config';
import type { CycleDay } from '../cycle/predict';
import { isEnded, type DayEvent } from '../data/events';
import { conditionIcon, type DayForecast } from '../data/weather';
import { formatWeekday, type HourCycle, type WeekdayFormat } from '../format';
import { renderCycleRing } from './cycle-ring';
import { renderEventChip, renderTitle } from './event-chip';
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
  weekdayFormat: WeekdayFormat;
  /** Visible label calendars in config order: one header line each, kept on days without an entry
   *  so every header in the week has the same height and each calendar keeps its line. */
  labelCalendars: string[];
  /** Weather is configured: it takes the slot under the weekday, kept on days without a forecast. */
  weatherRow: boolean;
  /** Weather took the markers' place: moon and period markers sit on the first info line, and that
   *  line is kept on days without a marker. */
  markersInInfo: boolean;
}

export function renderDayColumn(p: DayColumnProps): TemplateResult {
  const { cycle } = p;
  const fertile = !!cycle && p.showFertile && cycle.isFertile;
  const ovulation = !!cycle && p.showOvulation && cycle.isOvulation;
  const dateNumber = html`<span class="day__date">${p.date.getDate()}</span>`;
  const now = p.now;
  const ended = (item: DayEvent) => now !== null && isEnded(item, now);
  const labelLines = p.labelCalendars.map((entity) => p.events.filter((e) => e.event.entity === entity));
  const chips = p.events.filter((e) => !p.labelCalendars.includes(e.event.entity));
  const allDay = chips.filter((e) => e.event.allDay);
  const timed = chips.filter((e) => !e.event.allDay);
  const { markersInInfo } = p;
  // Beside the name-day labels there is no room for the moon's name, only its icon.
  const moonName = p.moon.show_name && !markersInInfo;
  const markers = html`<span class="day__markers">
    ${cycle?.isPeriod ? icon(dropIcon, 'marker marker--period', 'Expected period') : nothing}
    ${ovulation ? icon(eggIcon, 'marker marker--ovulation', 'Expected ovulation') : nothing}
    ${p.moon.enabled ? renderMoonIcon(moonPhase(p.date), p.moon.hemisphere, moonName) : nothing}
  </span>`;

  return html`<section class=${classMap({
    day: true,
    'day--today': p.isToday,
    'day--fertile': fertile,
    'day--past': p.isPast,
    'day--weather': p.weatherRow,
  })}>
    <header class="day__header">
      <div class="day__top">
        ${cycle ? renderCycleRing(cycle, dateNumber) : dateNumber}
        <div class="day__meta">
          <span class="day__weekday">${formatWeekday(p.date, p.language, p.weekdayFormat)}</span>
          ${p.weatherRow
            ? html`<span class="day__forecast">${p.weather ? renderWeather(p.weather, p.showLow) : nothing}</span>`
            : markers}
        </div>
      </div>
      ${labelLines.length || markersInInfo
        ? html`<div class="day__info">
            <div class="day__labels">
              ${labelLines.map(
                (line) => html`<div class="day__label-line" style=${styleMap({ color: line[0]?.event.color })}>
                  ${line.map((e, i) => html`${i ? ' · ' : ''}${renderTitle(e.event)}`)}
                </div>`,
              )}
            </div>
            ${markersInInfo ? markers : nothing}
          </div>`
        : nothing}
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
