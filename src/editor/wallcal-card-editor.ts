import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { normalizeConfig } from '../config';
import type { HomeAssistant } from '../ha-types';
import { WallCalCalendarList } from './calendar-list';
import { loadHaEditors, type HaEditorAvailability } from './ha-loader';
import { CODE_EDITOR_NOTE, WallCalOverlayList } from './overlay-list';
import { applyFormChange, clearAt, deepEqual, setAt, type Raw } from './raw-config';
import { computeHelper, formData, labelsFor, AGENDA, HEADER, MOON, PERIOD, STYLE, THEME, UPCOMING, VIEW, WEATHER, WEEK, type FormSchema, type SectionDef } from './sections';

const SECTIONS = [VIEW, UPCOMING, AGENDA, WEEK, HEADER, WEATHER, MOON, PERIOD, THEME, STYLE];
const WEEK_ONLY = [HEADER, WEATHER];
// The view's own options, shown under the View field.
const VIEW_FORMS: Record<string, SectionDef> = { upcoming: UPCOMING, agenda: AGENDA };

/** What the forms show for one raw config; rebuilt only when the config changes, not on every hass update. */
interface View {
  error: string | null;
  days: number;
  forms: Map<SectionDef, { data: Raw; schema: FormSchema[] }>;
}

export class WallCalCardEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    lovelace: { attribute: false },
    _raw: { state: true },
    _ui: { state: true },
    _available: { state: true },
  };

  declare hass?: HomeAssistant;
  declare lovelace?: unknown;
  declare _raw: Raw;
  /** Form-only fields (SectionDef.kept): what the user chose that the YAML can't show. */
  declare _ui: Raw;
  declare _available: HaEditorAvailability | null;
  private _cached?: { raw: Raw; ui: Raw; view: View };

  static styles = css`
    :host { display: grid; gap: 12px; }
    ha-expansion-panel { --expansion-panel-content-padding: 0 12px 12px; }
    .note { color: var(--secondary-text-color); }
  `;

  constructor() {
    super();
    this._raw = {};
    this._ui = {};
    this._available = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void loadHaEditors().then((available) => (this._available = available));
  }

  setConfig(config: Raw): void {
    if (!deepEqual(config, this._raw)) this._raw = config;
  }

  private get _view(): View {
    if (this._cached?.raw !== this._raw || this._cached.ui !== this._ui) {
      this._cached = { raw: this._raw, ui: this._ui, view: buildView(this._raw, this._ui) };
    }
    return this._cached.view;
  }

  render() {
    if (!this._available) return html`<p class="note">Loading the editor…</p>`;
    if (!this._available['ha-form']) return html`<p class="note">${CODE_EDITOR_NOTE}</p>`;
    const { error, days } = this._view;
    const view = this._view.forms.get(VIEW)!.data.view;
    // The top bar and weather belong to the week grid; the small upcoming card has no room for floating cards either.
    const week = view === 'week';
    return html`
      ${error ? html`<ha-alert alert-type="error">${error}</ha-alert>` : nothing}
      ${this._panel('Calendars', 'mdi:calendar-multiple', true, html`<wallcal-calendar-list
          .hass=${this.hass}
          .entities=${this._raw.entities}
          @entities-changed=${this._calendars}
        ></wallcal-calendar-list>`)}
      ${this._panel('View', 'mdi:cellphone', false, html`${this._form(VIEW)}${VIEW_FORMS[view as string] ? this._form(VIEW_FORMS[view as string]) : nothing}`)}
      ${[WEEK, HEADER, WEATHER, MOON, PERIOD].map((s) => this._panel(s.title, s.icon, false, this._form(s), week || !WEEK_ONLY.includes(s)))}
      ${view !== 'upcoming' ? this._panel('Floating cards', 'mdi:card-multiple-outline', false, html`<wallcal-overlay-list
          .hass=${this.hass}
          .lovelace=${this.lovelace}
          .overlays=${this._raw.overlays}
          .days=${days}
          .cardEditors=${this._available['hui-card-element-editor'] && this._available['hui-card-picker']}
          @overlays-changed=${this._overlays}
        ></wallcal-overlay-list>`) : nothing}
      ${this._panel('Theme & style', 'mdi:palette', false, html`${this._form(THEME)}${this._form(STYLE)}`)}
    `;
  }

  private _panel(title: string, icon: string, expanded: boolean, body: TemplateResult, shown = true) {
    if (!shown) return nothing;
    return html`<ha-expansion-panel outlined .header=${title} .expanded=${expanded}>
      <ha-icon slot="leading-icon" icon=${icon}></ha-icon>
      ${body}
    </ha-expansion-panel>`;
  }

  private _form(section: SectionDef) {
    const { data, schema } = this._view.forms.get(section)!;
    return html`<ha-form
      .hass=${this.hass}
      .data=${data}
      .schema=${schema}
      .computeLabel=${labelsFor(section)}
      .computeHelper=${computeHelper}
      @value-changed=${(e: CustomEvent) => this._section(section, data, e)}
    ></ha-form>`;
  }

  private _section(section: SectionDef, before: Raw, e: CustomEvent) {
    e.stopPropagation();
    const value = e.detail.value as Raw;
    const after = section.adjust ? section.adjust(before, value) : value;
    const ui = { ...this._ui };
    for (const key of section.kept ?? []) ui[key] = after[key];
    if (!deepEqual(ui, this._ui)) this._ui = ui;
    const next = applyFormChange(this._raw, section.prefix, before, after, section.rules);
    this._commit(section.finalize && next !== this._raw ? section.finalize(next) : next);
  }

  private _calendars = (e: CustomEvent) => {
    this._commit(setAt(this._raw, ['entities'], e.detail.entities as unknown[]));
  };

  private _overlays = (e: CustomEvent) => {
    const overlays = e.detail.overlays as unknown[];
    this._commit(overlays.length ? setAt(this._raw, ['overlays'], overlays) : clearAt(this._raw, ['overlays']));
  };

  private _commit(next: Raw) {
    if (deepEqual(next, this._raw)) return;
    this._raw = next;
    if (!this._view.error) this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next }, bubbles: true, composed: true }));
  }
}

function buildView(raw: Raw, ui: Raw): View {
  const days = raw.days === 5 || raw.days === '5' ? 5 : 7;
  const forms = new Map<SectionDef, { data: Raw; schema: FormSchema[] }>();
  for (const section of SECTIONS) {
    const data = formData(section, raw, ui);
    forms.set(section, { data, schema: section.schema(data, { days }) });
  }
  return { error: validate(raw), days, forms };
}

function validate(raw: Raw): string | null {
  try {
    normalizeConfig(raw);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function defineEditor(): void {
  if (!customElements.get('wallcal-calendar-list')) customElements.define('wallcal-calendar-list', WallCalCalendarList);
  if (!customElements.get('wallcal-overlay-list')) customElements.define('wallcal-overlay-list', WallCalOverlayList);
  if (!customElements.get('wallcal-card-editor')) customElements.define('wallcal-card-editor', WallCalCardEditor);
}
