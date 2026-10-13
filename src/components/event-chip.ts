import { html, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { DayEvent } from '../data/events';
import { formatTime, type HourCycle } from '../format';

export function renderEventChip(item: DayEvent, language: string, hourCycle: HourCycle): TemplateResult {
  const { event, continued } = item;
  const color = styleMap({ '--chip-color': event.color });
  if (event.allDay) {
    return html`<div class="chip chip--allday" style=${color}><span class="chip__title">${event.title}</span></div>`;
  }
  const when = continued ? 'continues' : formatTime(event.start, language, hourCycle);
  return html`<div class="chip chip--timed" style=${color}>
    <span class="chip__time">${when}</span><span class="chip__title">${event.title}</span>
  </div>`;
}
