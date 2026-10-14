# WallCal — design spec (v1)

Date: 2026-10-13
Status: draft, awaiting review

## 1. Purpose

WallCal is a custom Home Assistant Lovelace card meant to be an always-on wall calendar on a
landscape wall tablet. It must be readable from across a room, look clean and minimal
(Mushroom-like), and be fully themable: fonts, sizes, colours.

Two optional, independent overlays set it apart:

- **Moon phase** — an icon per day drawn to the actual illumination, optional phase name.
- **Period / cycle** — expected period days, fertile window, ovulation day, cycle-day ring.

Success for v1: mounted on the tablet, it shows the current week's events from the household's
HA calendars, looks good with zero styling config, and can be restyled entirely from YAML.

## 2. Scope

### In v1
- Week view only: 7 days starting on `first_day`, or 5 days Mon–Fri.
- Events from one or more `calendar.*` entities, each with its own colour.
- Agenda-stack day columns (all-day events on top, then timed events by start time).
- Configurable top bar: title, prev / today / next navigation, idle return to current week.
- 12h / 24h / auto time format.
- Moon overlay (optional).
- Period overlay (optional) with independently optional fertile window and ovulation.
- Theme: HA theme variables → preset → per-token overrides.
- YAML configuration only.
- HACS distribution as a single bundled JS file.

### Not in v1
Month or day views, visual config editor, creating or editing events, weather, learned cycle
prediction, companion integration. See `ROADMAP.md`.

## 3. Architecture

A single frontend-only Lit + TypeScript custom element, `wallcal-card`. Everything except
calendar events is computed in the browser by pure functions.

Moon phase is computed client-side because HA's `sensor.moon` exposes only today's phase; a week
view needs a phase for every visible day.

A companion Python integration was considered and rejected for v1. It becomes worthwhile only if
predicted dates should drive HA automations (e.g. a reminder the day before an expected period).

### Units

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `config.ts` | Config types, defaults, normalisation, validation. Throws on invalid config. | — |
| `week.ts` | Visible dates for an anchor date, `days`, `first_day`. | — |
| `astro/moon.ts` | `moonPhase(date)` → `{ age, illumination, waxing, phase }`. | — |
| `cycle/predict.ts` | `cycleInfo(date, input)` → `{ day, length, isPeriod, isFertile, isOvulation }` or `null`. | — |
| `data/events.ts` | Fetch events for a date range from HA, normalise to `WallCalEvent`. | `hass` |
| `format.ts` | Locale-aware date and time formatting (hour cycle from config / HA profile). | — |
| `theme/presets.ts` | Preset name → token map. | — |
| `theme/styles.ts` | Base CSS built on `--wallcal-*` custom properties. | — |
| `components/top-bar.ts` | Title + navigation slots. | `format` |
| `components/day-column.ts` | Day header (ring, date, weekday, moon, period markers) + event stack. | below |
| `components/event-chip.ts` | One event. | `format` |
| `components/cycle-ring.ts` | SVG progress arc around the date number. | — |
| `components/moon-icon.ts` | SVG disc with terminator path from illumination. | — |
| `wallcal-card.ts` | Element shell: `setConfig`, `hass` setter, state, fetch scheduling, layout. | all |

The pure units (`config`, `week`, `moon`, `cycle`, `format`) have no Lit or HA dependency and are
unit-tested in isolation.

`cycle/predict.ts` takes a plain input `{ starts: Date[], cycleLength, periodLength }`. In v1 the
card fills it from config (`starts = [last_period]`). Learned prediction later only changes how
that input is produced.

## 4. Behaviour

### 4.1 Week range
- `days: 7` — 7 consecutive days starting on the most recent `first_day` on or before the anchor.
- `days: 5` — Monday to Friday of the anchor's week. `first_day` is ignored. On Saturday and
  Sunday the coming Monday–Friday is shown: on a wall, the weekend looks ahead.
