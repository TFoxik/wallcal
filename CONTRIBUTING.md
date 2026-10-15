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
and a YAML dashboard with three WallCal variants. Install Home Assistant once as a uv tool (puts
`hass` on PATH, kept apart from any project's environment), then start the harness:

```bash
uv tool install --python 3.14 homeassistant==2026.10.0
./dev/ha/start.sh
```

It builds the card, serves it on http://localhost:8124 and starts HA, which installs the packages
its integrations need into that tool environment on first start. `HASS_BIN=/other/hass` uses a
different install; add `HASS_SKIP_PIP=1` when that install belongs to another project.

Browsers on this machine skip the login (trusted networks), and HA listens on 127.0.0.1 only.
That login bypass is for this throwaway instance only: never copy it to a real Home Assistant, and
never run the harness behind a proxy or in a container, where every request can appear to come
from a trusted address. HA copies the `http:` settings into `.storage/http` on first start and
ignores the YAML afterwards; delete that file to apply changes to `http:`.

Edit the fixture JSON while it runs to see the card pick up changes. After a rebuild, hard-refresh
the page: HA's browser cache keeps the old card otherwise.

## Release

Bump `version` in `package.json`, commit, then tag and push:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

The release workflow checks the tag matches `package.json`, runs the tests, builds and attaches
`wallcal-card.js` to a GitHub release, which is what HACS installs. Release tags are protected:
a pushed `v*` tag cannot be moved or deleted.
