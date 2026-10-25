import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { DayEvent } from '../data/events';
import type { LoadStatus } from './agenda';
import type { UpcomingItem } from '../data/upcoming';
import { daysBetween } from '../date';
import { formatEventTime, formatWeekday, type HourCycle } from '../format';
import { renderLabelLine } from './day-column';
import { renderTitle } from './event-chip';
import { chevronRight, icon, warningIcon } from './icons';

export interface UpcomingProps {
  items: UpcomingItem[];
  today: Date;
  labels: DayEvent[][];
  language: string;
  hourCycle: HourCycle;
  warning: string | null;
  status: LoadStatus;
  navigable: boolean;
}

export function renderUpcoming(p: UpcomingProps): TemplateResult {
  const labels = p.labels.filter((line) => line.length);
  return html`<div class="upcoming">
    <div class="upcoming__head">
      <span class="upcoming__today">Today</span>
      ${labels.length
        ? html`<span class="upcoming__sep">·</span><span class="upcoming__labels">${labels.map(renderLabelLine)}</span>`
        : nothing}
      ${p.warning ? html`<span class="upcoming__warning" title=${p.warning}>${icon(warningIcon)}</span>` : nothing}
      ${p.navigable ? icon(chevronRight, 'upcoming__chevron') : nothing}
    </div>
    ${p.items.length
      ? p.items.map((u) => renderRow(u, p))
      : p.status === 'loading'
        ? nothing
        : html`<div class="upcoming__empty">${emptyText(p)}</div>`}
  </div>`;
}

function emptyText(p: UpcomingProps): string {
  if (p.status === 'failed') return "Couldn't load calendars";
  return p.warning ? 'Nothing planned in the calendars that loaded' : 'Nothing planned this week';
}

function renderRow({ item, day }: UpcomingItem, p: UpcomingProps): TemplateResult {
  const { event } = item;
  const offset = daysBetween(p.today, day);
  const time = event.allDay ? 'all day' : formatEventTime(item, p.language, p.hourCycle, false);
  const when = offset === 0 ? time : offset === 1 ? 'Tomorrow' : formatWeekday(day, p.language, 'short');
  const lead = offset !== 0 && !event.allDay ? html`<span class="upcoming__time">${time}</span> ` : nothing;
  return html`<div class="upcoming__row">
    <span class="upcoming__bar" style=${styleMap({ background: event.color })}></span>
    <span class="upcoming__when">${when}</span>
    <span class="upcoming__title">${lead}${renderTitle(event)}</span>
  </div>`;
}
