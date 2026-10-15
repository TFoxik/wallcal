import { css, html, LitElement, nothing, type PropertyDeclarations, type TemplateResult } from 'lit';
import type { HomeAssistant } from '../ha-types';
import { applyFormChange, type Raw } from './raw-config';
import { computeHelper, formData, labelsFor, type FormSchema, type SchemaContext, type SectionDef } from './sections';

/** A list of expandable rows with move, remove and add; subclasses supply the rows and each row's body. */
export abstract class RowList extends LitElement {
  static properties: PropertyDeclarations = {
    hass: { attribute: false },
    _expanded: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _expanded: number | null;
  // HA sets hass on every state change; an open row's form keeps its data and schema until the row itself changes.
  private _forms = new WeakMap<Raw, { key: string; data: Raw; schema: FormSchema[] }>();

  static styles = css`
    .row { border: 1px solid var(--divider-color); border-radius: 8px; margin-bottom: 8px; }
    .head { display: flex; align-items: center; gap: 4px; padding: 4px 8px; }
    .head .title { flex: 1; }
    .body { padding: 0 12px 12px; display: grid; gap: 12px; }
    button { background: none; border: none; color: var(--primary-text-color); cursor: pointer; padding: 6px; }
    button[disabled] { opacity: 0.4; cursor: default; }
    .add, .link { color: var(--primary-color); font-weight: 500; justify-self: start; }
    .note { color: var(--secondary-text-color); }
  `;

  constructor() {
    super();
    this._expanded = null;
  }

  protected abstract get rows(): Raw[];
  protected abstract emit(rows: Raw[]): void;
  protected abstract label(row: Raw): string;
  protected abstract body(row: Raw, i: number): TemplateResult;
  protected abstract get canAdd(): boolean;
  protected abstract newRow(): Raw;
  protected abstract readonly addLabel: string;

  render() {
    const rows = this.rows;
    return html`
      ${rows.map((row, i) => this._row(row, i, rows.length))}
      <button class="add" ?disabled=${!this.canAdd} @click=${this._add}>${this.addLabel}</button>
    `;
  }

  private _row(row: Raw, i: number, count: number) {
    const open = this._expanded === i;
    return html`<div class="row">
      <div class="head">
        <button class="expand" aria-expanded=${open} aria-label="Edit" @click=${() => (this._expanded = open ? null : i)}>
          <ha-icon icon=${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
        </button>
        <span class="title">${this.label(row)}</span>
        <button class="up" ?disabled=${i === 0} aria-label="Move up" @click=${() => this._move(i, -1)}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
        <button class="down" ?disabled=${i === count - 1} aria-label="Move down" @click=${() => this._move(i, 1)}><ha-icon icon="mdi:arrow-down"></ha-icon></button>
        <button class="remove" aria-label="Remove" @click=${() => this._remove(i)}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
      </div>
      ${open ? this.body(row, i) : nothing}
    </div>`;
  }

  /** The ha-form for one row's fields; edits are written back to that row only. */
  protected sectionForm(section: SectionDef, row: Raw, i: number, ctx: SchemaContext) {
    const key = `${ctx.days}|${(ctx.taken ?? []).join()}`;
    let form = this._forms.get(row);
    if (!form || form.key !== key) {
      const data = formData(section, row);
      form = { key, data, schema: section.schema(data, ctx) };
      this._forms.set(row, form);
    }
    const before = form.data;
    return html`<ha-form
      .hass=${this.hass}
      .data=${form.data}
      .schema=${form.schema}
      .computeLabel=${labelsFor(section)}
      .computeHelper=${computeHelper}
      @value-changed=${(e: CustomEvent) => {
        e.stopPropagation();
        this.patch(i, (r) => applyFormChange(r, [], before, e.detail.value as Raw, section.rules));
      }}
    ></ha-form>`;
  }

  protected patch(i: number, change: (row: Raw) => Raw) {
    this.emit(this.rows.map((row, j) => (j === i ? change(row) : row)));
  }

  private _add = () => {
    if (!this.canAdd) return;
    const rows = [...this.rows, this.newRow()];
    this._expanded = rows.length - 1;
    this.emit(rows);
  };

  private _move(i: number, delta: number) {
    const rows = [...this.rows];
    [rows[i], rows[i + delta]] = [rows[i + delta], rows[i]];
    if (this._expanded === i) this._expanded = i + delta;
    else if (this._expanded === i + delta) this._expanded = i;
    this.emit(rows);
  }

  private _remove(i: number) {
    this._expanded = null;
    this.emit(this.rows.filter((_, j) => j !== i));
  }
}
