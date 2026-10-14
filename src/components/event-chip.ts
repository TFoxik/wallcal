import { html, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { DayEvent } from '../data/events';
import { formatEventTime, type HourCycle } from '../format';

export function renderEventChip(
  item: DayEvent,
  language: string,
  hourCycle: HourCycle,
  showEnd = false,
  ended = false,
): TemplateResult {
  const { event } = item;
  const color = styleMap({ '--chip-color': event.color });
  if (event.allDay) {
    return html`<div class="chip chip--allday" style=${color}><span class="chip__title">${event.title}</span></div>`;
  }
  const when = formatEventTime(item, language, hourCycle, showEnd);
  return html`<div class=${classMap({ chip: true, 'chip--timed': true, 'chip--ended': ended })} style=${color}>
    <span class="chip__time">${when}</span><span class="chip__title">${event.title}</span>
  </div>`;
}
