import { html } from 'lit';
import { OVERLAY_POSITIONS } from '../config';
import { OVERLAY } from './overlay-fields';
import { isPlainObject, setAt, type Raw } from './raw-config';
import { RowList } from './row-list';

export const CODE_EDITOR_NOTE = 'Edit this part with Show code editor in the menu (⋮).';

export class WallCalOverlayList extends RowList {
  static properties = {
    lovelace: { attribute: false },
    overlays: { attribute: false },
    days: { type: Number },
    cardEditors: { type: Boolean },
  };

  declare lovelace?: unknown;
  declare overlays: unknown;
  declare days: number;
  declare cardEditors: boolean;
  protected readonly addLabel = '+ Add floating card';

  constructor() {
    super();
    this.overlays = [];
    this.days = 7;
    this.cardEditors = true;
  }

  protected get rows(): Raw[] {
    return Array.isArray(this.overlays) ? this.overlays.map((o) => (isPlainObject(o) ? o : {})) : [];
  }

  private get _taken(): string[] {
    return this.rows.map((o) => String(o.position).toLowerCase());
  }

  private get _free(): string | undefined {
    return OVERLAY_POSITIONS.find((p) => !this._taken.includes(p));
  }

  protected get canAdd(): boolean {
    return this._free !== undefined;
  }

  protected newRow(): Raw {
    return { position: this._free };
  }

  protected label(overlay: Raw): string {
    const card = isPlainObject(overlay.card) ? overlay.card : undefined;
    return `${overlay.position ?? '?'} · ${overlay.name ?? card?.type ?? 'no card yet'}`;
  }

  protected body(overlay: Raw, i: number) {
    const card = isPlainObject(overlay.card) ? overlay.card : undefined;
    return html`<div class="body">
      ${this.sectionForm(OVERLAY, overlay, i, { days: this.days, taken: this._taken.filter((_, j) => j !== i) })}
      ${this._cardEditor(card, i)}
    </div>`;
  }

  private _cardEditor(card: Raw | undefined, i: number) {
    if (!this.cardEditors) return html`<p class="note">${CODE_EDITOR_NOTE}</p>`;
    const onCard = (e: CustomEvent) => this._card(i, e);
    const onMode = (e: Event) => e.stopPropagation();
    return typeof card?.type === 'string'
      ? html`<hui-card-element-editor .hass=${this.hass} .lovelace=${this.lovelace} .value=${card} @config-changed=${onCard} @GUImode-changed=${onMode}></hui-card-element-editor>`
      : html`<hui-card-picker .hass=${this.hass} .lovelace=${this.lovelace} @config-changed=${onCard} @GUImode-changed=${onMode}></hui-card-picker>`;
  }

  // HA's card editors announce their own card's config with config-changed; it must not reach HA's dialog.
  private _card(i: number, e: CustomEvent) {
    e.stopPropagation();
    const config = e.detail?.config;
    if (!isPlainObject(config)) return;
    this.patch(i, (o) => setAt(o, ['card'], config));
  }

  protected emit(overlays: Raw[]) {
    this.dispatchEvent(new CustomEvent('overlays-changed', { detail: { overlays } }));
  }
}
