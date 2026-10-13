import { LitElement, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { renderDayColumn } from './components/day-column';
import { renderTopBar } from './components/top-bar';
import { normalizeConfig, type WallCalConfig } from './config';
import { cycleInfo, type CycleInput } from './cycle/predict';
import { cachedEvents, eventsForDay, fetchEvents, mergeResults, type EventCache } from './data/events';
import { addDays, isSameDay, msUntilNextMidnight, startOfDay } from './date';
import { formatTitle, resolveHourCycle } from './format';
import type { HomeAssistant } from './ha-types';
import { resolveTokens } from './theme/presets';
import { cardStyles } from './theme/styles';
import { isSameWeek, weekDates } from './week';

export class WallCalCard extends LitElement {
  static styles = cardStyles;

  static properties = {
    _config: { state: true },
    _anchor: { state: true },
    _today: { state: true },
    _cache: { state: true },
    _warning: { state: true },
  };

  declare _config?: WallCalConfig;
  declare _anchor: Date;
  declare _today: Date;
  declare _cache: EventCache | null;
  declare _warning: string | null;

  private _hass?: HomeAssistant;
  private _seen = new Map<string, string>();
  private _fetchSeq = 0;
  private _refreshTimer?: ReturnType<typeof setInterval>;
  private _midnightTimer?: ReturnType<typeof setTimeout>;
  private _idleTimer?: ReturnType<typeof setTimeout>;
  private _lastTouch = 0;

  constructor() {
    super();
    this._today = startOfDay(new Date());
    this._anchor = this._today;
    this._cache = null;
    this._warning = null;
  }

  static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    const first = Object.keys(hass?.states ?? {}).find((id) => id.startsWith('calendar.'));
    return { entities: [first ?? 'calendar.family'] };
  }

  setConfig(config: unknown): void {
    this._config = normalizeConfig(config);
    this._cache = null;
    this._seen.clear();
    loadFont(this._config.font_url);
    if (this.isConnected) {
      this._restartRefresh();
      void this._fetch();
    }
  }

  set hass(hass: HomeAssistant) {
    const previous = this._hass;
    this._hass = hass;
    if (!previous || previous.locale !== hass.locale) this.requestUpdate();
    if (!previous || this._calendarsChanged(hass)) void this._fetch();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  getCardSize(): number {
    return 8;
  }

  getGridOptions(): Record<string, unknown> {
    return { columns: 'full', rows: 8, min_rows: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._syncToday();
    this._restartRefresh();
    this._armMidnight();
    this._armIdleReturn();
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    void this._fetch();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._refreshTimer);
    clearTimeout(this._midnightTimer);
    clearTimeout(this._idleTimer);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }

  protected render() {
    const config = this._config;
    const hass = this._hass;
    if (!config || !hass) return nothing;

    const language = hass.locale?.language ?? 'en';
    const hourCycle = resolveHourCycle(config.time_format, hass.locale ?? { language, time_format: 'language' });
    const days = weekDates(this._anchor, config.days, config.first_day);
    const events = cachedEvents(this._cache);
    const cycleInput: CycleInput | null =
      config.period.enabled && config.period.last_period
        ? {
            starts: [config.period.last_period],
            cycleLength: config.period.cycle_length,
            periodLength: config.period.period_length,
          }
        : null;
    const tokens = { ...resolveTokens(config.theme, config.style), '--wallcal-days': String(config.days) };

    return html`<ha-card style=${styleMap(tokens)} @pointerdown=${() => this._touch()}>
      ${renderTopBar({
        header: config.header,
        title: config.header.title === 'none' ? '' : formatTitle(days, config.header.title, language),
        isCurrentWeek: this._isCurrentWeek(),
        warning: this._warning,
        onPrev: () => this._go(-7),
        onToday: () => this._go(null),
        onNext: () => this._go(7),
      })}
      <div class="grid">
        ${days.map((date) =>
          renderDayColumn({
            date,
            isToday: isSameDay(date, this._today),
            events: eventsForDay(events, date),
            language,
            hourCycle,
            moon: config.moon,
            period: config.period,
            cycle: cycleInput ? cycleInfo(date, cycleInput) : null,
          }),
        )}
      </div>
    </ha-card>`;
  }

  private _isCurrentWeek(): boolean {
    const config = this._config;
    return !config || isSameWeek(this._anchor, this._today, config.days, config.first_day);
  }

  private _calendarsChanged(hass: HomeAssistant): boolean {
    return (
      this._config?.entities.some(
        (e) => this._seen.get(e.entity) !== (hass.states[e.entity]?.last_changed ?? ''),
      ) ?? false
    );
  }

  private async _fetch(): Promise<void> {
    const config = this._config;
    const hass = this._hass;
    if (!config || !hass || !this.isConnected) return;

    const seq = ++this._fetchSeq;
    const days = weekDates(this._anchor, config.days, config.first_day);
    const start = days[0];
    const end = addDays(days[days.length - 1], 1);
    for (const e of config.entities) this._seen.set(e.entity, hass.states[e.entity]?.last_changed ?? '');

    const results = await fetchEvents(hass, config.entities, start, end);
    // A newer request (e.g. after a quick prev/next tap) supersedes this one.
    if (seq !== this._fetchSeq) return;

    this._cache = mergeResults(this._cache, `${start.getTime()}-${end.getTime()}`, results);
    const errors = results.flatMap((r) => (r.error ? [r.error] : []));
    this._warning = errors.length ? errors.join('\n') : null;
  }

  private _go(deltaDays: number | null): void {
    this._anchor = deltaDays === null ? this._today : addDays(this._anchor, deltaDays);
    this._touch();
    void this._fetch();
  }

  private _touch(): void {
    this._lastTouch = Date.now();
    this._armIdleReturn();
  }

  private _armIdleReturn(): void {
    clearTimeout(this._idleTimer);
    const seconds = this._config?.header.idle_return ?? 0;
    if (seconds <= 0 || this._isCurrentWeek()) return;
    const remaining = Math.max(0, this._lastTouch + seconds * 1000 - Date.now());
    this._idleTimer = setTimeout(() => {
      if (this._isCurrentWeek()) return;
      this._anchor = this._today;
      void this._fetch();
    }, remaining);
  }

  private _restartRefresh(): void {
    clearInterval(this._refreshTimer);
    if (!this._config) return;
    this._refreshTimer = setInterval(() => {
      this._syncToday();
      void this._fetch();
    }, this._config.refresh_interval * 1000);
  }

  // Timers do not run while the card is detached or the device sleeps, so the date is
  // re-checked whenever the card could have missed midnight.
  private _syncToday(): boolean {
    const today = startOfDay(new Date());
    if (today.getTime() === this._today.getTime()) return false;
    const followToday = this._isCurrentWeek();
    this._today = today;
    if (followToday) this._anchor = today;
    return true;
  }

  private _onVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') return;
    this._armMidnight();
    if (this._syncToday()) void this._fetch();
  };

  private _armMidnight(): void {
    clearTimeout(this._midnightTimer);
    this._midnightTimer = setTimeout(() => this._onMidnight(), msUntilNextMidnight(new Date()) + 1000);
  }

  private _onMidnight(): void {
    this._syncToday();
    this._armMidnight();
    void this._fetch();
  }
}

function loadFont(url: string | null): void {
  if (!url) return;
  const existing = [...document.head.querySelectorAll<HTMLLinkElement>('link[data-wallcal-font]')];
  if (existing.some((link) => link.dataset.wallcalFont === url)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.wallcalFont = url;
  document.head.append(link);
}

if (!customElements.get('wallcal-card')) customElements.define('wallcal-card', WallCalCard);

window.customCards = window.customCards ?? [];
if (!window.customCards.some((card) => card.type === 'wallcal-card')) {
  window.customCards.push({
    type: 'wallcal-card',
    name: 'WallCal',
    description: 'Week wall calendar with moon phase and cycle overlays',
    preview: false,
  });
}

console.info(
  `%c WALLCAL %c ${__WALLCAL_VERSION__} `,
  'background:#D4537E;color:#fff;border-radius:4px 0 0 4px',
  'background:#2C2C2A;color:#fff;border-radius:0 4px 4px 0',
);
