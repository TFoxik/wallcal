# Contributing to WallCal

Bug reports and pull requests are welcome. For a security problem, please use
[private vulnerability reporting](https://github.com/TFoxik/wallcal/security/advisories/new)
instead of a public issue.

## Develop

```bash
npm install
npm test
npm run dev   # open http://localhost:5173/dev/index.html
npm run build
```

`npm run dev` shows the card with fixture calendars and no Home Assistant. `npm run build` writes
`dist/wallcal-card.js`.

## Local Home Assistant

`dev/ha/` holds a throwaway Home Assistant setup: two fixture calendars (`calendar.family`,
`calendar.work`) whose events come from `dev/ha/config/wallcal_fixture.json` relative to today,
and three YAML dashboards: Overview (the wall tablet in its themes and layouts), Phone (the next-up
card and the Calendar tab) and Docs recipes (the cards the docs' recipes and pictures use). Install Home Assistant once as a uv tool (puts
`hass` on PATH, kept apart from any project's environment), then start the harness:

```bash
uv tool install --python 3.14 homeassistant==2026.10.0
./dev/ha/start.sh
```

It builds the card, serves it on http://localhost:8124 and starts HA, which installs the packages
its integrations need into that tool environment on first start. `HASS_BIN=/other/hass` uses a
different install; add `HASS_SKIP_PIP=1` when that install belongs to another project.

Browsers on this machine skip the login (trusted networks), and HA listens on loopback only (127.0.0.1 and ::1).
That login bypass is for this throwaway instance only: never copy it to a real Home Assistant, and
never run the harness behind a proxy or in a container, where every request can appear to come
from a trusted address. HA copies the `http:` settings into `.storage/http` on first start and
ignores the YAML afterwards; delete that file to apply changes to `http:`. HA then asks in the
browser to confirm the new HTTP settings, and reverts them after five minutes if nobody does.

Edit the fixture JSON while it runs to see the card pick up changes. After a rebuild, hard-refresh
the page: HA's browser cache keeps the old card otherwise.

## Landing page and docs

`site/` is the landing page: plain HTML, CSS and JS with no build step. Preview it with
`python3 -m http.server 5174 -d site`. `docs/` is the user guide, a VitePress site: `npm run docs:dev`
serves it under `/wallcal/docs/` on the port it prints, and `npm run docs:build` checks it (CI runs it too).
Keep `docs:dev` on localhost and stop it when you're done: VitePress lets its dev server read the whole
repo, so the config refuses `dev/ha/config/` and other local state, but the rest of the repo stays
readable while it runs. VitePress 1.6 asks for Vite 5, which has unpatched dev-server advisories;
`overrides` in `package.json` gives it Vite 6 instead. Drop the override once VitePress 2 is stable.
Pushing changes under `site/` or `docs/` to `main` publishes both to GitHub Pages.

### Screenshots

The pictures on the landing page and in the docs, and the docs' card-map dots, come from the local Home
Assistant above. With it running:

```bash
npx playwright install chromium   # once
brew install webp                 # cwebp, once
npm run screenshots
```

It writes `site/img/` and `docs/public/img/` (dark and light versions, editor panels, recipes and
`card-map.json` / `day-header.json`). Commit them: CI never regenerates pictures. The script stops if
two map dots would overlap or if the light layout drifts from the dark one; retake on another day if
a weekend clamps two days together.

## Release

Bump `version` in `package.json`, commit, then tag and push:

```bash
git tag v0.7.0 && git push origin v0.7.0
```

The release workflow checks the tag matches `package.json`, runs the tests, builds and attaches
`wallcal-card.js` to a GitHub release, which is what HACS installs. Release tags are protected:
a pushed `v*` tag cannot be moved or deleted.
