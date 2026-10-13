import { LitElement, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { renderDayColumn } from './components/day-column';
import { renderTopBar } from './components/top-bar';
import { isCalendarEntityId, normalizeConfig, type WallCalConfig } from './config';
import { cycleInfo, type CycleInput } from './cycle/predict';
import { cachedEvents, eventsForDay, fetchEvents, mergeResults, type EventCache } from './data/events';
import { addDays, isSameDay, msUntilNextMidnight, startOfDay } from './date';
import { formatTitle, resolveHourCycle } from './format';
import type { HomeAssistant } from './ha-types';
import { resolveTokens } from './theme/presets';
import { cardStyles } from './theme/styles';
import { isSameWeek, weekDates, weekStart } from './week';

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
  private _requestedRange = '';
  private _tickTimer?: ReturnType<typeof setTimeout>;
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
    const first = Object.keys(hass?.states ?? {}).find(isCalendarEntityId);
    return { entities: [first ?? 'calendar.family'] };
  }

  setConfig(config: unknown): void {
    this._config = normalizeConfig(config);
    this._cache = null;
    this._requestedRange = '';
    this._seen.clear();
    loadFont(this._config.font_url);
    if (this.isConnected) this._tick();
  }

  set hass(hass: HomeAssistant) {
    const previous = this._hass;
    this._hass = hass;
    if (!previous || previous.locale !== hass.locale) this.requestUpdate();
    if (previous && this._calendarsChanged(hass)) void this._fetch();
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
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this._tick();
    this._armIdleReturn();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    clearTimeout(this._tickTimer);
    clearTimeout(this._idleTimer);
  }

  protected willUpdate(): void {
    if (this._config && this._rangeKey(this._config) !== this._requestedRange) void this._fetch();
  }

  protected render() {
    const config = this._config;
    const hass = this._hass;
    if (!config || !hass) return nothing;

    const { language } = hass.locale;
    const hourCycle = resolveHourCycle(config.time_format, hass.locale);
    const days = weekDates(this._anchor, config.days, config.first_day);
    const events = cachedEvents(this._cache);
    const { period } = config;
    const cycleInput: CycleInput | null =
      period.enabled && period.last_period
        ? { starts: [period.last_period], cycleLength: period.cycle_length, periodLength: period.period_length }
        : null;
    const tokens = { ...resolveTokens(config.theme, config.style), '--wallcal-days': String(config.days) };

    return html`<ha-card style=${styleMap(tokens)} @pointerdown=${() => this._touch()}>
      ${renderTopBar({
        header: config.header,
        title: config.header.title === 'none' ? null : formatTitle(days, config.header.title, language),
        isCurrentWeek: this._isCurrentWeek(),
        warning: this._warning,
        onPrev: () => this._show(addDays(this._anchor, -7)),
        onToday: () => this._show(this._today),
        onNext: () => this._show(addDays(this._anchor, 7)),
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
            cycle: cycleInput ? cycleInfo(date, cycleInput) : null,
            showFertile: period.show_fertile,
            showOvulation: period.show_ovulation,
          }),
        )}
      </div>
    </ha-card>`;
  }

  private _rangeKey(config: WallCalConfig): string {
    const start = weekStart(this._anchor, config.days, config.first_day);
    return `${start.getTime()}-${addDays(start, config.days).getTime()}`;
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
    const rangeKey = this._rangeKey(config);
    this._requestedRange = rangeKey;
    const start = weekStart(this._anchor, config.days, config.first_day);
    for (const e of config.entities) this._seen.set(e.entity, hass.states[e.entity]?.last_changed ?? '');

    const results = await fetchEvents(hass, config.entities, start, addDays(start, config.days));
    // A newer request (e.g. after a quick prev/next tap) supersedes this one.
    if (seq !== this._fetchSeq) return;

    this._cache = mergeResults(this._cache, rangeKey, results);
    const errors = results.flatMap((r) => (r.error ? [r.error] : []));
    this._warning = errors.length ? errors.join('\n') : null;
  }

  private _show(anchor: Date): void {
    this._anchor = anchor;
    this._touch();
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
      if (!this._isCurrentWeek()) this._anchor = this._today;
    }, remaining);
  }

  // Timers do not run while the card is detached or the device sleeps, so every tick, and every
  // reconnect or wake-up, re-derives today from the clock instead of trusting the last timer.
  private _tick = (): void => {
    clearTimeout(this._tickTimer);
    const now = new Date();
    this._syncToday(now);
    if (!document.hidden) void this._fetch();
    const refresh = (this._config?.refresh_interval ?? 300) * 1000;
    this._tickTimer = setTimeout(this._tick, Math.min(refresh, msUntilNextMidnight(now) + 1000));
  };

  private _syncToday(now: Date): void {
    if (isSameDay(now, this._today)) return;
    const followToday = this._isCurrentWeek();
    this._today = startOfDay(now);
    if (followToday) this._anchor = this._today;
  }

  private _onVisibilityChange = (): void => {
    if (!document.hidden) this._tick();
  };
}

const loadedFonts = new Set<string>();

function loadFont(url: string | null): void {
  if (!url || loadedFonts.has(url)) return;
  loadedFonts.add(url);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
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
