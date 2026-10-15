import { css, html, LitElement, nothing } from 'lit';
import { OVERLAY_POSITIONS } from '../config';
import type { HomeAssistant } from '../ha-types';
import { OVERLAY } from './overlay-fields';
import { applyFormChange, isPlainObject, setAt, type Raw } from './raw-config';
import { computeHelper, computeLabel, formData } from './sections';

export const CODE_EDITOR_NOTE = 'Edit this part with Show code editor in the menu (⋮).';

export class WallCalOverlayList extends LitElement {
  static properties = {
    hass: { attribute: false },
    lovelace: { attribute: false },
    overlays: { attribute: false },
    days: { type: Number },
    cardEditors: { type: Boolean },
    _expanded: { state: true },
  };

  declare hass?: HomeAssistant;
  declare lovelace?: unknown;
  declare overlays: unknown;
  declare days: number;
  declare cardEditors: boolean;
  declare _expanded: number | null;

  static styles = css`
    .row { border: 1px solid var(--divider-color); border-radius: 8px; margin-bottom: 8px; }
    .head { display: flex; align-items: center; gap: 4px; padding: 4px 8px; }
    .head .title { flex: 1; }
    .body { padding: 0 12px 12px; display: grid; gap: 12px; }
    button { background: none; border: none; color: var(--primary-text-color); cursor: pointer; padding: 6px; }
    button[disabled] { opacity: 0.4; cursor: default; }
    .add { color: var(--primary-color); font-weight: 500; }
    .note { color: var(--secondary-text-color); }
  `;

  constructor() {
    super();
    this.overlays = [];
    this.days = 7;
    this.cardEditors = true;
    this._expanded = null;
  }

  private get _list(): Raw[] {
    return Array.isArray(this.overlays) ? this.overlays.map((o) => (isPlainObject(o) ? o : {})) : [];
  }

  render() {
    const list = this._list;
    const taken = list.map((o) => String(o.position).toLowerCase());
    const free = OVERLAY_POSITIONS.filter((p) => !taken.includes(p));
    return html`
      ${list.map((overlay, i) => this._row(overlay, i, list.length, taken))}
      <button class="add" ?disabled=${free.length === 0} @click=${() => this._add(free[0])}>+ Add floating card</button>
    `;
  }

  private _row(overlay: Raw, i: number, count: number, taken: string[]) {
    const card = isPlainObject(overlay.card) ? overlay.card : undefined;
    const label = `${overlay.position ?? '?'} · ${overlay.name ?? card?.type ?? 'no card yet'}`;
    const open = this._expanded === i;
    return html`<div class="row">
      <div class="head">
        <button class="expand" aria-expanded=${open} @click=${() => (this._expanded = open ? null : i)}>
          <ha-icon icon=${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
        </button>
        <span class="title">${label}</span>
        <button class="up" ?disabled=${i === 0} aria-label="Move up" @click=${() => this._move(i, -1)}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
        <button class="down" ?disabled=${i === count - 1} aria-label="Move down" @click=${() => this._move(i, 1)}><ha-icon icon="mdi:arrow-down"></ha-icon></button>
        <button class="remove" aria-label="Remove" @click=${() => this._remove(i)}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
      </div>
      ${open ? this._body(overlay, i, card, taken) : nothing}
    </div>`;
  }

  private _body(overlay: Raw, i: number, card: Raw | undefined, taken: string[]) {
    const form = formData(OVERLAY, overlay);
    return html`<div class="body">
            <ha-form
              .hass=${this.hass}
              .data=${form}
              .schema=${OVERLAY.schema(form, { days: this.days, taken: taken.filter((_, j) => j !== i) })}
              .computeLabel=${computeLabel}
              .computeHelper=${computeHelper}
              @value-changed=${(e: CustomEvent) => this._fields(i, form, e)}
            ></ha-form>
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

  private _fields(i: number, before: Raw, e: CustomEvent) {
    e.stopPropagation();
    this._patch(i, (o) => applyFormChange(o, [], before, e.detail.value as Raw, OVERLAY.rules));
  }

  // HA's card editors announce their own card's config with config-changed; it must not reach HA's dialog.
  private _card(i: number, e: CustomEvent) {
    e.stopPropagation();
    const config = e.detail?.config;
    if (!isPlainObject(config)) return;
    this._patch(i, (o) => setAt(o, ['card'], config));
  }

  private _patch(i: number, change: (overlay: Raw) => Raw) {
    this._emit(this._list.map((o, j) => (j === i ? change(o) : o)));
  }

  private _add(position: string) {
    const list = [...this._list, { position }];
    this._expanded = list.length - 1;
    this._emit(list);
  }

  private _move(i: number, delta: number) {
    const list = [...this._list];
    [list[i], list[i + delta]] = [list[i + delta], list[i]];
    if (this._expanded === i) this._expanded = i + delta;
    else if (this._expanded === i + delta) this._expanded = i;
    this._emit(list);
  }

  private _remove(i: number) {
    this._expanded = null;
    this._emit(this._list.filter((_, j) => j !== i));
  }

  private _emit(overlays: Raw[]) {
    this.dispatchEvent(new CustomEvent('overlays-changed', { detail: { overlays } }));
  }
}