- Anchor defaults to today. Prev / next shift the anchor by 7 days; today resets it.
- Day arithmetic is done on local calendar dates (year, month, day), never by adding 86 400 000 ms,
  so DST transitions cannot skip or duplicate a day.

### 4.2 Events
- Endpoint: `hass.callApi('GET', 'calendars/<entity_id>?start=<iso>&end=<iso>')` for the
  visible range, one request per entity, in parallel.
- All-day events (`start.date`) and timed events (`start.dateTime`) are normalised into
  `WallCalEvent { entity, title, start, end, allDay, color }`.
- Multi-day events appear on every visible day they cover. Timed events that started on a previous
  day show "continues" instead of a start time.
- Sort: all-day first, then by start time, then by title.
- Refresh triggers: config change, week navigation, refresh interval (`refresh_interval`, default
  300 s), and any configured entity's `last_changed` differing from the value seen at last fetch.
  The `hass` setter alone never triggers a fetch: HA sets it many times per second.
- On failure: keep the last good data, show a warning icon in the top bar (title attribute holds
  the error message), retry on the next trigger.
- Day header: a top row (date or cycle ring; weekday with the weather under it, or the moon and
  period markers when weather is not configured) and an info block: one 18px line per visible label
  calendar (config order), with the markers on the right of the first line when weather took their
  place. The forecast slot, label lines and marker slot are kept on days without content, and a
  bare date takes the ring's footprint on days before the first period, so every header in the week
  has the same height and each calendar keeps its line. Beside the labels the moon shows its icon
  only (no `show_name` text). Old WebViews (Chrome 87) lack subgrid, so equal height comes from this
  fixed structure rather than from aligning rows across columns.
- With weather, the weekday block has a flex basis of five weekday-font widths (75px at 15px) and the
  top row may wrap: below about 1130px card width (7 days) weekday and forecast sit under the ring.
  The fixed basis makes every column wrap at the same width; Chrome 87 has no container queries.
- Calendars with `display: label` (e.g. Czech and Slovak name days) render their event titles on
  their own coloured header line instead of as chips, `·`-separated, truncated with an ellipsis. At
  most two entities may use it. `strip_prefix` drops a leading text such as `Svátek:` from that
  calendar's titles; `suffix` appends a small muted tag such as `SK` (on chips too). Hiding a label
  calendar with its toggle chip removes its line.
- All-day chips are compact: 4px vertical padding, one line, `allday_size` font.
- Layout: all-day events are pinned under the day header; timed events scroll in their own list
  when they overflow. A day whose list hides events below the visible part shows a muted `+N more` line
  under it, counting chips not fully in view; it follows the scroll position and the card size, and
  tapping it scrolls the first hidden event to the top. The count needs layout, so the card measures
  it in an animation frame after each render, scroll and resize. In a panel view the card sizes itself to
  `100vh − --header-height` (HA sets `layout = 'panel'` on the card; it is reflected to an
  attribute), because the panel wrapper has auto height and `100%` would grow with the events. In
  sections the grid row height bounds it; in masonry the card grows with its content.
- `past_events: show | dim | hide` applies to today's timed events that have ended (all-day events
  never count as ended; earlier days are covered by `past_days`). A separate timer wakes at the
  next event end today and re-renders without refetching, so the change happens on time.
- `auto_scroll` (default true) scrolls today's list so the first event that has not ended is at the
  top: on load, every refresh, and on returning to the current week, but only once the day lists
  have not been touched or wheel-scrolled for `header.idle_return` seconds (60 when that is 0).

