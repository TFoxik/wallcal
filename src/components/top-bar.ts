import { html, nothing, type TemplateResult } from 'lit';
import type { HeaderConfig } from '../config';
import { chevronLeft, chevronRight, warningIcon } from './icons';

export interface TopBarProps {
  header: HeaderConfig;
  title: string;
  isCurrentWeek: boolean;
  warning: string | null;
  onPrev(): void;
  onToday(): void;
  onNext(): void;
}

export function renderTopBar(p: TopBarProps): TemplateResult | typeof nothing {
  if (!p.header.show) return nothing;
  const title = p.header.title === 'none' ? nothing : html`<h1 class="bar__title">${p.title}</h1>`;
  const centered = p.header.align === 'center';

  return html`<div class="bar">
    <div class="bar__start">${centered ? nothing : title}</div>
    <div class="bar__center">${centered ? title : nothing}</div>
    <div class="bar__end">
      ${p.warning
        ? html`<span class="bar__warning" title=${p.warning}><svg viewBox="0 0 24 24" aria-hidden="true">${warningIcon}</svg></span>`
        : nothing}
      ${p.header.navigation
        ? html`<button class="nav" aria-label="Previous week" @click=${p.onPrev}>
              <svg viewBox="0 0 24 24" aria-hidden="true">${chevronLeft}</svg>
            </button>
            <button class="nav nav--today ${p.isCurrentWeek ? 'nav--current' : ''}" @click=${p.onToday}>Today</button>
            <button class="nav" aria-label="Next week" @click=${p.onNext}>
              <svg viewBox="0 0 24 24" aria-hidden="true">${chevronRight}</svg>
            </button>`
        : nothing}
    </div>
  </div>`;
}
