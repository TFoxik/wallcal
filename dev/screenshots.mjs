// Landing-page and docs screenshots from the dev harness (./dev/ha/start.sh must be running on :8124).
// Writes site/img/*.webp, docs/public/img/*.webp and the docs' card-map/day-header dot maps.
// Needs `npx playwright install chromium` once and `cwebp` on PATH.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import YAML from 'yaml';

const BASE = process.env.WALLCAL_HA_URL ?? 'http://localhost:8124';
const ROOT = join(import.meta.dirname, '..');
const SITE = join(ROOT, 'site', 'img');
const DOCS = join(ROOT, 'docs', 'public', 'img');
const tmp = mkdtempSync(join(tmpdir(), 'wallcal-shots-'));

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
  locale: 'en-GB',
});

// HA sometimes reloads the whole page right after it loads (sign-in, a changed dashboard), so wait until it stays put.
async function open(view, dashboard = 'lovelace') {
  await page.goto(`${BASE}/${dashboard}/${view}`);
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator('wallcal-card .day__events').first().waitFor();
    await page.waitForFunction(() => !document.getElementById('ha-launch-screen'));
    await page.waitForLoadState('networkidle');
    const origin = await page.evaluate(() => performance.timeOrigin);
    await page.waitForTimeout(1500);
    const stayed = await page.evaluate(() => performance.timeOrigin).then((o) => o === origin, () => false);
    if (stayed) return;
  }
  throw new Error(`${dashboard}/${view} kept reloading`);
}

async function box(selector, nth = 0) {
  const b = await page.locator(`wallcal-card ${selector}`).nth(nth).boundingBox();
  if (!b) throw new Error(`no box for ${selector} #${nth}`);
  return b;
}