### 4.2a Calendar toggles
- An entity with `toggle: true` gets a round chip in the top bar's end slot, filled with the
  entity colour and showing `icon` (via HA's `ha-icon`) or the first letter of `name`, falling
  back to the entity's `friendly_name`. Tapping it hides or shows that calendar's events.
- Hidden calendars are stored per device in `localStorage` (`wallcal:hidden-calendars`, a list of
  entity ids shared by every card). A card only applies the list to calendars it has a chip for.
- Hidden calendars are still fetched, so showing them again is instant.
- Chips live in the top bar and are not shown with `header.show: false`.

### 4.2b Weather
- `weather.entity` subscribes to `weather/subscribe_forecast` over the HA websocket, `daily` when
  the entity supports it, else `twice_daily` (day and night halves merged per date). Entities with
  only an hourly forecast show a warning instead.
- Each day with a forecast shows the condition icon (`mdi:weather-*` via `ha-icon`) and the rounded
  high, plus `/low` unless `weather.show_low: false`, under the weekday at weekday size (22px icon).
- The subscription is dropped when the card is detached or reconfigured; HA's websocket library
  resubscribes it after a reconnect. A failed subscription shows a warning and is retried only when
  the card is reattached or reconfigured, not on every `hass` update.

### 4.3 Time format
`time_format: 12 | 24 | auto`. `auto` uses `hass.locale.time_format` (`12`, `24`, `language`,
`system`). Formatting goes through `Intl.DateTimeFormat(hass.locale.language, { hourCycle })`.
Times shown in browser local time.

### 4.4 Moon
- Mean synodic month 29.530588853 days, reference new moon 2000-01-06 18:14 UTC, evaluated at
  local noon of each day. Expected error up to about half a day: fine for an icon.
- `illumination = (1 − cos(2π · age / synodic)) / 2`.
- Phase name from 8 buckets centred on new, first quarter, full, last quarter.
- Icon: SVG disc. The lit part is drawn as a half circle plus an elliptical terminator whose
  x-radius is `|1 − 2 · illumination| · r`; waxing lights the right side (northern hemisphere view;
  `moon.hemisphere: south` mirrors it).
- `moon.show_name: true` renders the localised phase name under the icon. Names are English in v1.

### 4.5 Period / cycle
Input: `last_period` (date), `cycle_length` (20–45, default 28), `period_length` (1–10, default 5),
`luteal_length` fixed at 14.

For a date `d` on or after `last_period`:
- `day = (daysBetween(last_period, d) mod cycle_length) + 1`
- `isPeriod = day ≤ period_length`
- `ovulationDay = cycle_length − 14`; `isOvulation = day == ovulationDay`
- `isFertile = ovulationDay − 5 ≤ day ≤ ovulationDay`

Dates before `last_period` return `null`: no markers, no ring. History is never fabricated.

With defaults: ovulation day 14, fertile 9–14, period 1–5. In short cycles the fertile window may
overlap the period; both markers are then shown on those days rather than rejecting the config.

Display:
- **Cycle ring** (always when period enabled): SVG arc around the date number, length
  `day / cycle_length`.
- **Expected period**: drop icon in the day header, ring coloured `period_color`.
- **Fertile window** (`show_fertile`): subtle tint on the day header.
- **Ovulation** (`show_ovulation`): egg / flower icon in the day header.

Wording is "expected", never definitive. README states this is a calendar hint, not
contraception.

### 4.6 Top bar
- `header.show: false` hides the whole bar.
- `header.title: month | range | none`.
  - `month`: "October 2026"; when the week spans two months "Sep – Oct 2026"; across years
    "Dec 2026 – Jan 2027".
  - `range`: "Oct 12 – 18", or "Sep 28 – Oct 4".
- `header.align: left | center`.
- `header.navigation: true | false` shows prev / today / next. Today is visually disabled-looking
  but still enabled when already on the current week.
- `header.idle_return: <seconds>` (default 60, `0` = never) returns to the current week after no
  interaction.
- The bar is laid out as `start | center | end` slots; calendar toggle chips sit first in `end`.

### 4.7 Day after midnight
The card re-renders at local midnight (timer computed to the next midnight, re-armed each time) so
"today" moves without a page reload. If the user is viewing the current week, the anchor follows.

## 5. Theming

All visuals read `--wallcal-*` CSS custom properties set on the card's host.

Resolution order (later wins):
1. Defaults derived from HA theme variables (`--card-background-color`, `--primary-text-color`,
   `--secondary-text-color`, `--primary-color`, `--ha-card-border-radius`, `--divider-color`).
2. Preset (`theme: default | paper | midnight`).
3. `style:` overrides in card config.

Tokens (config key → CSS property):

| Key | Default source | Purpose |
|-----|----------------|---------|
| `background` | `--ha-card-background` / `--card-background-color` | card background |
| `surface` | `rgba(127, 127, 127, 0.1)` | day column / button background |
| `text` | `--primary-text-color` | main text |
| `muted` | `--secondary-text-color` | weekday, times |
| `accent` | `--primary-color` | today highlight, buttons |
| `today_background` | `accent` (drawn at 12% opacity) | today column tint |
| `divider` | `--divider-color` | separators |
| `radius` | `--ha-card-border-radius` (panel view: the theme radius it squares away), fallback 16px | card radius |
| `day_radius` | `radius` | day column radius; day headers use day_radius − 4px |
| `chip_radius` | 10px | event chip radius |
| `overlay_background` | day-column colour + light wash | floating overlay panel |
| `gap` | 4px | gap between columns |
| `padding` | 8px | space between the card edge and its content |
| `font_family` | `inherit` | everything |
| `title_font` | `font_family` | top bar title |
| `title_size` | 28px | top bar title |
| `date_size` | 32px | day number |
| `weekday_size` | 15px | weekday name |
| `event_size` | 15px | event title |
| `allday_size` | `event_size` − 2px | all-day event title (one line, compact chip) |
| `time_size` | 13px | event time |
| `period_color` | `#E24B4A` | drop, period ring |
| `fertile_color` | `#5DCAA5` (drawn at 25% opacity) | fertile tint |
| `ovulation_color` | `#1D9E75` | ovulation icon |
| `ring_color` | `#D4537E` | cycle ring outside period |
| `moon_color` | `muted` | moon lit part |

`style.font_url` (optional) injects a `<link rel="stylesheet">` once per page. Otherwise WallCal
relies on fonts already available to the browser.

Icons (drop, ovulation, navigation, warning) are inline SVG rather than `ha-icon`, so they take
theme colours directly and render identically in the dev harness.

Presets: `default` (HA theme as-is), `paper` (warm off-white, serif title, soft greys),
`midnight` (near-black, low-glare for night, dimmed accents).

## 6. Configuration reference

```yaml
type: custom:wallcal-card
entities:                         # required, ≥ 1
  - entity: calendar.family
    color: "#7F77DD"              # optional; default from a built-in palette
    name: Family                  # optional
    toggle: false                 # true adds a show/hide chip in the top bar
    icon: mdi:account-group       # optional chip icon; default is the first letter of the name
    display: chip                 # chip | label: label shows titles as a line in the day header
    strip_prefix: "Svátek:"       # optional; removed from the start of this calendar's titles
    suffix: SK                    # optional small tag after each title
  - calendar.work                 # shorthand
days: 7                           # 5 | 7, default 7
first_day: monday                 # monday … sunday, default monday; ignored when days: 5
time_format: auto                 # 12 | 24 | auto, default auto
weekday_format: short             # short (Mon) | long (Monday), default short
show_end_time: false              # timed events show "8:30 – 9:15"
past_days: normal                 # normal | dim | grey: days before today
past_events: show                 # show | dim | hide: today's events that have ended
auto_scroll: true                 # today's list scrolls to the next upcoming event
refresh_interval: 300             # seconds, default 300, min 60
header:
  show: true
  title: month                    # month | range | none | any other text, shown as is
  subtitle: none                  # same values as title, smaller and muted beside it
  align: left                     # left | center
  navigation: true
  idle_return: 60                 # seconds, 0 = never
weather:                          # optional; off when omitted
  entity: weather.home
  show_low: true
moon:
  enabled: false
  show_name: false
  hemisphere: north               # north | south
period:
  enabled: false
  last_period: 2026-10-02         # required when enabled, YYYY-MM-DD
  cycle_length: 28
  period_length: 5
  show_fertile: true
  show_ovulation: true
theme: default                    # default | paper | midnight
style: {}                         # any token from section 5, plus font_url
overlays:                         # small cards floating over the bottom of the week, one per position
  - position: bottom-right   # bottom-left | bottom-center | bottom-right
    span: 2          # day columns it is centred over
    width: 90%       # share of those columns
    max_height: 40%  # of the grid height, or px; scrolls past it
    offset: 8        # px from the bottom, e.g. 72 to clear navbar-card
    icon: mdi:format-list-checks  # header button; toggle: false shows it always
    card:
      type: todo-list
      entity: todo.shopping
```

Overlays: see `docs/superpowers/specs/2026-10-14-wallcal-overlays-design.md`.

Invalid config throws from `setConfig` with a human-readable message; HA renders it as an error
card.

## 7. Privacy

Period settings live in the Lovelace dashboard config. Any HA user who can load that dashboard can
read them, and they are included in `.storage/lovelace` and backups. Accepted for v1 and stated in
the README. Learned prediction (see `ROADMAP.md`) moves the data into a dedicated calendar entity.

The card makes no network requests other than to the HA instance it runs in, plus the optional
`font_url` chosen by the user.

## 8. Testing

- **Unit (vitest):**
  - `week`: 5 and 7 days, every `first_day`, anchors on each weekday, DST start and end weeks.
  - `moon`: published 2026 new and full moon dates within ±1 day; illumination ≈ 0 / 1 at those.
  - `cycle`: day numbering, wrap at `cycle_length`, before `last_period` → `null`, period /
    fertile / ovulation boundaries.
  - `config`: defaults, shorthand entities, every validation error.
  - `format`: titles for same-month, cross-month, cross-year weeks; 12h vs 24h.
  - `events`: normalisation of all-day, timed, multi-day and cross-midnight events.
- **Visual (dev harness):** `dev/index.html` with a mock `hass` and fixture events. Checked in the
  browser at tablet landscape size for: no overlays / moon / period / both; each preset; 12h / 24h;
  5 / 7 days.
- **Real HA:** load `dist/wallcal-card.js` as a dashboard resource on the tablet; confirm refresh,
  idle return and the midnight rollover.

## 9. Performance and device support

Wall tablets are typically old, low-end devices left on permanently (older Fire HD, iPads several
iOS versions behind, cheap Android tablets in kiosk browsers). Performance and compatibility are
first-class requirements, not polish.

- **Browser floor:** Chrome / Android WebView 87 and Safari 14.1 / iOS 14.5 (`Intl` `formatRange`
  and flexbox `gap` need 14.1; every iOS 14 device can update to it). The bundle is compiled down
  to that target; CSS avoids features newer than it (no `color-mix()`, no container queries,
  no `:has()`). Translucent tints are drawn as an opacity layer instead of colour mixing.
- **No work on unrelated `hass` updates:** HA pushes a new `hass` object for every state change in
  the house. The card does an O(entities) comparison and nothing else unless a configured calendar
  changed or the locale changed: no re-render, no fetch.
- **Bounded work per render:** 5–7 columns; `Intl.DateTimeFormat` instances are cached per
  language and options because constructing them is far more expensive than formatting.
- **No continuous activity:** no animations, transitions, blur, backdrop filters or large shadows;
  no per-second timers. The only timers are the refresh interval, the idle return and the midnight
  rollover.
- **Small bundle:** target under 30 KB gzipped (Lit included).

## 10. Build and distribution

- TypeScript + Lit (no decorators), bundled with Vite library mode into `dist/wallcal-card.js`
  (single ES module, Lit included, compiled for the §9 browser floor). `tsc --noEmit` type-checks;
  Vite only strips types.
- `hacs.json` for HACS custom repository install.
- Card registers itself in `window.customCards` so it shows up in the card picker.
