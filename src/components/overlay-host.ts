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
export class OverlayCards {
  private _cards = new Map<string, Promise<HTMLElement>>();
  private _live = new Set<HassCard>();
  private _hass?: HomeAssistant;

  constructor(private readonly _onRebuild: () => void = () => undefined) {}

  card(key: string, config: Record<string, unknown>): Promise<HTMLElement> {
    let card = this._cards.get(key);
    if (!card) {
      card = createCard(config).then(
        (el) => {
          if (this._hass) el.hass = this._hass;
          this._live.add(el);
          // HA's factory fires this when a custom card's element got defined after its error card was
          // made, or a lazily loaded card rejected its config: the element has to be created again.
          el.addEventListener(
            'll-rebuild',
            () => {
              if (!this._live.delete(el)) return;
              this._cards.delete(key);
              this._onRebuild();
            },
            { once: true },
          );
          return el;
        },
        (error: unknown) => message(`Overlay card unavailable: ${error instanceof Error ? error.message : String(error)}`),
      );
      this._cards.set(key, card);
    }
    return card;
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    for (const el of this._live) el.hass = hass;
  }

  retain(keys: Set<string>): void {
    for (const [key, card] of this._cards) {
      if (keys.has(key)) continue;
      this._cards.delete(key);
      void card.then((el) => this._live.delete(el as HassCard));
    }
  }
}

export function renderOverlay(overlay: OverlayConfig, card: Promise<HTMLElement>): TemplateResult {
  const vars = {
    '--overlay-span': String(overlay.span),
    '--overlay-width': String(overlay.width),
    '--overlay-max-height': overlay.max_height,
    '--overlay-offset': `${overlay.offset}px`,
  };
  return html`<div class="overlay overlay--${overlay.position}" style=${styleMap(vars)}>${until(card, nothing)}</div>`;
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