async function inDay(day, selector) {
  const b = await page.locator('wallcal-card section.day').nth(day).locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector} in day ${day}`);
  return b;
}

// Which days overflow depends on the fixture and scroll timing; the left-most one keeps clear of the bottom-right pill.
async function leftmost(selector) {
  const all = page.locator(`wallcal-card ${selector}`);
  const boxes = [];
  for (let i = 0; i < (await all.count()); i++) boxes.push(await all.nth(i).boundingBox());
  if (!boxes.length) throw new Error(`no ${selector} on the card`);
  return boxes.reduce((a, b) => (b.x < a.x ? b : a));
}

function union(...boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

const pad = (b, p = 8) => ({ x: b.x - p, y: b.y - p, width: b.width + 2 * p, height: b.height + 2 * p });

// Encodes one capture into each [path, width] output, e.g. a full hero plus a smaller theme preview.
async function shot(clip, ...outputs) {
  const png = join(tmp, 'shot.png');
  await page.screenshot({ path: png, clip });
  for (const [path, width] of outputs) {
    const resize = width ? ['-resize', String(width), '0'] : [];
    execFileSync('cwebp', ['-quiet', '-q', '82', ...resize, png, '-o', `${path}.webp`]);
    console.log(`${path.slice(ROOT.length + 1)}.webp`);
  }
}

async function todayIndex() {
  const i = await page.locator('wallcal-card section.day').evaluateAll((days) => days.findIndex((d) => d.classList.contains('day--today')));
  if (i < 0) throw new Error('no day--today column: is the fixture week showing?');
  return i;
}

// The overlay's card fills in after it opens (a to-do list renders its items), so wait for its size to settle.
async function settledBox(locator) {
  await locator.waitFor();
  let last = await locator.boundingBox();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    const next = await locator.boundingBox();
    if (next && last && next.y === last.y && next.height === last.height) return next;
    last = next;
  }
  throw new Error('overlay never settled');
}

const headers = async (from, to) => pad(union(await box('.day__header', from), await box('.day__header', to)));
const clampDay = (i) => Math.max(0, Math.min(i, 6));

// A dot at the centre of `b` (or at fractions fx/fy of it), as percentages of `clip`.
function dot(n, label, href, clip, b, fx = 0.5, fy = 0.5) {
  const pct = (v) => Math.round(v * 1000) / 10;
  return { n, label, href, x: pct((b.x + b.width * fx - clip.x) / clip.width), y: pct((b.y + b.height * fy - clip.y) / clip.height) };
}

// Dots closer than this (in % of the picture) sit on top of each other, e.g. when a weekend clamps two days together.
const MIN_GAP = 3;

function checkGaps(name, dots) {
  for (const a of dots) {
    for (const b of dots) {
      if (a.n < b.n && Math.hypot(a.x - b.x, a.y - b.y) < MIN_GAP) throw new Error(`${name}: dots ${a.n} and ${b.n} overlap`);
    }
  }
}

function writeMap(name, dark, light, alt, clip, dots) {
  checkGaps(name, dots);
  const map = { dark, light, alt, width: Math.round(clip.width), height: Math.round(clip.height), dots };
  writeFileSync(join(DOCS, `${name}.json`), `${JSON.stringify(map, null, 2)}\n`);
  console.log(`docs/public/img/${name}.json`);
}

// Dots measured on the dark wall view; the light pass checks its layout against them.
let darkCardDots = [];

async function weekShots(view, suffix, theme) {
  await open(view);
  const card = await box('ha-card');
  await shot(card, [join(SITE, `hero-${suffix}`), 2000], [join(SITE, `theme-${theme}`), 1000], [join(DOCS, `theme-${theme}`), 1000], [join(DOCS, `card-map-${suffix}`), 2000]);

  const today = await todayIndex();
  const first = Math.max(0, Math.min(today - 1, 4));
  await shot(await headers(first, first + 2), [join(SITE, `moon-${suffix}`)]);
  const cycleFirst = Math.max(0, first - 1);
  await shot(await headers(cycleFirst, cycleFirst + 3), [join(SITE, `cycle-${suffix}`)]);
  await shot(pad(union(await box('.toggles'), await box('.day__header', 4), await box('.day__header', 6))), [join(SITE, `chips-${suffix}`)]);
  await shot(pad(await box('.bar'), 4), [join(DOCS, `topbar-${suffix}`)]);

  const t = (i) => clampDay(today + i);
  const headerBox = await inDay(today, '.day__header');
  const dayHeader = pad(headerBox);
  await shot(dayHeader, [join(DOCS, `day-header-${suffix}`)]);
  const columns = union(await box('section.day', t(0)), await box('section.day', t(1)));
  await shot({ ...columns, height: Math.min(columns.height, 420) }, [join(DOCS, `events-${suffix}`)]);

  const cardDots = [
    dot(1, 'Title', '/parts/top-bar#title-and-subtitle', card, await box('.bar__title'), 1.06),
    dot(2, 'Calendar chips', '/parts/top-bar#calendar-chips', card, await box('.toggles')),
    dot(3, 'Week arrows & Today', '/parts/top-bar#week-arrows-and-today', card, await box('.nav--today')),
    dot(4, 'Day header', '/parts/day-header', card, await inDay(0, '.day__header'), 0.75, 0.35),
    dot(5, 'Weather', '/parts/day-header#weather', card, await inDay(t(-1), '.day__forecast')),
    dot(6, 'Name days & holidays', '/parts/day-header#name-days-and-holidays', card, await inDay(t(-2), '.day__labels')),
    dot(7, 'Moon', '/parts/day-header#moon', card, await inDay(t(1), '.day__markers .moon')),
    dot(8, 'All-day events', '/parts/events#all-day-events', card, await inDay(t(1), '.day__allday')),
    dot(9, 'Events & colours', '/parts/events#calendars-and-colours', card, await inDay(t(2), '.chip--timed')),
    dot(10, '"+N more"', '/parts/events#more-events-than-fit', card, await leftmost('.day__more'), 0.9),
    dot(11, 'Floating card', '/parts/floating-cards', card, await box('.pill--bottom-right'), 0.3, 0),
  ];
  // The light pictures reuse the dots measured on the dark ones, so the two layouts must match.
  if (suffix === 'light') {
    for (const [i, d] of cardDots.entries()) {
      if (Math.hypot(d.x - darkCardDots[i].x, d.y - darkCardDots[i].y) > 1.5) throw new Error(`light card map: dot ${d.n} moved, the light layout differs from the dark one`);
    }
  }
  if (suffix === 'dark') {
    darkCardDots = cardDots;
    writeMap('card-map', 'card-map-dark.webp', 'card-map-light.webp', 'A WallCal week with numbered dots on its parts: the top bar, a day header, events and a floating card', card, cardDots);
    const h = (selector) => inDay(today, selector);
    writeMap('day-header', 'day-header-dark.webp', 'day-header-light.webp', "Today's day header with numbered dots on the date, weekday, cycle ring, weather, name days and moon", dayHeader, [
    dot(1, 'Date', '/parts/day-header#date-and-weekday', dayHeader, await h('.day__date')),
    dot(2, 'Weekday', '/parts/day-header#date-and-weekday', dayHeader, await h('.day__weekday')),
    dot(3, 'Cycle ring', '/parts/day-header#cycle-tracking', dayHeader, await h('.ring'), 0.85, 0.15),
    dot(4, 'Weather', '/parts/day-header#weather', dayHeader, await h('.day__forecast')),
    dot(5, 'Name days', '/parts/day-header#name-days-and-holidays', dayHeader, await h('.day__labels'), 0.3, 0.5),
    dot(6, 'Moon', '/parts/day-header#moon', dayHeader, await h('.day__markers .moon')),
    dot(7, 'Fertile tint', '/parts/day-header#cycle-tracking', dayHeader, headerBox, 0.85, 0.2),
    ]);
  }

  // Overlay visibility is remembered per device, so it may already be open from an earlier view.
  const pill = page.locator('wallcal-card .pill--bottom-right');
  if (await pill.count()) await pill.click();
  const overlayEl = page.locator('wallcal-card .overlay--bottom-right');
  const overlay = await settledBox(overlayEl);
  const last3 = union(await box('section.day', 4), await box('section.day', 6));
  await shot({ x: last3.x, y: overlay.y - 160, width: last3.width, height: card.y + card.height - overlay.y + 160 }, [join(SITE, `overlay-${suffix}`)], [join(DOCS, `overlay-${suffix}`)]);
  await overlayEl.locator('.overlay__handle').click();
  await overlayEl.waitFor({ state: 'detached' });
}

const EDITOR_PANELS = ['Calendars', 'Week', 'Top bar', 'Weather', 'Moon', 'Cycle', 'Floating cards', 'Theme & style'];

// The YAML dashboard can't be edited, so the editor shots use a storage dashboard written over HA's websocket API.
async function saveEditorDashboard() {
  const views = YAML.parse(readFileSync(join(ROOT, 'dev/ha/config/ui-lovelace.yaml'), 'utf8'), { merge: true }).views;
  const card = views.find((v) => v.path === 'wall').cards[0];
  await page.evaluate(async (cardConfig) => {
    const hass = document.querySelector('home-assistant').hass;
    const dashboards = await hass.callWS({ type: 'lovelace/dashboards/list' });
    if (!dashboards.some((d) => d.url_path === 'wallcal-edit')) {
      await hass.callWS({ type: 'lovelace/dashboards/create', url_path: 'wallcal-edit', mode: 'storage', title: 'WallCal editor', show_in_sidebar: false, require_admin: false });
    }
    await hass.callWS({ type: 'lovelace/config/save', url_path: 'wallcal-edit', config: { views: [{ title: 'Edit', path: 'edit', panel: true, cards: [cardConfig] }] } });
  }, card);
}

async function editorShots(scheme) {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await open('edit?edit=1', 'wallcal-edit');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  const panels = page.locator('wallcal-card-editor ha-expansion-panel');
  await panels.first().waitFor();
  for (const title of EDITOR_PANELS) {
    const index = await panels.evaluateAll((all, t) => {
      all.forEach((p) => (p.expanded = p.header === t));
      return all.findIndex((p) => p.header === t);
    }, title);
    if (index < 0) throw new Error(`no editor panel "${title}"`);
    await page.waitForTimeout(600);
    const panel = panels.nth(index);
    await panel.scrollIntoViewIfNeeded();
    // Theme & style is taller than the dialog; its picture shows the theme picker, the page lists the style fields.
    const b = await panel.boundingBox();
    const clip = title === 'Theme & style' ? { ...b, height: Math.min(b.height, 120) } : b;
    // Same file name rule as test/docs.test.ts panelFile().
    await shot(clip, [join(DOCS, `editor-${title.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}-${scheme}`), 900]);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}

try {
  await weekShots('wall', 'dark', 'default');
  await weekShots('paper-week', 'light', 'paper');
  await open('midnight-week');
  await shot(await box('ha-card'), [join(SITE, 'theme-midnight'), 1000], [join(DOCS, 'theme-midnight'), 1000]);
  await open('recipe-bedroom');
  await shot(await box('ha-card'), [join(DOCS, 'recipe-bedroom'), 1600]);
  // HA follows the browser's colour scheme, so the editor and default-theme recipes get a light twin this way.
  await saveEditorDashboard();
  for (const scheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const recipe of ['kitchen', 'family']) {
      await open(`recipe-${recipe}`);
      await shot(await box('ha-card'), [join(DOCS, `recipe-${recipe}-${scheme}`), 1600]);
    }
    await editorShots(scheme);
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
