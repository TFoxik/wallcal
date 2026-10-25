import { LitElement, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { renderAgenda } from './components/agenda';
import type { HeaderToggle } from './components/header-toggles';
import { chipsBelow, labelLines, renderDayColumn } from './components/day-column';
import { OverlayCards, renderOverlay, renderPill } from './components/overlay-host';
import { renderTopBar } from './components/top-bar';
import { renderUpcoming } from './components/upcoming';
import { isCalendarEntityId, normalizeConfig, type HeaderTitle, type OverlayConfig, type WallCalConfig } from './config';
import { cycleInfo } from './cycle/predict';
import { cycleInputFrom, periodEntities } from './cycle/source';
import {
  cachedEvents,
  errorMessage,
  eventsForDay,
  fetchEvents,
  mergeResults,
  nextEventEnd,
  type EventCache,
} from './data/events';
import { HIDDEN_KEY, loadHidden, reloadHidden, toggleHidden } from './data/hidden';
import { upcomingEvents } from './data/upcoming';
import { isOverlayShown, loadOverlayState, pillCount, toggleOverlay, type OverlayState } from './data/overlays';
import { forecastType, sameForecast, subscribeForecast, type DayForecast } from './data/weather';
import { rangeKeyOf, WeekCache } from './data/weeks';
import { rangeDates, rangeFor } from './range';
import { addDays, dayKey, isSameDay, msUntilNextMidnight, startOfDay } from './date';
import { defineEditor } from './editor/wallcal-card-editor';
import { formatTitle, resolveHourCycle } from './format';
import type { HomeAssistant } from './ha-types';
import { resolveTokens } from './theme/presets';
import { cardStyles } from './theme/styles';
import { isSameWeek } from './week';

export class WallCalCard extends LitElement {
  static styles = cardStyles;

  static properties = {
    layout: { reflect: true },
    _config: { state: true },
    _anchor: { state: true },
    _today: { state: true },
    _cache: { state: true },
    _warning: { state: true },
    _allFailed: { state: true },
    _now: { state: true },
    _hidden: { state: true },
    _overlayState: { state: true },
    _pillCounts: { state: true },
    _periodStates: { state: true },
    _forecast: { state: true },
    _weatherWarning: { state: true },
    _more: { state: true },
    _activeKey: { state: true },
  };

  /** Set by HA: 'panel', 'grid' (sections) or 'masonry'. */
  declare layout?: string;
  declare _config?: WallCalConfig;
  declare _anchor: Date;
  declare _today: Date;
  declare _cache: EventCache | null;
  declare _warning: string | null;
  /** Every calendar failed on the last fetch and nothing is cached: an empty list would be a wrong answer. */
  declare _allFailed: boolean;
  declare _now: Date;
  declare _hidden: Set<string>;
  declare _overlayState: OverlayState;
  declare _pillCounts: string;
  declare _periodStates: string;
  declare _forecast: Map<string, DayForecast> | null;
  declare _weatherWarning: string | null;
  /** Per day key, how many timed events are below the visible part of that day's list. */
  declare _more: Map<string, number>;
  /** Agenda view: the day at the top of the list, highlighted on the strip. */
  declare _activeKey: string;

  private _hass?: HomeAssistant;
  private _seen = new Map<string, string>();
  private _weeks = new WeekCache();
  private _fetchSeq = 0;
  private _requestedRange = '';
  private _tickTimer?: ReturnType<typeof setTimeout>;
  private _endTimer?: ReturnType<typeof setTimeout>;
  private _idleTimer?: ReturnType<typeof setTimeout>;
  private _lastTouch = 0;
  private _lastListTouch = 0;
  private _scrollPending = true;
  private _weatherUnsub: Promise<() => Promise<void>> | null = null;
  private _overlayCards = new OverlayCards(() => this.requestUpdate());
  private _measureFrame?: number;
  private _agendaFrame?: number;
  /** The day last tapped on the strip, until the user scrolls the list themselves. */
  private _jumpTarget: string | null = null;
  // A resize changes how many events fit; the lists do not change size on their own otherwise.
  private _resizeObserver = new ResizeObserver(() => this._scheduleMeasure());

  constructor() {
    super();
    this._now = new Date();
    this._today = startOfDay(this._now);
    this._anchor = this._today;
    this._cache = null;
    this._warning = null;
    this._allFailed = false;
    this._hidden = loadHidden();
    this._overlayState = loadOverlayState();
    this._pillCounts = '';
    this._periodStates = '';
    this._forecast = null;
    this._weatherWarning = null;
    this._more = new Map();
    this._activeKey = dayKey(this._today);
  }

  static getConfigElement(): HTMLElement {
    defineEditor();
    return document.createElement('wallcal-card-editor');
  }

  static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    const first = Object.keys(hass?.states ?? {}).find(isCalendarEntityId);
    return { entities: [first ?? 'calendar.family'] };
  }

  setConfig(config: unknown): void {
    const previous = this._config;
    this._config = normalizeConfig(config);
    this._overlayCards.retain(new Set(this._config.overlays.map((o) => o.key)));
    // The editor re-applies the config on every keystroke; only drop the events when they would differ.
    const sameEvents = previous !== undefined && eventSource(previous) === eventSource(this._config);
    if (!sameEvents) {
      this._cache = null;
      this._allFailed = false;
      this._warning = null;
      this._weeks.clear();
      // A request still in flight was made for the old config; its response must not fill the new cache.
      this._fetchSeq++;
      this._requestedRange = '';
      this._seen.clear();
    }
    // Same goes for a working forecast subscription; a failed or missing one is retried.
    const sameWeather =
      previous?.weather?.entity === this._config.weather?.entity && this._weatherUnsub !== null && this._weatherWarning === null;
    if (!sameWeather) {
      this._unsubscribeWeather();
      this._forecast = null;
      this._weatherWarning = null;
    }
    loadFont(this._config.font_url);
    // An explicit height lets the agenda fit a pop-up or any screen instead of the dashboard's grid rows.
    this.style.height = this._fixedHeight ?? '';
    if (this.isConnected) {
      this._tick(!sameEvents);
      this._subscribeWeather();
    }
  }

  set hass(hass: HomeAssistant) {
    const previous = this._hass;
    this._hass = hass;
    this._overlayCards.hass = hass;
    // Besides calendars, only these hass changes re-render: collapsed pills' counts and the cycle's helpers.
    this._pillCounts = this._pillCountsOf(hass);
    this._periodStates = this._config ? periodEntities(this._config.period).map((id) => hass.states[id]?.state ?? '').join('|') : '';
    if (!previous || previous.locale !== hass.locale) this.requestUpdate();
    if (previous && this._calendarsChanged(hass)) void this._fetch();
    this._subscribeWeather();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  private get _fixedHeight(): string | null {
    return this._config?.view === 'agenda' ? this._config.agenda.height : null;
  }

  getCardSize(): number {
    return this._config?.view === 'upcoming' ? this._config.upcoming.count + 1 : 8;
  }

  getGridOptions(): Record<string, unknown> {
    if (this._fixedHeight) return { columns: 'full', rows: 'auto' };
    if (this._config?.view === 'upcoming') {
      // Two 56px grid rows hold the header and up to three events at the default sizes.
      const rows = this._config.upcoming.count <= 3 ? 2 : 3;
      return { columns: 'full', rows, min_rows: rows };
    }
    return { columns: 'full', rows: 8, min_rows: 6 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('storage', this._onStorage);
    // HA keeps a left view's cards alive, so a calendar hidden on another view only shows up here on return.
    this._hidden = reloadHidden(this._hidden);
    this._resizeObserver.observe(this);
    this._tick();
    this._armIdleReturn();
    this._subscribeWeather();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('storage', this._onStorage);
    clearTimeout(this._tickTimer);
    clearTimeout(this._endTimer);
    clearTimeout(this._idleTimer);
    this._resizeObserver.disconnect();
    if (this._measureFrame !== undefined) cancelAnimationFrame(this._measureFrame);
    this._measureFrame = undefined;
    if (this._agendaFrame !== undefined) cancelAnimationFrame(this._agendaFrame);
    this._agendaFrame = undefined;
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
    const days = rangeDates(rangeFor(config, this._anchor, this._today));
    const hidden = new Set(config.entities.filter((e) => e.toggle && this._hidden.has(e.entity)).map((e) => e.entity));
    const events = cachedEvents(this._cache).filter((e) => !hidden.has(e.entity));
    const { period } = config;
    const cycleInput = cycleInputFrom(period, hass.states);
    const tokens = { ...resolveTokens(config.theme, config.style), '--wallcal-days': String(days.length) };
    const labelCalendars = config.entities.filter((e) => e.display === 'label' && !hidden.has(e.entity)).map((e) => e.entity);
    const status = this._allFailed ? 'failed' : this._cache ? 'ready' : 'loading';

    if (config.view === 'agenda') {
      return html`<ha-card style=${styleMap(tokens)}>
        ${renderAgenda({
          days: days.map((date) => ({
            date,
            key: dayKey(date),
            events: eventsForDay(events, date),
            cycle: cycleInput ? cycleInfo(date, cycleInput) : null,
          })),
          today: this._today,
          activeKey: this._activeKey,
          toggles: this._allToggles(config, hidden),
          overlays: this._renderOverlays(config),
          warning: this._warning,
          status,
          agenda: config.agenda,
          labelCalendars,
          language,
          hourCycle,
          showEndTime: config.show_end_time,
          pastEvents: config.past_events,
          now: this._now,
          moon: config.moon,
          showOvulation: period.show_ovulation,
          onJump: (key) => this._jumpTo(key),
          onScroll: () => this._scheduleAgendaScroll(),
          onTouch: (event) => this._touchList(event),
        })}
      </ha-card>`;
    }

    if (config.view === 'upcoming') {
      const navigable = config.upcoming.navigation_path !== null;
      return html`<ha-card class=${navigable ? 'navigable' : ''} style=${styleMap(tokens)} @click=${() => this._open()}>
        ${renderUpcoming({
          items: upcomingEvents(events, days, this._now, config.upcoming.count, new Set(labelCalendars)),
          today: this._today,
          labels: labelLines(eventsForDay(events, this._today), labelCalendars),
          language,
          hourCycle,
          warning: this._warning,
          status,
          navigable,
        })}
      </ha-card>`;
    }

    return html`<ha-card style=${styleMap(tokens)} @pointerdown=${() => this._touch()}>
      ${renderTopBar({
        header: config.header,
        title: headerText(config.header.title, days, language),
        subtitle: headerText(config.header.subtitle, days, language),
        isCurrentWeek: this._isCurrentWeek(),
        warning: [this._warning, this._weatherWarning].filter(Boolean).join('\n') || null,
        toggles: this._allToggles(config, hidden),
        onPrev: () => this._show(addDays(this._anchor, -7)),
        onToday: () => this._show(this._today),
        onNext: () => this._show(addDays(this._anchor, 7)),
      })}
      <div
        class="grid grid--past-${config.past_days} grid--events-${config.past_events} ${cycleInput ? 'grid--cycle' : ''}"
        @pointerdown=${(event: Event) => this._touchList(event)}
        @wheel=${{ handleEvent: (event: Event) => this._touchList(event), passive: true }}
        @scroll=${{ handleEvent: () => this._scheduleMeasure(), capture: true, passive: true }}
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
            more: this._more.get(dayKey(date)) ?? 0,
          });
        })}
        ${this._renderOverlays(config)}
      </div>
    </ha-card>`;
  }

  // Brings today's next upcoming event to the top of its list. Waits until the lists have not been
  // touched for the idle time, so it never yanks a list the user is reading.
  protected updated(): void {
    const config = this._config;
    if (config?.view === 'agenda') this._returnAgendaToToday();
    if (config?.view !== 'week') return;
    this._scheduleMeasure();
    if (!this._scrollPending || !config?.auto_scroll) return;
    if (Date.now() - this._lastListTouch < (config.header.idle_return || 60) * 1000) return;
    const list = this.renderRoot.querySelector<HTMLElement>('.day--today .day__events');
    if (!list?.firstElementChild) return;
    this._scrollPending = false;
    const next = list.querySelector<HTMLElement>('.chip:not(.chip--ended)');
    list.scrollTop = next ? next.offsetTop : list.scrollHeight;
  }

  // Today is the top of the list. Like the week's auto-scroll, a tick only goes back there once the list
  // has been left alone for a minute, so it never yanks a list the user is reading.
  private _returnAgendaToToday(): void {
    if (!this._scrollPending || Date.now() - this._lastListTouch < AGENDA_IDLE_MS) return;
    const list = this.renderRoot.querySelector<HTMLElement>('.agenda__list');
    if (!list) return;
    this._scrollPending = false;
    list.scrollTop = 0;
    this._activeKey = dayKey(this._today);
  }

  private _jumpTo(key: string): void {
    const list = this.renderRoot.querySelector<HTMLElement>('.agenda__list');
    if (!list) return;
    this._lastListTouch = Date.now();
    // With one day shown, the tap picks the day; with the week, it scrolls there and the scroll picks it.
    if (this._config?.agenda.show === 'day') {
      this._activeKey = key;
      list.scrollTop = 0;
      return;
    }
    const section = list.querySelector<HTMLElement>(`.agenda__day[data-day="${key}"]`);
    if (!section) return;
    this._jumpTarget = key;
    list.scrollTop = key === dayKey(this._today) ? 0 : section.offsetTop;
    this._readAgendaScroll(list);
  }

  private _scheduleAgendaScroll(): void {
    if (this._agendaFrame !== undefined || this._config?.agenda.show === 'day') return;
    this._agendaFrame = requestAnimationFrame(() => {
      this._agendaFrame = undefined;
      const list = this.renderRoot.querySelector<HTMLElement>('.agenda__list');
      if (list) this._readAgendaScroll(list);
    });
  }

  private _readAgendaScroll(list: HTMLElement): void {
    const sections = [...list.querySelectorAll<HTMLElement>('.agenda__day')];
    if (!sections.length) return;
    // 1px of slack: layout positions are fractional and these offsets are rounded.
    const top = list.scrollTop + 1;
    const active = sections.filter((s) => s.offsetTop <= top).pop() ?? sections[0];
    // The last days can't reach the top of the list; a tapped one stays highlighted where the list stops.
    const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
    this._activeKey = atEnd && this._jumpTarget ? this._jumpTarget : active.dataset.day!;
  }

  // Counts need layout, so they are measured after the render and on every scroll. Showing a count
  // shortens its list and may hide one more event; that settles after one more render.
  private _scheduleMeasure(): void {
    if (this._measureFrame !== undefined) return;
    this._measureFrame = requestAnimationFrame(() => {
      this._measureFrame = undefined;
      const more = new Map<string, number>();
      for (const list of this.renderRoot.querySelectorAll<HTMLElement>('.day__events')) {
        const below = chipsBelow(list).length;
        if (below) more.set(list.dataset.day!, below);
      }
      if (JSON.stringify([...more]) !== JSON.stringify([...this._more])) this._more = more;
    });
  }

  private _allToggles(config: WallCalConfig, hidden: Set<string>): HeaderToggle[] {
    return [...this._toggles(config, hidden), ...this._overlayToggles(config)];
  }

  private _renderOverlays(config: WallCalConfig) {
    return repeat(config.overlays, (o) => o.key, (o) => this._renderOverlay(o));
  }

  private _toggles(config: WallCalConfig, hidden: Set<string>): HeaderToggle[] {
    return config.entities
      .filter((e) => e.toggle)
      .map((e) => ({
        label: e.name ?? stateName(this._hass, e.entity) ?? e.entity.slice('calendar.'.length),
        color: e.color,
        icon: e.icon,
        hidden: hidden.has(e.entity),
        onToggle: () => this._toggleCalendar(e.entity),
      }));
  }

  private _toggleCalendar(entity: string): void {
    this._hidden = toggleHidden(entity, this._hidden);
  }

  private _renderOverlay(overlay: OverlayConfig) {
    const shown = isOverlayShown(overlay, this._overlayState);
    const card = () => this._overlayCards.card(overlay.key, overlay.card);
    if (overlay.toggle !== 'pill') return shown ? renderOverlay(overlay, card()) : nothing;
    const label = overlay.name ?? overlayName(this._hass, overlay);
    const toggle = () => this._toggleOverlay(overlay);
    return shown
      ? renderOverlay(overlay, card(), { label, onMinimize: toggle })
      : renderPill(overlay, { label, count: pillCount(this._hass, overlay.card), onExpand: toggle });
  }

  private _pillCountsOf(hass: HomeAssistant): string {
    let counts = '';
    for (const o of this._config?.overlays ?? []) {
      if (o.toggle === 'pill' && !isOverlayShown(o, this._overlayState)) counts += `${pillCount(hass, o.card) ?? ''}|`;
    }
    return counts;
  }

  private _overlayToggles(config: WallCalConfig): HeaderToggle[] {
    return config.overlays
      .filter((o) => o.toggle === 'header')
      .map((o) => ({
        label: o.name ?? overlayName(this._hass, o),
        color: 'var(--wallcal-accent)',
        icon: o.icon,
        hidden: !isOverlayShown(o, this._overlayState),
        onToggle: () => this._toggleOverlay(o),
      }));
  }

  private _toggleOverlay(overlay: OverlayConfig): void {
    this._overlayState = toggleOverlay(overlay, this._overlayState);
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
    // HA pushes on every weather update, mostly with the same days; an equal forecast keeps the old map.
    const unsub = subscribeForecast(hass, weather.entity, type, (days) => {
      if (!sameForecast(this._forecast, days)) this._forecast = days;
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
    const { start, days } = rangeFor(config, this._anchor, this._today);
    return rangeKeyOf(start, days);
  }

  private _isCurrentWeek(): boolean {
    const config = this._config;
    return !config || config.view !== 'week' || isSameWeek(this._anchor, this._today, config.days, config.first_day);
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
    const { start, days } = rangeFor(config, this._anchor, this._today);
    const rangeKey = rangeKeyOf(start, days);
    this._requestedRange = rangeKey;
    // Runs from willUpdate on a week change, so the cached week lands in that same render.
    if (this._cache?.rangeKey !== rangeKey) {
      this._cache = this._weeks.get(rangeKey);
      // A failure in the old range says nothing about this one until it answers.
      if (!this._cache) this._allFailed = false;
    }
    for (const e of config.entities) this._seen.set(e.entity, hass.states[e.entity]?.last_changed ?? '');

    const results = await fetchEvents(hass, config.entities, start, addDays(start, days));
    // A newer request (e.g. after a quick prev/next tap) supersedes this one.
    if (seq !== this._fetchSeq) return;

    this._cache = mergeResults(this._cache, rangeKey, results);
    this._weeks.put(rangeKey, this._cache);
    const errors = results.flatMap((r) => (r.error ? [r.error] : []));
    this._warning = errors.length ? errors.join('\n') : null;
    this._allFailed = errors.length === results.length && cachedEvents(this._cache).length === 0;
    if (this.isConnected) {
      this._armEndTimer();
      if (config.view === 'week') this._weeks.prefetchAround(hass, config.entities, start, days);
    }
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

  // The overlays and pills sit inside the grid; using one must not pause auto-scroll of the day lists.
  private _touchList(event: Event): void {
    this._jumpTarget = null;
    if (!(event.target as Element).closest('.overlay, .pill')) this._lastListTouch = Date.now();
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
  private _tick = (refetch = true): void => {
    clearTimeout(this._tickTimer);
    const now = new Date();
    this._syncToday(now);
    if (refetch && !document.hidden) void this._fetch();
    this._advanceNow();
    const refresh = (this._config?.refresh_interval ?? 300) * 1000;
    this._tickTimer = setTimeout(() => this._tick(), Math.min(refresh, msUntilNextMidnight(now) + 1000));
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
    if (document.hidden) return;
    this._hidden = reloadHidden(this._hidden);
    this._tick();
  };

  private _onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === HIDDEN_KEY) this._hidden = reloadHidden(this._hidden);
  };

  // HA's own way to change view: push the path, then tell the app shell the location changed.
  private _open(): void {
    const path = this._config?.upcoming.navigation_path;
    if (this._config?.view !== 'upcoming' || !path) return;
    history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }
}

const AGENDA_IDLE_MS = 60_000;

// What cached events depend on: the range, the calendars, and the labels baked into each event.
function eventSource(config: WallCalConfig): string {
  return JSON.stringify([config.view, config.days, config.first_day, config.entities.map((e) => [e.entity, e.color, e.strip_prefix, e.suffix])]);
}

function headerText(setting: HeaderTitle, days: Date[], language: string): string | null {
  if (setting === 'none') return null;
  return typeof setting === 'string' ? formatTitle(days, setting, language) : setting.text;
}

function stateName(hass: HomeAssistant | undefined, entity: string): string | undefined {
  const name = hass?.states[entity]?.attributes?.friendly_name;
  return typeof name === 'string' && name.trim() ? name : undefined;
}

function overlayName(hass: HomeAssistant | undefined, overlay: OverlayConfig): string {
  const { title, entity, type } = overlay.card;
  if (typeof title === 'string' && title.trim()) return title;
  if (typeof entity === 'string') return stateName(hass, entity) ?? entity;
  return String(type);
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

export function suggestCard(_hass: unknown, entityId: string): { config: Record<string, unknown> } | null {
  return isCalendarEntityId(entityId) ? { config: { type: 'custom:wallcal-card', entities: [entityId] } } : null;
}

window.customCards = window.customCards ?? [];
if (!window.customCards.some((card) => card.type === 'wallcal-card')) {
  window.customCards.push({
    type: 'wallcal-card',
    name: 'WallCal',
    description: 'Week wall calendar with moon phase and cycle overlays',
    preview: true,
    documentationURL: 'https://tfoxik.github.io/wallcal/docs/',
    getEntitySuggestion: suggestCard,
  });
}

console.info(
  `%c WALLCAL %c ${__WALLCAL_VERSION__} `,
  'background:#D4537E;color:#fff;border-radius:4px 0 0 4px',
  'background:#2C2C2A;color:#fff;border-radius:0 4px 4px 0',
);
