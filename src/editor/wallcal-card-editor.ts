import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { normalizeConfig } from '../config';
import type { HomeAssistant } from '../ha-types';
import { WallCalCalendarList } from './calendar-list';
import { loadHaEditors, type HaEditorAvailability } from './ha-loader';
import { CODE_EDITOR_NOTE, WallCalOverlayList } from './overlay-list';
import { applyFormChange, clearAt, deepEqual, setAt, type Raw } from './raw-config';
import { computeHelper, formData, labelsFor, HEADER, MOON, PERIOD, STYLE, THEME, WEATHER, WEEK, type FormSchema, type SectionDef } from './sections';

const SECTIONS = [WEEK, HEADER, WEATHER, MOON, PERIOD, THEME, STYLE];

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
    _available: { state: true },
  };

  declare hass?: HomeAssistant;
  declare lovelace?: unknown;
  declare _raw: Raw;
  declare _available: HaEditorAvailability | null;
  private _cached?: { raw: Raw; view: View };

  static styles = css`
    :host { display: grid; gap: 12px; }
    ha-expansion-panel { --expansion-panel-content-padding: 0 12px 12px; }
    .note { color: var(--secondary-text-color); }
  `;

  constructor() {
    super();
    this._raw = {};
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
    if (this._cached?.raw !== this._raw) this._cached = { raw: this._raw, view: buildView(this._raw) };
    return this._cached.view;
  }

  render() {
    if (!this._available) return html`<p class="note">Loading the editor…</p>`;
    if (!this._available['ha-form']) return html`<p class="note">${CODE_EDITOR_NOTE}</p>`;
    const { error, days } = this._view;
    return html`
      ${error ? html`<ha-alert alert-type="error">${error}</ha-alert>` : nothing}
      ${this._panel('Calendars', 'mdi:calendar-multiple', true, html`<wallcal-calendar-list
          .hass=${this.hass}
          .entities=${this._raw.entities}
          @entities-changed=${this._calendars}
        ></wallcal-calendar-list>`)}
      ${[WEEK, HEADER, WEATHER, MOON, PERIOD].map((s) => this._panel(s.title, s.icon, false, this._form(s)))}
      ${this._panel('Floating cards', 'mdi:card-multiple-outline', false, html`<wallcal-overlay-list
          .hass=${this.hass}
          .lovelace=${this.lovelace}
          .overlays=${this._raw.overlays}
          .days=${days}
          .cardEditors=${this._available['hui-card-element-editor'] && this._available['hui-card-picker']}
          @overlays-changed=${this._overlays}
        ></wallcal-overlay-list>`)}
      ${this._panel('Theme & style', 'mdi:palette', false, html`${this._form(THEME)}${this._form(STYLE)}`)}
    `;
  }

  private _panel(title: string, icon: string, expanded: boolean, body: TemplateResult) {
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
    const next = applyFormChange(this._raw, section.prefix, before, e.detail.value as Raw, section.rules);
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

function buildView(raw: Raw): View {
  const days = raw.days === 5 || raw.days === '5' ? 5 : 7;
  const forms = new Map<SectionDef, { data: Raw; schema: FormSchema[] }>();
  for (const section of SECTIONS) {
    const data = formData(section, raw);
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
