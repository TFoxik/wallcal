import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import type { HeaderConfig } from '../config';
import { chevronLeft, chevronRight, icon, warningIcon } from './icons';

export interface TopBarProps {
  header: HeaderConfig;
  title: string | null;
  subtitle: string | null;
  isCurrentWeek: boolean;
  warning: string | null;
  onPrev(): void;
  onToday(): void;
  onNext(): void;
}

export function renderTopBar(p: TopBarProps): TemplateResult | typeof nothing {
  if (!p.header.show) return nothing;
  const titleEl = p.title === null ? nothing : html`<h1 class="bar__title">${p.title}</h1>`;
  const subtitleEl = p.subtitle === null ? nothing : html`<span class="bar__subtitle">${p.subtitle}</span>`;
  const title =
    p.title === null && p.subtitle === null ? nothing : html`<div class="bar__heading">${titleEl}${subtitleEl}</div>`;
  const centered = p.header.align === 'center';
  const todayClasses = { nav: true, 'nav--today': true, 'nav--current': p.isCurrentWeek };

  return html`<div class="bar">
    <div class="bar__start">${centered ? nothing : title}</div>
    <div class="bar__center">${centered ? title : nothing}</div>
    <div class="bar__end">
      ${p.warning
        ? html`<span class="bar__warning" title=${p.warning}>${icon(warningIcon)}</span>`
        : nothing}
      ${p.header.navigation
        ? html`<button class="nav" aria-label="Previous week" @click=${p.onPrev}>${icon(chevronLeft)}</button>
            <button class=${classMap(todayClasses)} @click=${p.onToday}>Today</button>
            <button class="nav" aria-label="Next week" @click=${p.onNext}>${icon(chevronRight)}</button>`
        : nothing}
    </div>
  </div>`;
}
