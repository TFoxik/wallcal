import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { moonPhase } from '../astro/moon';
import type { MoonConfig } from '../config';
import type { CycleDay } from '../cycle/predict';
import { isEnded, type DayEvent } from '../data/events';
import { conditionIcon, type DayForecast } from '../data/weather';
import { dayKey } from '../date';
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
  /** Timed events below the visible part of the list, measured by the card after layout. */
  more: number;
}

export function renderDayColumn(p: DayColumnProps): TemplateResult {
  const { cycle } = p;
  const fertile = !!cycle && p.showFertile && cycle.isFertile;
  const dateNumber = html`<span class="day__date">${p.date.getDate()}</span>`;
  const now = p.now;
  const ended = (item: DayEvent) => now !== null && isEnded(item, now);
  const lines = labelLines(p.events, p.labelCalendars);
  const chips = chipEvents(p.events, p.labelCalendars);
  const allDay = chips.filter((e) => e.event.allDay);
  const timed = chips.filter((e) => !e.event.allDay);
  const { markersInInfo } = p;
  // Beside the name-day labels there is no room for the moon's name, only its icon.
  const moonName = p.moon.show_name && !markersInInfo;
  const markers = renderMarkers(p.date, cycle, p.showOvulation, p.moon, moonName);

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
      ${lines.length || markersInInfo
        ? html`<div class="day__info">
            <div class="day__labels">
              ${lines.map(renderLabelLine)}
            </div>
            ${markersInInfo ? markers : nothing}
          </div>`
        : nothing}
    </header>
    ${allDay.length
      ? html`<div class="day__allday">${allDay.map((e) => renderEventChip(e, p.language, p.hourCycle))}</div>`
      : nothing}
    <div class="day__events" data-day=${dayKey(p.date)}>
      ${timed.map((e) => renderEventChip(e, p.language, p.hourCycle, p.showEndTime, ended(e)))}
    </div>
    ${p.more ? html`<button class="day__more" type="button" @click=${showMore}>+${p.more} more</button>` : nothing}
  </section>`;
}

export function renderMarkers(
  date: Date,
  cycle: CycleDay | null,
  showOvulation: boolean,
  moon: MoonConfig,
  moonName: boolean,
): TemplateResult {
  const ovulation = !!cycle && showOvulation && cycle.isOvulation;
  return html`<span class="day__markers">
    ${cycle?.isPeriod ? icon(dropIcon, 'marker marker--period', 'Expected period') : nothing}
    ${ovulation ? icon(eggIcon, 'marker marker--ovulation', 'Expected ovulation') : nothing}
    ${moon.enabled ? renderMoonIcon(moonPhase(date), moon.hemisphere, moonName) : nothing}
  </span>`;
}

/** One entry per label calendar, in config order, with that calendar's events of the day (possibly none). */
export function labelLines(events: DayEvent[], labelCalendars: string[]): DayEvent[][] {
  return labelCalendars.map((entity) => events.filter((e) => e.event.entity === entity));
}

export function chipEvents(events: DayEvent[], labelCalendars: readonly string[]): DayEvent[] {
  return events.filter((e) => !labelCalendars.includes(e.event.entity));
}

export function renderLabelLine(line: DayEvent[]): TemplateResult {
  return html`<div class="day__label-line" style=${styleMap({ color: line[0]?.event.color })}>
    ${line.map((e, i) => html`${i ? ' · ' : ''}${renderTitle(e.event)}`)}
  </div>`;
}

/** Chips in a day list that are not fully in view below its scroll position; hidden chips have no height. */
export function chipsBelow(list: HTMLElement): HTMLElement[] {
  const bottom = list.scrollTop + list.clientHeight;
  // 1px of slack: layout positions are fractional and these offsets are rounded.
  return [...list.querySelectorAll<HTMLElement>('.chip')].filter(
    (chip) => chip.offsetHeight > 0 && chip.offsetTop + chip.offsetHeight > bottom + 1,
  );
}

function showMore(event: Event): void {
  const list = (event.currentTarget as HTMLElement).closest('.day')!.querySelector<HTMLElement>('.day__events')!;
  const first = chipsBelow(list)[0];
  if (first) list.scrollTop = first.offsetTop;
}

function renderWeather(day: DayForecast, showLow: boolean): TemplateResult {
  const low = showLow && day.low !== null ? html`<span class="day__low">/${Math.round(day.low)}°</span>` : nothing;
  return html`<span class="day__weather" title=${day.condition}>
    <ha-icon icon=${conditionIcon(day.condition)}></ha-icon>
    <span class="day__temp">${Math.round(day.high)}°${low}</span>
  </span>`;
}
