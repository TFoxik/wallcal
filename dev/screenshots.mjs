// Landing-page screenshots from the dev harness (./dev/ha/start.sh must be running on :8124).
// Writes site/img/*.webp; needs `npx playwright install chromium` once and `cwebp` on PATH.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.WALLCAL_HA_URL ?? 'http://localhost:8124';
const OUT = join(import.meta.dirname, '..', 'site', 'img');
const tmp = mkdtempSync(join(tmpdir(), 'wallcal-shots-'));

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
  locale: 'en-GB',
});

async function open(view) {
  await page.goto(`${BASE}/lovelace/${view}`);
  await page.locator('wallcal-card .day__events').first().waitFor();
  await page.waitForFunction(() => !document.getElementById('ha-launch-screen'));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

async function box(selector, nth = 0) {
  const b = await page.locator(`wallcal-card ${selector}`).nth(nth).boundingBox();
  if (!b) throw new Error(`no box for ${selector} #${nth}`);
  return b;
}

function union(...boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

const pad = (b, p = 8) => ({ x: b.x - p, y: b.y - p, width: b.width + 2 * p, height: b.height + 2 * p });

// Encodes one capture into each [name, width] output, e.g. a full hero plus a smaller theme preview.
async function shot(clip, ...outputs) {
  const png = join(tmp, `${outputs[0][0]}.png`);
  await page.screenshot({ path: png, clip });
  for (const [name, width] of outputs) {
    const resize = width ? ['-resize', String(width), '0'] : [];
    execFileSync('cwebp', ['-quiet', '-q', '82', ...resize, png, '-o', join(OUT, `${name}.webp`)]);
    console.log(`${name}.webp`);
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

async function weekShots(view, suffix, theme) {
  await open(view);
  const card = await box('ha-card');
  await shot(card, [`hero-${suffix}`, 2000], [`theme-${theme}`, 1000]);

  const first = Math.max(0, Math.min((await todayIndex()) - 1, 4));
  await shot(await headers(first, first + 2), [`moon-${suffix}`]);
  const cycleFirst = Math.max(0, first - 1);
  await shot(await headers(cycleFirst, cycleFirst + 3), [`cycle-${suffix}`]);
  await shot(pad(union(await box('.toggles'), await box('.day__header', 4), await box('.day__header', 6))), [`chips-${suffix}`]);

  // Overlay visibility is remembered per device, so it may already be open from an earlier view.
  const pill = page.locator('wallcal-card .pill--bottom-right');
  if (await pill.count()) await pill.click();
  const overlayEl = page.locator('wallcal-card .overlay--bottom-right');
  const overlay = await settledBox(overlayEl);
  const columns = union(await box('section.day', 4), await box('section.day', 6));
  await shot({ x: columns.x, y: overlay.y - 160, width: columns.width, height: card.y + card.height - overlay.y + 160 }, [`overlay-${suffix}`]);
  await overlayEl.locator('.overlay__handle').click();
  await overlayEl.waitFor({ state: 'detached' });
}

try {
  // The first load signs in through the trusted-network flow and reloads once; get that out of the way.
  await page.goto(`${BASE}/lovelace/wall`);
  await page.waitForTimeout(5000);
  await weekShots('wall', 'dark', 'default');
  await weekShots('paper-week', 'light', 'paper');
  await open('midnight-week');
  await shot(await box('ha-card'), ['theme-midnight', 1000]);
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
