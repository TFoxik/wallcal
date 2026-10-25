import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { AgendaConfig, MoonConfig, PastEvents } from '../config';
import type { CycleDay } from '../cycle/predict';
import { isEnded, type DayEvent } from '../data/events';
import { daysBetween } from '../date';
import { formatter, formatWeekday, type HourCycle } from '../format';
import { chipEvents, labelLines, renderLabelLine, renderMarkers } from './day-column';
import { renderEventChip } from './event-chip';
import { renderHeaderToggles, type HeaderToggle } from './header-toggles';
import { icon, warningIcon } from './icons';

const MAX_DOTS = 3;

/** loading: the calendars haven't answered yet, so an empty day means "not known yet". */
export type LoadStatus = 'loading' | 'ready' | 'failed';

export interface AgendaDay {
  date: Date;
  key: string;
  events: DayEvent[];
  cycle: CycleDay | null;
}

export interface AgendaProps {
  days: AgendaDay[];
  today: Date;
  activeKey: string;
  toggles: HeaderToggle[];
  warning: string | null;
  status: LoadStatus;
  agenda: AgendaConfig;
  labelCalendars: string[];
  language: string;
  hourCycle: HourCycle;
  showEndTime: boolean;
  pastEvents: PastEvents;
  now: Date;
  moon: MoonConfig;
  showOvulation: boolean;
  /** Floating cards and pills, placed over the list like the week grid's. */
  overlays: unknown;
  onJump(key: string): void;
  onScroll(): void;
  onTouch(event: Event): void;
}

export function stripDots(events: DayEvent[], labelCalendars: readonly string[]): string[] {
  return chipEvents(events, labelCalendars)
    .slice(0, MAX_DOTS)
    .map((e) => e.event.color);
}

export function renderAgenda(p: AgendaProps): TemplateResult {
  const shown = p.agenda.show === 'day' ? [p.days.find((d) => d.key === p.activeKey) ?? p.days[0]] : p.days;
  return html`<div class="agenda agenda--${p.agenda.style}">
    <div class="agenda__strip">${p.days.map((day) => renderCell(day, p))}</div>
    <div
      class="agenda__list agenda__list--events-${p.pastEvents}"
      @scroll=${{ handleEvent: () => p.onScroll(), passive: true }}
      @pointerdown=${(event: Event) => p.onTouch(event)}
      @wheel=${{ handleEvent: (event: Event) => p.onTouch(event), passive: true }}
    >
      ${renderHeaderToggles(p.toggles)}
      ${p.warning ? html`<div class="agenda__warning">${icon(warningIcon)}<span>${p.warning}</span></div>` : nothing}
      ${p.status === 'failed' ? html`<div class="agenda__failed">Couldn't load calendars</div>` : nothing}
      ${shown.map((day) => renderDay(day, p))}
    </div>
    ${p.activeKey !== p.days[0]?.key
      ? html`<button class="agenda__today" type="button" @click=${() => p.onJump(p.days[0].key)}>Today</button>`
      : nothing}
    ${p.overlays}
  </div>`;
}

function renderCell(day: AgendaDay, p: AgendaProps): TemplateResult {
  const classes = {
    agenda__cell: true,
    'agenda__cell--today': daysBetween(p.today, day.date) === 0,
    'agenda__cell--active': day.key === p.activeKey,
  };
  return html`<button class=${classMap(classes)} type="button" data-day=${day.key} @click=${() => p.onJump(day.key)}>
    <span class="agenda__weekday">${formatter(p.language, { weekday: 'narrow' }).format(day.date)}</span>
    <span class="agenda__number">${day.date.getDate()}</span>
    <span class="agenda__dots">
      ${stripDots(day.events, p.labelCalendars).map(
        (color) => html`<span class="agenda__dot" style=${styleMap({ '--dot-color': color })}></span>`,
      )}
    </span>
  </button>`;
}

function renderDay(day: AgendaDay, p: AgendaProps): TemplateResult {
  const offset = daysBetween(p.today, day.date);
  const name = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : formatWeekday(day.date, p.language, 'short');
  const lines = labelLines(day.events, p.labelCalendars).filter((line) => line.length);
  const chips = chipEvents(day.events, p.labelCalendars);
  const ended = (item: DayEvent) => offset === 0 && isEnded(item, p.now);
  const date = html`<span class="agenda__date">${day.date.getDate()}</span><span class="agenda__name">${name}</span>`;
  const labels = html`<span class="agenda__labels">${lines.map(renderLabelLine)}</span>
    ${renderMarkers(day.date, day.cycle, p.showOvulation, p.moon, false)}`;
  const events = chips.length
    ? html`<div class="agenda__events">
        ${chips.map((e) => renderEventChip(e, p.language, p.hourCycle, p.showEndTime, ended(e)))}
      </div>`
    : p.status === 'ready'
      ? html`<div class="agenda__empty">Nothing planned</div>`
      : nothing;
  return html`<section class=${classMap({ agenda__day: true, 'agenda__day--today': offset === 0 })} data-day=${day.key}>
    ${p.agenda.style === 'cards'
      ? html`<header class="agenda__head">${date}${labels}</header>${events}`
      : html`<div class="agenda__datecol">${date}</div>
          <div class="agenda__body"><div class="agenda__head">${labels}</div>${events}</div>`}
  </section>`;
}
