import { LitElement, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { CalendarToggle } from './components/calendar-toggles';
import { renderDayColumn } from './components/day-column';
import { renderTopBar } from './components/top-bar';
import { isCalendarEntityId, normalizeConfig, type HeaderTitle, type WallCalConfig } from './config';
import { cycleInfo, type CycleInput } from './cycle/predict';
import {
  cachedEvents,
  errorMessage,
  eventsForDay,
  fetchEvents,
  mergeResults,
  nextEventEnd,
  type EventCache,
} from './data/events';
import { loadHidden, toggleHidden } from './data/hidden';
import { forecastType, subscribeForecast, type DayForecast } from './data/weather';
import { addDays, dayKey, isSameDay, msUntilNextMidnight, startOfDay } from './date';
import { formatTitle, resolveHourCycle } from './format';
import type { HomeAssistant } from './ha-types';
import { resolveTokens } from './theme/presets';
import { cardStyles } from './theme/styles';
import { isSameWeek, weekDates, weekStart } from './week';

export class WallCalCard extends LitElement {
  static styles = cardStyles;

  static properties = {
    layout: { reflect: true },
    _config: { state: true },
    _anchor: { state: true },
    _today: { state: true },
    _cache: { state: true },
    _warning: { state: true },
    _now: { state: true },
    _hidden: { state: true },
    _forecast: { state: true },
    _weatherWarning: { state: true },
  };

  /** Set by HA: 'panel', 'grid' (sections) or 'masonry'. */
  declare layout?: string;
  declare _config?: WallCalConfig;
  declare _anchor: Date;
  declare _today: Date;
  declare _cache: EventCache | null;
  declare _warning: string | null;
  declare _now: Date;
  declare _hidden: Set<string>;
  declare _forecast: Map<string, DayForecast> | null;
  declare _weatherWarning: string | null;

  private _hass?: HomeAssistant;
  private _seen = new Map<string, string>();
  private _fetchSeq = 0;
  private _requestedRange = '';
  private _tickTimer?: ReturnType<typeof setTimeout>;
  private _endTimer?: ReturnType<typeof setTimeout>;
  private _idleTimer?: ReturnType<typeof setTimeout>;
  private _lastTouch = 0;
  private _lastListTouch = 0;
  private _scrollPending = true;
  private _weatherUnsub: Promise<() => Promise<void>> | null = null;

  constructor() {
    super();
    this._now = new Date();
    this._today = startOfDay(this._now);
    this._anchor = this._today;
    this._cache = null;
    this._warning = null;
    this._hidden = loadHidden();
    this._forecast = null;
    this._weatherWarning = null;
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
    this._unsubscribeWeather();
    this._forecast = null;
    this._weatherWarning = null;
    loadFont(this._config.font_url);
    if (this.isConnected) {
      this._tick();
      this._subscribeWeather();
    }
  }

  set hass(hass: HomeAssistant) {
    const previous = this._hass;
    this._hass = hass;
    if (!previous || previous.locale !== hass.locale) this.requestUpdate();
    if (previous && this._calendarsChanged(hass)) void this._fetch();
    this._subscribeWeather();
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
    this._subscribeWeather();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    clearTimeout(this._tickTimer);
    clearTimeout(this._endTimer);
    clearTimeout(this._idleTimer);
    this._unsubscribeWeather();
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
    const hidden = new Set(config.entities.filter((e) => e.toggle && this._hidden.has(e.entity)).map((e) => e.entity));
    const events = cachedEvents(this._cache).filter((e) => !hidden.has(e.entity));
    const { period } = config;
    const cycleInput: CycleInput | null =
      period.enabled && period.last_period
        ? { starts: [period.last_period], cycleLength: period.cycle_length, periodLength: period.period_length }
        : null;
    const tokens = { ...resolveTokens(config.theme, config.style), '--wallcal-days': String(config.days) };
    const labelCalendars = config.entities.filter((e) => e.display === 'label' && !hidden.has(e.entity)).map((e) => e.entity);

    return html`<ha-card style=${styleMap(tokens)} @pointerdown=${() => this._touch()}>
      ${renderTopBar({
        header: config.header,
        title: headerText(config.header.title, days, language),
        subtitle: headerText(config.header.subtitle, days, language),
        isCurrentWeek: this._isCurrentWeek(),
        warning: [this._warning, this._weatherWarning].filter(Boolean).join('\n') || null,
        toggles: this._toggles(config, hidden),
        onToggle: (entity) => this._toggleCalendar(entity),
        onPrev: () => this._show(addDays(this._anchor, -7)),
        onToday: () => this._show(this._today),
        onNext: () => this._show(addDays(this._anchor, 7)),
      })}
      <div
        class="grid grid--past-${config.past_days} grid--events-${config.past_events} ${cycleInput ? 'grid--cycle' : ''}"
        @pointerdown=${() => this._touchList()}
        @wheel=${{ handleEvent: () => this._touchList(), passive: true }}
      >
        ${days.map((date) => {
          const isToday = isSameDay(date, this._today);
          return renderDayColumn({
            date,
            isToday,
            events: eventsForDay(events, date),
            language,
            hourCycle,
            moon: config.moon,
            cycle: cycleInput ? cycleInfo(date, cycleInput) : null,
            showFertile: period.show_fertile,
            showOvulation: period.show_ovulation,
            showEndTime: config.show_end_time,
            isPast: date.getTime() < this._today.getTime(),
            now: isToday ? this._now : null,
            weather: this._forecast?.get(dayKey(date)) ?? null,
            showLow: config.weather?.show_low ?? true,
            weekdayFormat: config.weekday_format,
            labelCalendars,
            weatherRow: config.weather !== null,
            markersInInfo: config.weather !== null && (config.moon.enabled || cycleInput !== null),
          });
        })}
      </div>
    </ha-card>`;
  }

  // Brings today's next upcoming event to the top of its list. Waits until the lists have not been
  // touched for the idle time, so it never yanks a list the user is reading.
  protected updated(): void {
    const config = this._config;
    if (!this._scrollPending || !config?.auto_scroll) return;
    if (Date.now() - this._lastListTouch < (config.header.idle_return || 60) * 1000) return;
    const list = this.renderRoot.querySelector<HTMLElement>('.day--today .day__events');
    if (!list?.firstElementChild) return;
    this._scrollPending = false;
    const next = list.querySelector<HTMLElement>('.chip:not(.chip--ended)');
    list.scrollTop = next ? next.offsetTop : list.scrollHeight;
  }

  private _toggles(config: WallCalConfig, hidden: Set<string>): CalendarToggle[] {
    return config.entities
      .filter((e) => e.toggle)
      .map((e) => ({
        entity: e.entity,
        label: e.name ?? friendlyName(this._hass, e.entity),
        color: e.color,
        icon: e.icon,
        hidden: hidden.has(e.entity),
      }));
  }

  private _toggleCalendar(entity: string): void {
    this._hidden = toggleHidden(entity);
  }

  private _subscribeWeather(): void {
    const weather = this._config?.weather;
    const hass = this._hass;
    if (!weather || !hass || !this.isConnected || this._weatherUnsub) return;
    const type = forecastType(hass.states[weather.entity]);
    if (!type) {
      this._weatherWarning = `${weather.entity}: no daily forecast available`;
      return;
    }
    this._weatherWarning = null;
    const unsub = subscribeForecast(hass, weather.entity, type, (days) => {
      this._forecast = days;
    });
    this._weatherUnsub = unsub;
    // A failed subscription stays in _weatherUnsub so the frequent hass updates do not retry it;
    // reattaching or reconfiguring the card tries again.
    unsub.catch((error: unknown) => {
      if (this._weatherUnsub === unsub) this._weatherWarning = `${weather.entity}: ${errorMessage(error)}`;
    });
  }

  private _unsubscribeWeather(): void {
    const unsub = this._weatherUnsub;
    this._weatherUnsub = null;
    unsub?.then((stop) => stop()).catch(() => undefined);
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
    if (this.isConnected) this._armEndTimer();
  }

  private _show(anchor: Date): void {
    this._anchor = anchor;
    this._scrollPending = true;
    this._touch();
  }

  private _touch(): void {
    this._lastTouch = Date.now();
    this._armIdleReturn();
  }

  private _touchList(): void {
    this._lastListTouch = Date.now();
    this._touch();
  }

  private _armIdleReturn(): void {
    clearTimeout(this._idleTimer);
    const seconds = this._config?.header.idle_return ?? 0;
    if (seconds <= 0 || this._isCurrentWeek()) return;
    const remaining = Math.max(0, this._lastTouch + seconds * 1000 - Date.now());
    this._idleTimer = setTimeout(() => {
      if (!this._isCurrentWeek()) this._show(this._today);
    }, remaining);
  }

  // Timers do not run while the card is detached or the device sleeps, so every tick, and every
  // reconnect or wake-up, re-derives today from the clock instead of trusting the last timer.
  private _tick = (): void => {
    clearTimeout(this._tickTimer);
    const now = new Date();
    this._syncToday(now);
    if (!document.hidden) void this._fetch();
    this._advanceNow();
    const refresh = (this._config?.refresh_interval ?? 300) * 1000;
    this._tickTimer = setTimeout(this._tick, Math.min(refresh, msUntilNextMidnight(now) + 1000));
  };

  private _advanceNow = (): void => {
    this._now = new Date();
    this._scrollPending = true;
    this._armEndTimer();
  };

  // Wakes when an event ends today so it dims or disappears on time, without refetching.
  private _armEndTimer(): void {
    clearTimeout(this._endTimer);
    const now = new Date();
    const end = nextEventEnd(cachedEvents(this._cache), now);
    if (end) this._endTimer = setTimeout(this._advanceNow, end.getTime() - now.getTime() + 1000);
  }

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

function headerText(setting: HeaderTitle, days: Date[], language: string): string | null {
  if (setting === 'none') return null;
  return typeof setting === 'string' ? formatTitle(days, setting, language) : setting.text;
}

function friendlyName(hass: HomeAssistant | undefined, entity: string): string {
  const name = hass?.states[entity]?.attributes?.friendly_name;
  return typeof name === 'string' && name.trim() ? name : entity.slice('calendar.'.length);
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
