import { html } from 'lit';
import { CALENDAR, calendarEntries, calendarRows } from './calendar-fields';
import { clearAt, type Raw } from './raw-config';
import { RowList } from './row-list';

export class WallCalCalendarList extends RowList {
  static properties = {
    entities: { attribute: false },
  };

  declare entities: unknown;
  protected readonly addLabel = '+ Add calendar';
  private _cache?: { source: unknown; rows: Raw[]; originals: Map<Raw, unknown> };

  // Rows stay the same objects while the YAML list is unchanged, so untouched rows map back to their entries.
  private get _mapped() {
    if (!this._cache || this._cache.source !== this.entities) this._cache = { source: this.entities, ...calendarRows(this.entities) };
    return this._cache;
  }

  protected get rows(): Raw[] {
    return this._mapped.rows;
  }

  protected get canAdd(): boolean {
    return true;
  }

  protected newRow(): Raw {
    return {};
  }

  protected label(row: Raw): string {
    const entity = typeof row.entity === 'string' ? row.entity : '';
    const friendly = this.hass?.states?.[entity]?.attributes?.friendly_name;
    return String(row.name || friendly || entity || 'no calendar yet');
  }

  protected body(row: Raw, i: number) {
    return html`<div class="body">
      ${this.sectionForm(CALENDAR, row, i, { days: 7 })}
      ${row.color === undefined
        ? html`<span class="note">Colour: next one from the built-in palette</span>`
        : html`<button class="link reset" @click=${() => this.patch(i, (r) => clearAt(r, ['color']))}>Use default colour</button>`}
    </div>`;
  }

  protected emit(rows: Raw[]) {
    const entities = calendarEntries(rows, this._mapped.originals);
    this.dispatchEvent(new CustomEvent('entities-changed', { detail: { entities } }));
  }
}
