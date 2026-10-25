import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs');
const CONFIG_PATH = join(DOCS, '.vitepress', 'config.mts');

interface SidebarGroup {
  text: string;
  items: { text: string; link: string }[];
}

interface SiteConfig {
  srcExclude?: string[];
  markdown?: { image?: { lazyLoading?: boolean } };
  vite?: { server?: { fs?: { deny?: string[] } } };
  head?: [string, Record<string, string>][];
  themeConfig: { sidebar: SidebarGroup[] };
}

async function siteConfig(): Promise<SiteConfig> {
  // A plain string path keeps tsc from type-checking the VitePress config as part of the tests.
  const path: string = CONFIG_PATH;
  return (await import(path)).default as SiteConfig;
}


// The pre-site pages kept as pointers for links from released card versions.
const OLD_PAGES = ['guide.md', 'configuration.md'];

const pageFile = (link: string) => join(DOCS, `${link.split('#')[0].replace(/\/$/, '/index')}.md`);
const pageExists = (link: string) => existsSync(pageFile(link));

describe('docs site: structure', () => {
  it('every sidebar link points to an existing page', async () => {
    const links = (await siteConfig()).themeConfig.sidebar.flatMap((g) => g.items.map((i) => i.link));
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) expect(pageExists(link), link).toBe(true);
  });

  it('sidebar follows the parts of the card', async () => {
    const groups = (await siteConfig()).themeConfig.sidebar.map((g) => g.text);
    expect(groups).toEqual(['Start', 'Find a setting', 'Parts of the card', 'Look', 'Recipes', 'Reference']);
  });

  it('planning notes and old pointer pages stay out of the site', async () => {
    const exclude = (await siteConfig()).srcExclude ?? [];
    for (const pattern of ['superpowers/**', ...OLD_PAGES]) expect(exclude).toContain(pattern);
  });

  it('the docs dev server refuses the dev Home Assistant config and local tool state', async () => {
    // VitePress always allow-lists the whole repo, so only fs.deny (checked first by Vite) can keep these out.
    const deny = (await siteConfig()).vite?.server?.fs?.deny ?? [];
    expect(deny).toEqual(expect.arrayContaining(['**/dev/ha/config/**', '**/.claude/**', '**/.superpowers/**']));
  });

  it('docs load nothing from other hosts', async () => {
    const external = /^(https?:)?\/\//;
    const urls = ((await siteConfig()).head ?? []).flatMap(([, attrs]) => Object.values(attrs));
    expect(urls.filter((u) => external.test(u))).toEqual([]);
    const css = readFileSync(join(DOCS, '.vitepress', 'theme', 'style.css'), 'utf8');
    expect(css).not.toMatch(/url\(\s*['"]?(https?:)?\/\//);
    expect(css).not.toMatch(/@import/);
  });
});

function docPages(dir = DOCS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'superpowers' || e.name.startsWith('.') || e.name === 'public' ? [] : docPages(full);
    return e.name.endsWith('.md') && !OLD_PAGES.includes(relative(DOCS, full)) ? [full] : [];
  });
}

const docCache = new Map<string, string>();
const readDoc = (file: string) => docCache.get(file) ?? docCache.set(file, readFileSync(file, 'utf8')).get(file)!;
const pagesIn = (dir: string) => readdirSync(join(DOCS, dir)).filter((f) => f.endsWith('.md')).map((f) => join(DOCS, dir, f));
const partPages = () => [...pagesIn('parts'), ...pagesIn('look')];
const yamlBlocks = (md: string) => [...md.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]);
const frontmatter = (md: string): Record<string, unknown> => {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  return m ? YAML.parse(m[1]) : {};
};

