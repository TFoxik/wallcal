import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

export interface HeaderToggle {
  label: string;
  color: string;
  icon?: string;
  hidden: boolean;
  onToggle(): void;
}

export function renderHeaderToggles(toggles: HeaderToggle[]): TemplateResult | typeof nothing {
  if (!toggles.length) return nothing;
  return html`<div class="toggles">
    ${toggles.map(
      (t) => html`<button
        class=${classMap({ toggle: true, 'toggle--hidden': t.hidden })}
        style=${styleMap({ '--toggle-color': t.color })}
        aria-pressed=${t.hidden ? 'false' : 'true'}
        aria-label=${`${t.hidden ? 'Show' : 'Hide'} ${t.label}`}
        title=${t.label}
        @click=${t.onToggle}
      >
        ${t.icon ? html`<ha-icon icon=${t.icon}></ha-icon>` : initial(t.label)}
      </button>`,
    )}
  </div>`;
}

// Array.from splits by code point, so a leading "Č" or emoji stays whole.
function initial(label: string): string {
  return (Array.from(label.trim())[0] ?? '?').toLocaleUpperCase();
}
