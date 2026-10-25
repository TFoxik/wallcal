# WallCal

A Home Assistant Lovelace card (`dist/wallcal-card.js`), its landing page (`site/`) and its VitePress user guide
(`docs/`). `CONTRIBUTING.md` has the long version of everything below.

## Build and test

```bash
npm test              # vitest, TZ=Europe/Prague; judge by exit code (an unhandled rejection fails a green run)
npm run build         # tsc --noEmit + vite build → dist/wallcal-card.js
npm run docs:build    # the docs site; CI runs it too
```

## Run it

Start servers with `preview_start` and the names in `.claude/launch.json`, not from Bash:

- `ha` — the dev Home Assistant harness (`dev/ha/start.sh`): builds the card, then runs `hass -c dev/ha/config` on
  port 8124 with fixture calendars and three dashboards: Overview (tablet), Phone, Docs recipes. Loopback only, no login.
  `http://127.0.0.1:8124` always works; `localhost` works too unless `dev/ha/config/.storage/http` predates the
  `::1` bind (HA ignores the YAML `http:` block once that file exists — delete it to re-apply). Hard-refresh after
  a rebuild: HA caches the old card.
- `dev` — the card on fixture data without HA, port 5173, page `/dev/index.html`.
- `site` (5174) and `docs` (5175) — landing page and user guide.

`npm run screenshots` needs `ha` running; it rewrites `site/img/` and `docs/public/img/`, which are committed.

On the maintainer's Mac there is no `hass` install, so `ha` won't start. A shared Docker Home Assistant at
`http://localhost:8123` serves this repo instead. It reads `dev/ha/config` (fixture integration, `wallcal_fixture.json`,
dashboards "WallCal tablet", "WallCal phone" and "WallCal recipes") and `dist/` read-only, so `npm run build` plus a
hard refresh is all a change needs. Screenshots against it:
`WALLCAL_HA_URL=http://localhost:8123 WALLCAL_TABLET_DASHBOARD=wallcal-tablet npm run screenshots`.

## Committing

Straight to `main` with conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`…). The repo is public
(TFoxik/wallcal), so nothing private goes in. `docs/superpowers/` is gitignored on purpose: never stage it.
