# WallCal

A week-view wall calendar card for Home Assistant, designed for an always-on landscape tablet.
Clean by default, restylable from YAML, with optional moon phase and cycle overlays.

## Install

**Manual (for now):** `npm install && npm run build`, copy `dist/wallcal-card.js` to
`/config/www/`, then add `/local/wallcal-card.js?v=0.1.0` as a JavaScript module under Settings →
Dashboards → Resources. Bump the `?v=` value after copying a new build, otherwise browsers (and
wall tablets especially) keep running the cached old one.

For a wall display, put the card in a **panel** view so it fills the screen. In a sections view,
give its section a wide `column_span`: seven day columns need roughly 900 px. In a panel view the
card fills the screen below the HA header and busy days scroll inside their column; in sections it
uses its grid height. In a masonry view the card grows to fit every event instead.

**HACS:** available once the first GitHub release with a built `wallcal-card.js` is published
(HACS → Frontend → ⋮ → Custom repositories → add this repo as *Dashboard*).

## Configure

```yaml
type: custom:wallcal-card
entities:
  - entity: calendar.family
    color: "#7F77DD"
  - calendar.work
  - entity: calendar.namedays
    color: "#F4A27A"
    toggle: true     # round chip in the header shows/hides this calendar
    icon: mdi:flag   # optional; otherwise the chip shows the first letter
    display: label   # name under the date instead of an event chip (max 2 calendars)
    strip_prefix: "Svátek:"
    suffix: CZ       # optional small tag after the name
days: 7              # or 5 for Mon–Fri
first_day: monday
time_format: auto    # 12 | 24 | auto
weekday_format: long # short (Mon) | long (Monday)
past_events: dim     # show | dim | hide today's finished events
weather:
  entity: weather.home
header:
  title: month       # month | range | none
  navigation: true
  idle_return: 60
moon:
  enabled: true
period:
  enabled: true
  last_period: 2026-10-02
  cycle_length: 28
  period_length: 5
theme: paper         # default | paper | midnight
style:
  date_size: 36
  accent: "#D4537E"
overlays:            # small cards floating over the bottom of the week, one per position
  - position: bottom-right   # bottom-left | bottom-center | bottom-right
    span: 2          # day columns it is centred over
    width: 90%       # share of those columns
    max_height: 40%  # of the grid height, or px; scrolls past it
    offset: 8        # px from the bottom, e.g. 72 to clear navbar-card
    icon: mdi:format-list-checks
    toggle: pill     # header (button in the top bar) | pill (minimizes in place) | none (always shown)
    card:            # any Lovelace card, with that card's own options
      type: todo-list
      entity: todo.shopping
      hide_completed: true   # todo-list option; also hide_create, display_order
```

Every option and style token is listed in
[the design spec](docs/superpowers/specs/2026-10-13-wallcal-design.md#6-configuration-reference).

## Please note

- Overlays can hold any card. Built-in HA cards follow the WallCal theme; cards that hard-code
  their colours may not. The panel colour is the `overlay_background` style token. Shown/hidden overlays are remembered per device, like hidden calendars.
- **Privacy:** the period settings are stored in the dashboard configuration. Anyone who can open
  that dashboard in Home Assistant can read them, and they are included in backups.
- **Predictions are estimates.** Expected period, fertile window and ovulation come from a fixed
  cycle length and the standard 14-day luteal phase. They are a calendar hint, not medical advice
  and not a contraception method.
- Calendars hidden with a header chip stay hidden on that device (browser storage) until tapped
  again; other tablets keep their own choice.
- Moon phase uses the mean lunar cycle and can be off by up to about half a day.
- Built for old wall tablets: works on Chrome / Android WebView 87+ and Safari / iOS 14.5+, with no
  animations or background work beyond a refresh every few minutes.

## Develop

```bash
npm install
npm test
npm run dev   # open http://localhost:5173/dev/index.html
npm run build
```

### Local Home Assistant

`dev/ha/` holds a throwaway Home Assistant setup: two fixture calendars (`calendar.family`,
`calendar.work`) whose events come from `dev/ha/config/wallcal_fixture.json` relative to today,
and a YAML dashboard with three WallCal variants. Install Home Assistant once as a uv tool (puts
`hass` on PATH, kept apart from any project's environment), then start the harness:

```bash
uv tool install --python 3.14 homeassistant==2026.10.0
./dev/ha/start.sh
```

It builds the card, serves it on http://localhost:8124 and starts HA, which installs the packages
its integrations need into that tool environment on first start. `HASS_BIN=/other/hass` uses a
different install; add `HASS_SKIP_PIP=1` when that install belongs to another project.
Browsers on this machine skip the login (trusted networks); first-run onboarding can be finished
in the browser. Edit the fixture JSON while it runs to see the card pick up changes. After a
rebuild, hard-refresh the page: HA's browser cache keeps the old card otherwise.
