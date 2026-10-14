import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { until } from 'lit/directives/until.js';
import type { OverlayConfig } from '../config';
import type { HomeAssistant } from '../ha-types';

export interface HassCard extends HTMLElement {
  hass?: HomeAssistant;
}

// Cards live here, not in the DOM, so a hidden overlay drops out of the page (and its card stops
// its subscriptions) but showing it again reuses the same element. The promise per key must stay
// the same object between renders, or `until` would swap the node out and reconnect the card.
interface Entry {
  ready: Promise<HTMLElement>;
  el?: HassCard;
}

export class OverlayCards {
  private _cards = new Map<string, Entry>();
  private _hass?: HomeAssistant;

  constructor(private readonly _onRebuild: () => void = () => undefined) {}

  card(key: string, config: Record<string, unknown>): Promise<HTMLElement> {
    const existing = this._cards.get(key);
    if (existing) {
      // Hidden cards miss hass updates (see the setter); catch up as the card is shown again.
      if (existing.el && this._hass) existing.el.hass = this._hass;
      return existing.ready;
    }
    const entry: Entry = {
      ready: createCard(config).then(
        (el) => {
          if (this._hass) el.hass = this._hass;
          entry.el = el;
          // HA's factory fires this when a custom card's element got defined after its error card was
          // made, or a lazily loaded card rejected its config: the element has to be created again.
          el.addEventListener(
            'll-rebuild',
            () => {
              if (this._cards.get(key) !== entry) return;
              this._cards.delete(key);
              this._onRebuild();
            },
            { once: true },
          );
          return el;
        },
        (error: unknown) => message(`Overlay card unavailable: ${error instanceof Error ? error.message : String(error)}`),
      ),
    };
    this._cards.set(key, entry);
    return entry.ready;
  }

  // Only cards on the page get updates: a detached Lit card would still re-render for each one.
  set hass(hass: HomeAssistant) {
    this._hass = hass;
    for (const { el } of this._cards.values()) if (el?.isConnected) el.hass = hass;
  }

  retain(keys: Set<string>): void {
    for (const key of this._cards.keys()) if (!keys.has(key)) this._cards.delete(key);
  }
}

export interface Minimize {
  label: string;
  onMinimize(): void;
}

export interface PillProps {
  label: string;
  count: string | null;
  onExpand(): void;
}

export function renderOverlay(overlay: OverlayConfig, card: Promise<HTMLElement>, minimize?: Minimize): TemplateResult {
  const handle = minimize
    ? html`<button class="overlay__handle" aria-label=${`Minimize ${minimize.label}`} @click=${minimize.onMinimize}></button>`
    : nothing;
  return html`<div class="overlay overlay--${overlay.position}" style=${styleMap(overlayVars(overlay))}>
    ${handle}${until(card, nothing)}
  </div>`;
}

export function renderPill(overlay: OverlayConfig, p: PillProps): TemplateResult {
  const compact = overlay.pill === 'compact';
  return html`<button
    class="pill pill--${overlay.position} ${compact ? 'pill--compact' : ''}"
    style=${styleMap(overlayVars(overlay))}
    aria-label=${`Show ${p.label}`}
    title=${p.label}
    @click=${p.onExpand}
  >
    <ha-icon icon=${overlay.icon}></ha-icon>${compact ? nothing : html`<span class="pill__label">${p.label}</span>`}${p.count === null
      ? nothing
      : html`<span class="pill__count">${p.count}</span>`}
  </button>`;
}

function overlayVars(overlay: OverlayConfig): Record<string, string> {
  return {
    '--overlay-span': String(overlay.span),
    '--overlay-width': String(overlay.width),
    '--overlay-max-height': overlay.max_height,
    '--overlay-offset': `${overlay.offset}px`,
  };
}

async function createCard(config: Record<string, unknown>): Promise<HassCard> {
  if (!window.loadCardHelpers) throw new Error('the Home Assistant card factory is not available');
  const helpers = await window.loadCardHelpers();
  return helpers.createCardElement(config) as HassCard;
}

function message(text: string): HTMLElement {
  const el = document.createElement('p');
  el.className = 'overlay__message';
  el.textContent = text;
  return el;
}
