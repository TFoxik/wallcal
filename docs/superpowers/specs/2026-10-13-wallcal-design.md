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
prediction, companion integration. See `TODO.md`.

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
- `days: 5` — Monday to Friday of the anchor's week. `first_day` is ignored.
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
- The bar is laid out as `start | center | end` slots, so later additions (clock, weather) plug in.

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
| `surface` | primary text at 5% | day column / chip background |
| `text` | `--primary-text-color` | main text |
| `muted` | `--secondary-text-color` | weekday, times |
| `accent` | `--primary-color` | today highlight, buttons |
| `today_background` | accent at 12% | today column |
| `divider` | `--divider-color` | separators |
| `radius` | `--ha-card-border-radius`, fallback 16px | card / column radius |
| `chip_radius` | 10px | event chip radius |
| `gap` | 12px | gap between columns |
| `font_family` | `inherit` | everything |
| `title_size` | 28px | top bar title |
| `date_size` | 32px | day number |
| `weekday_size` | 15px | weekday name |
| `event_size` | 15px | event title |
| `time_size` | 13px | event time |
| `period_color` | `#E24B4A` | drop, period ring |
| `fertile_color` | `#5DCAA5` at 25% | fertile tint |
| `ovulation_color` | `#1D9E75` | ovulation icon |
| `ring_color` | `#D4537E` | cycle ring outside period |
| `moon_color` | `muted` | moon lit part |

`style.font_url` (optional) injects a `<link rel="stylesheet">` once per page. Otherwise WallCal
relies on fonts already available to the browser.

Presets: `default` (HA theme as-is), `paper` (warm off-white, serif title, soft greys),
`midnight` (near-black, low-glare for night, dimmed accents).

## 6. Configuration reference

```yaml
type: custom:wallcal-card
entities:                         # required, ≥ 1
  - entity: calendar.family
    color: "#7F77DD"              # optional; default from a built-in palette
    name: Family                  # optional
  - calendar.work                 # shorthand
days: 7                           # 5 | 7, default 7
first_day: monday                 # monday … sunday, default monday; ignored when days: 5
time_format: auto                 # 12 | 24 | auto, default auto
refresh_interval: 300             # seconds, default 300, min 60
header:
  show: true
  title: month                    # month | range | none
  align: left                     # left | center
  navigation: true
  idle_return: 60                 # seconds, 0 = never
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
```

Invalid config throws from `setConfig` with a human-readable message; HA renders it as an error
card.

## 7. Privacy

Period settings live in the Lovelace dashboard config. Any HA user who can load that dashboard can
read them, and they are included in `.storage/lovelace` and backups. Accepted for v1 and stated in
the README. Learned prediction (see `TODO.md`) moves the data into a dedicated calendar entity.

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

## 9. Build and distribution

- TypeScript + Lit, bundled with Rollup into `dist/wallcal-card.js` (single ES module).
- `hacs.json` for HACS custom repository install.
- Card registers itself in `window.customCards` so it shows up in the card picker.