// The panel headers the editor actually renders: literal _panel('…') titles plus the sections it maps through _panel(s.title).
function editorPanels(): string[] {
  const sections = readFileSync(join(ROOT, 'src/editor/sections.ts'), 'utf8');
  const editor = readFileSync(join(ROOT, 'src/editor/wallcal-card-editor.ts'), 'utf8');
  const mapped = editor.match(/\[([A-Z_, ]+)\]\.map\(\(s\) => this\._panel\(s\.title/)![1].split(',').map((n) => n.trim());
  const titleOf = (name: string) => sections.match(new RegExp(`export const ${name}: SectionDef = \\{\\s*id: '[^']+',\\s*title: '([^']+)'`))![1];
  return [...[...editor.matchAll(/_panel\('([^']+)'/g)].map((m) => m[1]), ...mapped.map(titleOf)];
}

describe('docs site: content', () => {
  it('every recipe matches its dev-harness view', () => {
    const views = YAML.parse(readFileSync(join(ROOT, 'dev/ha/config/dashboards/recipes.yaml'), 'utf8'), { merge: true }).views as {
      path?: string;
      cards?: unknown[];
    }[];
    const recipes = pagesIn('recipes');
    expect(recipes).toHaveLength(4);
    for (const file of recipes) {
      const md = readDoc(file);
      const view = views.find((v) => v.path === frontmatter(md).harnessView);
      expect(view, file).toBeDefined();
      expect(YAML.parse(yamlBlocks(md)[0]), file).toEqual(view!.cards![0]);
    }
  });

  it('editor lines name real panels', () => {
    const panels = editorPanels();
    expect([...panels].sort()).toEqual(['Calendars', 'Cycle', 'Floating cards', 'Moon', 'Theme & style', 'Top bar', 'View', 'Weather', 'Week']);
    let count = 0;
    for (const file of docPages()) {
      for (const m of readDoc(file).matchAll(/\*\*In the visual editor:\*\* ([^→\n]+?)(?: →|\n|$)/g)) {
        count++;
        expect(panels, `${relative(DOCS, file)}: ${m[1]}`).toContain(m[1].trim());
      }
    }
    expect(count).toBeGreaterThan(15);
  });

  it('each part page shows editor and YAML', () => {
    const files = partPages();
    for (const file of files) {
      const md = readDoc(file);
      expect(/\*\*In the visual editor:\*\*|YAML only/.test(md), file).toBe(true);
      expect(md, file).toContain('**In YAML:**');
    }
  });

  it('weather wording matches the troubleshooting page', () => {
    expect(readDoc(join(DOCS, 'parts/day-header.md'))).toContain('daily (or twice-daily) forecast');
  });

  it('every YAML snippet parses', () => {
    for (const file of docPages()) {
      for (const block of yamlBlocks(readDoc(file))) {
        expect(() => YAML.parse(block), `${relative(DOCS, file)}:\n${block}`).not.toThrow();
      }
    }
  });

  it('complete cards are complete', () => {
    const files = [join(DOCS, 'start/first-card.md'), ...pagesIn('recipes')];
    for (const file of files) {
      const card = YAML.parse(yamlBlocks(readDoc(file))[0] ?? '');
      expect(card?.type, file).toBe('custom:wallcal-card');
      expect(card?.entities, file).toBeTruthy();
    }
  });
});

// Same rule as VitePress's heading slugs (@mdit-vue/shared slugify).
const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\;:"'“”‘’<>,.?/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase();

// A heading's id: its custom {#id} when it has one, else the slug of its text.
const headingIds = (link: string) =>
  [...readDoc(pageFile(link)).matchAll(/^#{1,3} (.+)$/gm)].map((m) => m[1].match(/\{#([\w-]+)\}\s*$/)?.[1] ?? slugify(m[1].replace(/`/g, '')));

interface PartMapData {
  dark: string;
  light: string;
  alt: string;
  width: number;
  height: number;
  dots: { n: number; label: string; href: string; x: number; y: number }[];
}

const IMG = join(DOCS, 'public', 'img');
const readMap = (name: string) => JSON.parse(readFileSync(join(IMG, `${name}.json`), 'utf8')) as PartMapData;
const partMapSource = () => readFileSync(join(DOCS, '.vitepress', 'theme', 'PartMap.vue'), 'utf8');

describe('docs site: pictures and maps', () => {
  it('every docs image exists', () => {
    for (const file of docPages()) {
      for (const m of readDoc(file).matchAll(/\]\(\/img\/([^)\s]+)\)/g)) {
        expect(existsSync(join(IMG, m[1])), `${relative(DOCS, file)}: ${m[1]}`).toBe(true);
      }
    }
  });

  it.each([
    ['card-map', ['Title', 'Calendar chips', 'Week arrows & Today', 'Day header', 'Weather', 'Name days & holidays', 'Moon', 'All-day events', 'Events & colours', '"+N more"', 'Floating card']],
    ['day-header', ['Date', 'Weekday', 'Cycle ring', 'Weather', 'Name days', 'Moon', 'Fertile tint']],
  ])('%s map is well-formed and its dots link to real sections', (name, labels) => {
    const map = readMap(name);
    expect(existsSync(join(IMG, map.dark)), map.dark).toBe(true);
    expect(existsSync(join(IMG, map.light)), map.light).toBe(true);
    expect(map.dots.map((d) => d.label)).toEqual(labels);
    expect(map.dots.map((d) => d.n)).toEqual(labels.map((_, i) => i + 1));
    for (const dot of map.dots) {
      expect(dot.x, dot.label).toBeGreaterThanOrEqual(0);
      expect(dot.x, dot.label).toBeLessThanOrEqual(100);
      expect(dot.y, dot.label).toBeGreaterThanOrEqual(0);
      expect(dot.y, dot.label).toBeLessThanOrEqual(100);
      expect(pageExists(dot.href), dot.href).toBe(true);
      const anchor = dot.href.split('#')[1];
      if (anchor) expect(headingIds(dot.href), dot.href).toContain(anchor);
    }
  });

  it('PartMap dots are named by number and label, images lazy and described', () => {
    const vue = partMapSource();
    expect(vue).toContain(':aria-label="`${d.n}. ${d.label}`"');
    expect(vue).toContain(':alt="data.alt"');
    expect(vue.match(/loading="lazy"/g)).toHaveLength(2);
    for (const name of ['card-map', 'day-header']) {
      expect(readMap(name).alt.length, name).toBeGreaterThan(20);
    }
  });

  it('cycle tracking is findable by "fertile"', () => {
    const md = readDoc(join(DOCS, 'parts/day-header.md'));
    expect(md).toMatch(/^## .*fertile window.*\{#cycle-tracking\}$/m);
  });

  it('PartMap resolves URLs with the site base', () => {
    const vue = partMapSource();
    expect(vue).toContain('withBase(');
    expect(vue).not.toMatch(/src="\/img/);
  });
});

describe('docs site: editor screenshots', () => {
  const panelFile = (panel: string) => `editor-${panel.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}-dark.webp`;

  it('each part page shows a screenshot of every editor panel it names', () => {
    const files = partPages();
    for (const file of files) {
      const md = readDoc(file);
      const named = new Set([...md.matchAll(/\*\*In the visual editor:\*\* ([^→\n]+?) →/g)].map((m) => m[1].trim()));
      for (const panel of named) expect(md, `${relative(DOCS, file)} → ${panel}`).toContain(`/img/${panelFile(panel)}`);
    }
  });
});

describe('docs site: deploy', () => {
  const workflow = () =>
    YAML.parse(readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8')) as {
      jobs: Record<string, { needs?: string; permissions?: Record<string, string>; steps: { run?: string; uses?: string }[] }>;
    };

  it('builds without the deploy token and deploys without running installs', () => {
    const { jobs } = workflow();
    expect(jobs.build.permissions).toEqual({ contents: 'read' });
    expect(jobs.build.steps.some((s) => s.run === 'npm ci')).toBe(true);
    expect(jobs.deploy.needs).toBe('build');
    expect(jobs.deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
    expect(jobs.deploy.steps.every((s) => s.run === undefined)).toBe(true);
  });

  it('publishes a site-wide 404 page', () => {
    const run = workflow().jobs.build.steps.map((s) => s.run ?? '').join('\n');
    expect(run).toContain('cp _site/docs/404.html _site/404.html');
  });

  it('docs images load lazily so the hidden light/dark twin is not fetched', async () => {
    expect((await siteConfig()).markdown?.image?.lazyLoading).toBe(true);
  });
});

describe('docs site: old links', () => {
  it('old guide links still lead to the site', () => {
    for (const [file, url] of [['guide.md', 'https://tfoxik.github.io/wallcal/docs/'], ['configuration.md', 'https://tfoxik.github.io/wallcal/docs/reference/options']]) {
      const md = readDoc(join(DOCS, file));
      expect(md, file).toContain(url);
      expect(md.trim().split('\n').length, file).toBeLessThanOrEqual(10);
    }
  });

  it('README links the docs site', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    expect(readme).toContain('https://tfoxik.github.io/wallcal/docs/');
    expect(readme).toContain('https://tfoxik.github.io/wallcal/docs/reference/options');
    expect(readme).not.toMatch(/\]\(docs\/(guide|configuration)\.md/);
  });
});

describe('docs site: light and dark pictures', () => {
  // Pictures that look the same in both modes: theme previews and the Midnight-only bedroom recipe.
  const themeNeutral = /^(theme-(default|paper|midnight)|recipe-bedroom)\.webp$/;

  it('every picture comes as a dark/light pair shown by mode', () => {
    for (const file of docPages()) {
      const md = readDoc(file);
      for (const m of md.matchAll(/\]\(\/img\/([\w-]+\.webp)\)(\{[^}]*\})?/g)) {
        const [, name, attrs = ''] = m;
        if (themeNeutral.test(name)) continue;
        const where = `${relative(DOCS, file)}: ${name}`;
        const pair = name.match(/^(.+)-(dark|light)\.webp$/);
        expect(pair, where).not.toBeNull();
        expect(attrs, where).toContain(`.${pair![2]}-only`);
        const twin = `/img/${pair![1]}-${pair![2] === 'dark' ? 'light' : 'dark'}.webp`;
        expect(md, where).toContain(twin);
      }
    }
  });
});
