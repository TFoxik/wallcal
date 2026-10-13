# WallCal

A week-view wall calendar card for Home Assistant, designed for an always-on landscape tablet.
Clean by default, restylable from YAML, with optional moon phase and cycle overlays.

## Install

**HACS (custom repository):** HACS → Frontend → ⋮ → Custom repositories → add this repo as
*Dashboard*, install WallCal, reload the browser.

**Manual:** `npm install && npm run build`, copy `dist/wallcal-card.js` to `/config/www/`, then add
`/local/wallcal-card.js` as a JavaScript module under Settings → Dashboards → Resources.

## Configure

```yaml
type: custom:wallcal-card
entities:
  - entity: calendar.family
    color: "#7F77DD"
  - calendar.work
days: 7              # or 5 for Mon–Fri
first_day: monday
time_format: auto    # 12 | 24 | auto
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
```

Every option and style token is listed in
[the design spec](docs/superpowers/specs/2026-10-13-wallcal-design.md#6-configuration-reference).

## Please note

- **Privacy:** the period settings are stored in the dashboard configuration. Anyone who can open
  that dashboard in Home Assistant can read them, and they are included in backups.
- **Predictions are estimates.** Expected period, fertile window and ovulation come from a fixed
  cycle length and the standard 14-day luteal phase. They are a calendar hint, not medical advice
  and not a contraception method.
- Moon phase uses the mean lunar cycle and can be off by up to about half a day.
- Built for old wall tablets: works on Chrome / Android WebView 87+ and Safari / iOS 14+, with no
  animations or background work beyond a refresh every few minutes.

## Develop

```bash
npm install
npm test
npm run dev   # open http://localhost:5173/dev/index.html
npm run build
```
