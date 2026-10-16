import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SITE = join(__dirname, '..', 'site');
const read = (file: string) => readFileSync(join(SITE, file), 'utf8');
const HTML = read('index.html');
const SITE_JS = read('site.js');
const CSS = read('style.css');

const YAML = `type: custom:wallcal-card
entities:
  - calendar.family
  - entity: calendar.work
    color: "#7F77DD"`;

interface PageOptions {
  stored?: 'light' | 'dark';
  storageThrows?: boolean;
  clipboard?: 'missing' | 'rejects';
  runSiteJs?: boolean;
  styled?: boolean;
}

interface Page {
  window: Window;
  document: Window['document'];
  stored: () => string | null;
  writeText: ReturnType<typeof vi.fn>;
  timers: { fn: () => void; ms: number }[];
}

const windows: Window[] = [];
afterEach(async () => {
  await Promise.all(windows.splice(0).map((w) => w.happyDOM.close()));
});

function loadPage(opts: PageOptions = {}): Page {
  const window = new Window({
    url: 'http://localhost:5174/',
    settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
  });
  windows.push(window);
  const data = new Map<string, string>();
  if (opts.stored) data.set('wallcal-site-theme', opts.stored);
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      if (opts.storageThrows) throw new window.DOMException('denied', 'SecurityError');
      return storage;
    },
  });

  const writeText = vi.fn((_text: string) =>
    opts.clipboard === 'rejects' ? Promise.reject(new Error('denied')) : Promise.resolve(),
  );
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: opts.clipboard === 'missing' ? undefined : { writeText },
  });

  const timers: Page['timers'] = [];
  (window as unknown as { setTimeout: unknown }).setTimeout = (fn: () => void, ms: number) => {
    timers.push({ fn, ms });
    return timers.length;
  };

  // happy-dom doesn't run inline scripts from document.write, so evaluate them in page order.
  window.document.write(HTML);
  window.eval(window.document.querySelector('#theme-init')!.textContent!);
  if (opts.runSiteJs !== false) window.eval(SITE_JS);
  if (opts.styled) {
    const style = window.document.createElement('style');
    style.textContent = CSS;
    window.document.head.append(style);
  }
  return { window, document: window.document, stored: () => data.get('wallcal-site-theme') ?? null, writeText, timers };
}

const toggle = (page: Page) => page.document.querySelector('#theme-toggle') as unknown as HTMLButtonElement;
const settle = () => new Promise((r) => setTimeout(r, 0));

function hexLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [hexLuminance(a), hexLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function tokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} block in style.css`).toBeGreaterThanOrEqual(0);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map((m) => [m[1], m[2]]));
}

describe('landing page: theme', () => {
  it('defaults to dark with empty storage', () => {
    expect(loadPage().document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies a stored light theme before site.js runs', () => {
    const page = loadPage({ stored: 'light', runSiteJs: false });
    expect(page.document.documentElement.dataset.theme).toBe('light');
  });

  it('stays dark when storage throws', () => {
    expect(loadPage({ storageThrows: true }).document.documentElement.dataset.theme).toBe('dark');
  });

  it('toggle flips theme, label and stored value', () => {
    const page = loadPage();
    const html = page.document.documentElement;
    const button = toggle(page);
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode');

    button.click();
    expect(html.dataset.theme).toBe('light');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');
    expect(page.stored()).toBe('light');

    button.click();
    expect(html.dataset.theme).toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
    expect(page.stored()).toBe('dark');
  });

  it('toggle labels match a stored light theme on load', () => {
    const page = loadPage({ stored: 'light' });
    expect(toggle(page).getAttribute('aria-label')).toBe('Switch to dark mode');
  });

  it('toggle still works when storage throws', () => {
    const page = loadPage({ storageThrows: true });
    toggle(page).click();
    expect(page.document.documentElement.dataset.theme).toBe('light');
  });

  it('marks the document as js-enabled', () => {
    expect(loadPage().document.documentElement.classList.contains('js')).toBe(true);
  });
});

describe('landing page: copy button', () => {
  const copyButton = (page: Page) =>
    page.document.querySelector('button.copy[data-copy="install-yaml"]') as unknown as HTMLButtonElement;

  it('copy button writes the exact YAML', async () => {
    const page = loadPage();
    expect(page.document.querySelector('#install-yaml')!.textContent).toBe(YAML);

    copyButton(page).click();
    await settle();
    expect(page.writeText).toHaveBeenCalledTimes(1);
    expect(page.writeText).toHaveBeenCalledWith(YAML);
    expect(copyButton(page).textContent).toBe('Copied');

    const reset = page.timers.find((t) => t.ms === 2000);
    expect(reset).toBeDefined();
    reset!.fn();
    expect(copyButton(page).textContent).toBe('Copy');
  });

  it.each(['missing', 'rejects'] as const)('copy falls back to selecting text when clipboard %s', async (clipboard) => {
    const page = loadPage({ clipboard });
    expect(() => copyButton(page).click()).not.toThrow();
    await settle();
    expect(page.window.getSelection()!.toString()).toBe(YAML);
  });
});

describe('landing page: colours', () => {
  it('text colours meet WCAG AA in both themes', () => {
    for (const selector of [':root', ':root[data-theme="light"]']) {
      const t = tokens(CSS, selector);
      expect(contrast(t.text, t.bg), `${selector} text`).toBeGreaterThanOrEqual(7);
      expect(contrast(t.muted, t.bg), `${selector} muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#FFFFFF', t.brand), `${selector} button`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accent, t.bg), `${selector} accent`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('landing page: content', () => {
  const doc = () => loadPage({ runSiteJs: false }).document;
  const URLS = [
    'https://my.home-assistant.io/redirect/hacs_repository/?owner=TFoxik&repository=wallcal&category=plugin',
    'https://github.com/TFoxik/wallcal/blob/main/docs/guide.md',
    'https://github.com/TFoxik/wallcal/blob/main/docs/configuration.md',
    'https://github.com/TFoxik/wallcal/issues',
  ];

  it('every image has alt text and an existing file', () => {
    const images = [...doc().querySelectorAll('img')];
    expect(images.length).toBeGreaterThan(10);
    for (const img of images) {
      const src = img.getAttribute('src')!;
      if (img.closest('.brand')) continue;
      expect(img.getAttribute('alt')?.trim(), src).toBeTruthy();
      expect(existsSync(join(SITE, src)), src).toBe(true);
    }
  });

  it('loads nothing from other hosts', () => {
    const external = /^(https?:)?\/\//;
    const d = doc();
    const refs = [
      ...[...d.querySelectorAll('script[src], img[src]')].map((e) => e.getAttribute('src')!),
      ...[...d.querySelectorAll('link[href]')].map((e) => e.getAttribute('href')!),
    ];
    expect(refs.filter((r) => external.test(r))).toEqual([]);
    expect(CSS).not.toMatch(/url\(\s*['"]?(https?:)?\/\//);
    expect(CSS).not.toMatch(/@import/);
  });

  it('in-page links point at real sections', () => {
    const d = doc();
    for (const a of d.querySelectorAll('a[href^="#"]')) {
      const id = a.getAttribute('href')!.slice(1);
      expect(d.getElementById(id), `#${id}`).not.toBeNull();
    }
  });

  it('install and guide links use the pinned URLs', () => {
    const hrefs = [...doc().querySelectorAll('a')].map((a) => a.getAttribute('href'));
    for (const url of URLS) expect(hrefs, url).toContain(url);
  });

  it('every picture has a light twin', () => {
    const darks = [...doc().querySelectorAll('img.shot-dark')];
    expect(darks.length).toBeGreaterThanOrEqual(5);
    for (const dark of darks) {
      const src = dark.getAttribute('src')!;
      expect(src).toMatch(/^img\/[\w-]+-dark\.webp$/);
      const twin = dark.parentElement!.querySelector(`img.shot-light[src="${src.replace('-dark.', '-light.')}"]`);
      expect(twin, src).not.toBeNull();
    }
  });

  it('hero copy is pinned', () => {
    const h1 = doc().querySelector('h1')!;
    expect(h1.textContent!.replace(/\s+/g, ' ').trim()).toBe("Your family's week, on the wall.");
    expect(h1.querySelector('.accent')!.textContent).toBe('on the wall.');
  });

  it('cycle close-up carries the medical note', () => {
    expect(doc().querySelector('#cycle')!.textContent).toContain('not medical advice');
  });

  it('never names another calendar card', () => {
    const text = doc().body.textContent!;
    expect(text).not.toMatch(/Atomic|Week Planner|Calendar Card Pro|Daylight|Skylight|Wall Clock Card/i);
  });
});

describe('landing page: picture swap', () => {
  it.each(['dark', 'light'] as const)('shows exactly one picture of each pair in %s mode', (theme) => {
    const page = loadPage({ stored: theme, styled: true });
    const visible = (el: unknown) => page.window.getComputedStyle(el as never).display !== 'none';
    for (const dark of page.document.querySelectorAll('img.shot-dark')) {
      const light = dark.parentElement!.querySelector('img.shot-light')!;
      expect([visible(dark), visible(light)], dark.getAttribute('src')!).toEqual([theme === 'dark', theme === 'light']);
    }
  });
});

describe('landing page: narrow screens', () => {
  it('install steps use a shrinkable track so long code scrolls inside its block', () => {
    const page = loadPage({ styled: true });
    const steps = page.document.querySelector('.steps')!;
    expect(page.window.getComputedStyle(steps as never).gridTemplateColumns).toBe('minmax(0, 1fr)');
  });
});
