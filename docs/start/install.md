# Install

## With HACS (recommended)

1. Open [WallCal in HACS](https://my.home-assistant.io/redirect/hacs_repository/?owner=TFoxik&repository=wallcal&category=plugin).
   Or in HACS open ⋮ → **Custom repositories** and add `https://github.com/TFoxik/wallcal` with type **Dashboard**.
2. Open **WallCal** in HACS and click **Download**.
3. Reload the browser, and the wall tablet.

## Without HACS

1. Download `wallcal-card.js` from the [latest release](https://github.com/TFoxik/wallcal/releases/latest) into `/config/www/`.
2. Under Settings → Dashboards → ⋮ → **Resources**, add `/local/wallcal-card.js?v=1` as a JavaScript module.
3. Reload the browser. After each update, raise the number after `?v=` so tablets drop the cached copy.

Next: [your first card](./first-card).
