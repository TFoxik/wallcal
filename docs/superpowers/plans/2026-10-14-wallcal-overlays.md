# WallCal Floating Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `wallcal-card` host up to three Lovelace cards (todo list, entity, buttons) floating over the bottom of the week grid, each toggled from its own header button.

**Architecture:** `config.ts` parses an `overlays:` list. `data/overlays.ts` keeps per-device shown/hidden state in localStorage. `components/overlay-host.ts` creates hosted cards through HA's `loadCardHelpers().createCardElement`, caches them per overlay key, and pushes `hass` to them directly. The card renders visible overlays as absolutely positioned children of `.grid`, sized with `calc()` from the column count. Header buttons reuse the calendar toggle chips, generalised to a `HeaderToggle { id, … }`.

**Tech Stack:** TypeScript 7, Lit 3 (no decorators; `until` and `repeat` directives), Vitest 5 + happy-dom, Home Assistant 2026.10 dev instance.

**Spec:** `docs/superpowers/specs/2026-10-14-wallcal-overlays-design.md`

## Global Constraints

- Browser floor Chrome / WebView 87 and Safari / iOS 14.5. No `color-mix()`, container queries, `:has()`, ResizeObserver, animations or transitions.
- Unrelated `hass` updates must not re-render WallCal. Hosted cards get `hass` by direct assignment, never through a WallCal render.
- A hidden overlay is not in the DOM.
- At most one overlay per position: `bottom-left | bottom-center | bottom-right`.
- Defaults: `span: 2`, `width: 90%`, `max_height: 40%`, `offset: 8`, `toggle: true`, `visible: false`, `icon: mdi:card-outline`.
- Overlay background comes from the style token `overlay_background` (`--wallcal-overlay-background`), default: column colour plus an 8 % white wash, opaque.
- Storage key `wallcal:overlays`, value `{ [overlayKey]: boolean }`; `overlayKey = position + ':' + hash(JSON(card))`.
- No `innerHTML` / `unsafeHTML` anywhere, including the dev harness.
- Code comments only for non-obvious "why" (repo owner's rule).
- Commit messages: no `Co-Authored-By` or `Claude-Session` trailers (repo owner's rule).
- Storage helpers follow `src/data/hidden.ts` (commit cbd5cd1): stored state wins when storage is readable; the caller's state is used only when reading throws.
- Work on branch `feat/overlays`, not `main`.

## Review Focus

1. Storage blocked (kiosk WebView, private mode): toggling an overlay twice must show then hide it. Re-reading empty storage on every toggle would flip it the same way each time. → Task 2 test "keeps toggling while storage is blocked".
2. A WallCal re-render (refresh tick, week navigation) while an overlay is shown must not detach and reattach the hosted card, or the todo card would drop and redo its websocket subscription every few minutes. → Task 5 test "keeps the same hosted node across re-renders".
3. Hiding the left overlay while the right one stays shown must not move the right card's DOM node. → Task 5 uses `repeat` keyed by overlay key; covered by the same test with two overlays.
4. Editing the overlay's `card:` config (new entity) must create a new card and not keep pushing `hass` to the old one. → Task 4 test "drops cards that are no longer configured", Task 5 test "creates a new card when the card config changes".
5. `span` larger than `days` (e.g. `span: 6` with `days: 5`) must fail validation with a readable message, not render an overlay wider than the grid. → Task 1 test.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/config.ts` | `OverlayConfig`, `overlays` parsing and validation |
| `src/data/overlays.ts` | new: overlay key, per-device shown/hidden state |
| `src/components/header-toggles.ts` | renamed from `calendar-toggles.ts`: round header toggle chips for calendars and overlays |
| `src/components/top-bar.ts` | renders calendar toggles, then overlay toggles |
| `src/components/overlay-host.ts` | new: `OverlayCards` cache, `renderOverlay` template |
| `src/globals.d.ts` | `window.loadCardHelpers` typing |
| `src/wallcal-card.ts` | wires state, toggles, hass forwarding, overlay rendering, touch handling |
| `src/theme/styles.ts` | overlay geometry and theming |
| `src/theme/presets.ts` | `overlay_background` token |
| `dev/ha/config/custom_components/wallcal_fixture/todo.py` | new: in-memory `todo.shopping` |
| `dev/ha/config/configuration.yaml`, `dev/ha/config/ui-lovelace.yaml` | dev overlays |
| `dev/main.ts` | stub card factory + overlay variant for the Vite harness |
| `README.md`, `docs/superpowers/specs/2026-10-13-wallcal-design.md`, `TODO.md` | docs |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/overlays
```

---

### Task 1: Overlay config

**Files:**
- Modify: `src/config.ts`
- Test: `test/config.test.ts`

**Interfaces:**
- Produces:
  - `export const OVERLAY_POSITIONS = ['bottom-left', 'bottom-center', 'bottom-right'] as const;`
  - `export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];`
  - `export interface OverlayConfig { position: OverlayPosition; span: number; width: number; max_height: string; offset: number; toggle: boolean; visible: boolean; icon: string; name?: string; card: Record<string, unknown>; }` (`width` is a fraction 0.1–1, `max_height` a CSS length such as `'40%'` or `'320px'`)
  - `WallCalConfig.overlays: OverlayConfig[]`

- [ ] **Step 1: Write the failing tests**

In `test/config.test.ts`, add `overlays: [],` to the expected object in `'fills every default'` (after `font_url: null,`). Then append inside `describe('normalizeConfig', …)`:

```ts
  describe('overlays', () => {
    const todo = { type: 'todo-list', entity: 'todo.shopping' };
    const overlay = (extra: Record<string, unknown> = {}) => ({ position: 'bottom-right', card: todo, ...extra });
    const parse = (...overlays: unknown[]) => normalizeConfig({ ...minimal, overlays }).overlays;

    it('fills overlay defaults', () => {
      expect(parse(overlay())).toEqual([
        {
          position: 'bottom-right',
          span: 2,
          width: 0.9,
          max_height: '40%',
          offset: 8,
          toggle: true,
          visible: false,
          icon: 'mdi:card-outline',
          card: todo,
        },
      ]);
    });

    it('reads sizes, name and toggle options', () => {
      const [o] = parse(
        overlay({ span: 1, width: '60%', max_height: 320, offset: 72, toggle: false, visible: true, name: 'Shop', icon: 'mdi:cart' }),
      );
      expect(o).toMatchObject({ span: 1, width: 0.6, max_height: '320px', offset: 72, toggle: false, visible: true, name: 'Shop', icon: 'mdi:cart' });
      expect(parse(overlay({ max_height: '25%' }))[0].max_height).toBe('25%');
      expect(parse(overlay({ max_height: '300px' }))[0].max_height).toBe('300px');
    });

    it('allows one overlay per position', () => {
      expect(parse(overlay(), overlay({ position: 'bottom-left' }))).toHaveLength(2);
      expect(() => parse(overlay(), overlay())).toThrow(/only one overlay can use bottom-right/);
    });

    it('rejects invalid overlays', () => {
      expect(() => normalizeConfig({ ...minimal, overlays: {} })).toThrow(/overlays must be a list/);
      expect(() => parse({ card: todo })).toThrow(/overlays\[0\]\.position is required/);
      expect(() => parse(overlay({ position: 'top-left' }))).toThrow(/position must be one of/);
      expect(() => parse(overlay({ span: 8 }))).toThrow(/span/);
      expect(() => parse(overlay({ span: 0 }))).toThrow(/span/);
      expect(() => parse(overlay({ width: 0.8 }))).toThrow(/width/);
      expect(() => parse(overlay({ width: '5%' }))).toThrow(/width/);
      expect(() => parse(overlay({ max_height: '120%' }))).toThrow(/max_height/);
      expect(() => parse(overlay({ max_height: 'tall' }))).toThrow(/max_height/);
      expect(() => parse(overlay({ offset: 500 }))).toThrow(/offset/);
      expect(() => parse({ position: 'bottom-left' })).toThrow(/card/);
      expect(() => parse({ position: 'bottom-left', card: { entity: 'todo.shopping' } })).toThrow(/card needs a type/);
      expect(() => parse(overlay({ icon: 'list' }))).toThrow(/icon/);
      expect(() => parse(overlay({ visible: 'yes' }))).toThrow(/visible/);
    });

    it('limits span to the number of days', () => {
      expect(() => normalizeConfig({ ...minimal, days: 5, overlays: [overlay({ span: 6 })] })).toThrow(
        /overlays\[0\]\.span must be a whole number from 1 to 5/,
      );
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/config.test.ts`
Expected: FAIL (`overlays` is `undefined`).

- [ ] **Step 3: Implement**

In `src/config.ts`, after the `PAST_EVENTS` block add:

```ts
export const OVERLAY_POSITIONS = ['bottom-left', 'bottom-center', 'bottom-right'] as const;
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

export interface OverlayConfig {
  position: OverlayPosition;
  span: number;
  /** Share of the spanned columns, 0.1–1. */
  width: number;
  /** CSS length: a percentage of the grid height or pixels. */
  max_height: string;
  offset: number;
  toggle: boolean;
  visible: boolean;
  icon: string;
  name?: string;
  card: Record<string, unknown>;
}
```

Add `overlays: OverlayConfig[];` to `WallCalConfig` after `period: PeriodConfig;`.

Add `const PERCENT = /^\d+(\.\d+)?%$/;` next to the other regexes.

In `normalizeConfig`, parse `days` once and reuse it (span depends on it):

```ts
  const { style, fontUrl } = parseStyle(section(raw.style, 'style'));
  const days = choice(raw.days, [5, 7] as const, 7, 'days');
```

and in the returned object replace the `days:` line with `days,` and add after `period: { … },`:

```ts
    overlays: parseOverlays(raw.overlays, days),
```

Append the parsers after `parseWeather`:

```ts
function parseOverlays(value: unknown, days: number): OverlayConfig[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('overlays must be a list');
  const used = new Set<OverlayPosition>();
  return value.map((item, i) => {
    const path = `overlays[${i}]`;
    const obj = section(item, path);
    if (obj.position === undefined || obj.position === null) {
      throw new Error(`${path}.position is required (${OVERLAY_POSITIONS.join(', ')})`);
    }
    const position = oneOf(obj.position, OVERLAY_POSITIONS, 'bottom-right', `${path}.position`);
    if (used.has(position)) throw new Error(`${path}.position: only one overlay can use ${position}`);
    used.add(position);

    const card = section(obj.card, `${path}.card`);
    if (typeof card.type !== 'string' || !card.type) {
      throw new Error(`${path}.card needs a type, for example type: todo-list`);
    }
    const icon = obj.icon === undefined ? 'mdi:card-outline' : String(obj.icon);
    if (!ICON.test(icon)) throw new Error(`${path}.icon must look like mdi:flag`);

    const result: OverlayConfig = {
      position,
      span: int(obj.span, 2, 1, days, `${path}.span`),
      width: percent(obj.width, 90, `${path}.width`) / 100,
      max_height: maxHeight(obj.max_height, `${path}.max_height`),
      offset: int(obj.offset, 8, 0, 400, `${path}.offset`),
      toggle: bool(obj.toggle, true, `${path}.toggle`),
      visible: bool(obj.visible, false, `${path}.visible`),
      icon,
      card,
    };
    if (obj.name !== undefined) result.name = String(obj.name);
    return result;
  });
}

function percent(value: unknown, fallback: number, path: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim();
  const n = PERCENT.test(text) ? parseFloat(text) : NaN;
  if (!(n >= 10 && n <= 100)) throw new Error(`${path} must be a percentage from 10% to 100%`);
  return n;
}

function maxHeight(value: unknown, path: string): string {
  if (value === undefined || value === null || value === '') return '40%';
  const text = String(value).trim();
  if (text.endsWith('%')) return `${percent(text, 40, path)}%`;
  const px = Number(text.replace(/px$/, ''));
  if (!Number.isInteger(px) || px < 40 || px > 2000) {
    throw new Error(`${path} must be a percentage from 10% to 100% or pixels from 40 to 2000`);
  }
  return `${px}px`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/config.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "feat: parse floating overlay config"
```

---

### Task 2: Overlay visibility state

**Files:**
- Create: `src/data/overlays.ts`
- Test: `test/overlays.test.ts`

**Interfaces:**
- Consumes: `OverlayConfig` (Task 1).
- Produces:
  - `export type OverlayState = Record<string, boolean>;`
  - `export function overlayKey(overlay: Pick<OverlayConfig, 'position' | 'card'>): string`
  - `export function loadOverlayState(): OverlayState`
  - `export function isOverlayShown(overlay: OverlayConfig, state: OverlayState): boolean`
  - `export function toggleOverlay(overlay: OverlayConfig, current: OverlayState): OverlayState`

- [ ] **Step 1: Write the failing tests**

Create `test/overlays.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeConfig, type OverlayConfig } from '../src/config';
import { isOverlayShown, loadOverlayState, overlayKey, toggleOverlay } from '../src/data/overlays';

const todo = { type: 'todo-list', entity: 'todo.shopping' };
const make = (extra: Record<string, unknown> = {}): OverlayConfig =>
  normalizeConfig({ entities: ['calendar.family'], overlays: [{ position: 'bottom-right', card: todo, ...extra }] }).overlays[0];

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('overlayKey', () => {
  it('is stable for the same config and changes with position or card', () => {
    const key = overlayKey(make());
    expect(overlayKey(make())).toBe(key);
    expect(key.startsWith('bottom-right:')).toBe(true);
    expect(overlayKey(make({ position: 'bottom-left' }))).not.toBe(key);
    expect(overlayKey(make({ card: { ...todo, entity: 'todo.chores' } }))).not.toBe(key);
  });
});

describe('overlay visibility', () => {
  it('uses visible until the device toggles it', () => {
    expect(isOverlayShown(make(), {})).toBe(false);
    expect(isOverlayShown(make({ visible: true }), {})).toBe(true);
  });

  it('always shows an overlay without a toggle', () => {
    const o = make({ toggle: false });
    expect(isOverlayShown(o, { [overlayKey(o)]: false })).toBe(true);
  });

  it('toggles and remembers the choice', () => {
    const o = make();
    const shown = toggleOverlay(o, {});
    expect(isOverlayShown(o, shown)).toBe(true);
    expect(isOverlayShown(o, loadOverlayState())).toBe(true);
    expect(isOverlayShown(o, toggleOverlay(o, shown))).toBe(false);
    expect(isOverlayShown(o, loadOverlayState())).toBe(false);
  });

  it('keeps other overlays stored by another card', () => {
    localStorage.setItem('wallcal:overlays', JSON.stringify({ 'bottom-left:abc': true }));
    toggleOverlay(make(), {});
    expect(loadOverlayState()['bottom-left:abc']).toBe(true);
  });

  it('ignores unreadable or malformed storage', () => {
    localStorage.setItem('wallcal:overlays', '{broken');
    expect(loadOverlayState()).toEqual({});
    localStorage.setItem('wallcal:overlays', JSON.stringify({ a: true, b: 'yes' }));
    expect(loadOverlayState()).toEqual({ a: true });
  });

  it('keeps toggling while storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const o = make();
    const shown = toggleOverlay(o, {});
    expect(isOverlayShown(o, shown)).toBe(true);
    expect(isOverlayShown(o, toggleOverlay(o, shown))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/overlays.test.ts`
Expected: FAIL (module `../src/data/overlays` not found).

- [ ] **Step 3: Implement**

Create `src/data/overlays.ts`:

```ts
import type { OverlayConfig } from '../config';

// One map per device, shared by every card. The key includes a hash of the card config so the same
// position on two dashboards keeps its own state.
const OVERLAYS_KEY = 'wallcal:overlays';

export type OverlayState = Record<string, boolean>;

export function overlayKey(overlay: Pick<OverlayConfig, 'position' | 'card'>): string {
  return `${overlay.position}:${hash(JSON.stringify(overlay.card))}`;
}

// undefined means storage itself is unreachable; corrupt contents still count as readable (empty).
function readStored(): OverlayState | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(OVERLAYS_KEY);
  } catch {
    return undefined;
  }
  try {
    const stored: unknown = JSON.parse(raw ?? '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    return Object.fromEntries(
      Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    );
  } catch {
    return {};
  }
}

export function loadOverlayState(): OverlayState {
  return readStored() ?? {};
}

export function isOverlayShown(overlay: OverlayConfig, state: OverlayState): boolean {
  if (!overlay.toggle) return true;
  return state[overlayKey(overlay)] ?? overlay.visible;
}

// Re-reads storage first so another card's choices are kept; falls back to the card's own state when
// storage is blocked, so the choice still lasts until reload.
export function toggleOverlay(overlay: OverlayConfig, current: OverlayState): OverlayState {
  const state = { ...(readStored() ?? current) };
  state[overlayKey(overlay)] = !isOverlayShown(overlay, state);
  try {
    localStorage.setItem(OVERLAYS_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked (private mode, kiosk policy).
  }
  return state;
}

// FNV-1a: only needs to tell card configs apart.
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/overlays.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/overlays.ts test/overlays.test.ts
git commit -m "feat: remember overlay visibility per device"
```

---

### Task 3: Header toggles for overlays

**Files:**
- Rename: `src/components/calendar-toggles.ts` → `src/components/header-toggles.ts`
- Modify: `src/components/top-bar.ts`, `src/wallcal-card.ts` (import and field rename only)
- Test: `test/components.test.ts`

**Interfaces:**
- Produces:
  - `export interface HeaderToggle { id: string; label: string; color: string; icon?: string; hidden: boolean; }`
  - `export function renderHeaderToggles(toggles: HeaderToggle[], onToggle: (id: string) => void): TemplateResult | typeof nothing`
  - `TopBarProps` gains `overlayToggles: HeaderToggle[]` and `onOverlayToggle(id: string): void`; `toggles` becomes `HeaderToggle[]`.

- [ ] **Step 1: Rename the file**

```bash
git mv src/components/calendar-toggles.ts src/components/header-toggles.ts
```

- [ ] **Step 2: Update the tests first**

In `test/components.test.ts`:
- Import line: `import { renderHeaderToggles, type HeaderToggle } from '../src/components/header-toggles';`
- `describe('renderCalendarToggles', …)` → `describe('renderHeaderToggles', …)`; its fixture becomes `const toggles: HeaderToggle[] = [ { id: 'calendar.svatky', … }, { id: 'calendar.namedays', … } ];` (replace `entity:` with `id:`), and every `renderCalendarToggles(` call becomes `renderHeaderToggles(`.
- In `describe('renderTopBar', …)` add to `props()`: `overlayToggles: [], onOverlayToggle: vi.fn(),`, then add:

```ts
  it('puts overlay toggles after the calendar toggles and reports them separately', () => {
    const onToggle = vi.fn();
    const onOverlayToggle = vi.fn();
    render(
      renderTopBar({
        ...props(),
        toggles: [{ id: 'calendar.work', label: 'Work', color: '#378ADD', hidden: false }],
        overlayToggles: [
          { id: 'bottom-right:abc', label: 'Shopping', color: 'var(--wallcal-accent)', icon: 'mdi:cart', hidden: true },
        ],
        onToggle,
        onOverlayToggle,
      }),
      host,
    );
    const buttons = host.querySelectorAll<HTMLButtonElement>('.bar__end .toggle');
    expect([...buttons].map((b) => b.getAttribute('aria-label'))).toEqual(['Hide Work', 'Show Shopping']);
    buttons[1].click();
    expect(onOverlayToggle).toHaveBeenCalledWith('bottom-right:abc');
    expect(onToggle).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run test/components.test.ts`
Expected: FAIL (`renderHeaderToggles` is not exported).

- [ ] **Step 4: Implement**

`src/components/header-toggles.ts`: rename `CalendarToggle` → `HeaderToggle`, field `entity` → `id`, `renderCalendarToggles` → `renderHeaderToggles`, `onToggle: (id: string) => void`, and `@click=${() => onToggle(t.id)}`. Nothing else changes.

`src/components/top-bar.ts`:

```ts
import { renderHeaderToggles, type HeaderToggle } from './header-toggles';
```

In `TopBarProps` replace `toggles: CalendarToggle[]; onToggle(entity: string): void;` with:

```ts
  toggles: HeaderToggle[];
  overlayToggles: HeaderToggle[];
  onToggle(id: string): void;
  onOverlayToggle(id: string): void;
```

In the `bar__end` template replace `${renderCalendarToggles(p.toggles, p.onToggle)}` with:

```ts
      ${renderHeaderToggles(p.toggles, p.onToggle)} ${renderHeaderToggles(p.overlayToggles, p.onOverlayToggle)}
```

`src/wallcal-card.ts` (keeps compiling; overlay wiring comes in Task 5):
- `import type { HeaderToggle } from './components/header-toggles';`
- `_toggles(...)` returns `HeaderToggle[]` and maps `id: e.entity` instead of `entity: e.entity`.
- In `renderTopBar({...})` add `overlayToggles: [], onOverlayToggle: () => undefined,`.

- [ ] **Step 5: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/components test/components.test.ts src/wallcal-card.ts
git commit -m "refactor: generalise calendar toggle chips into header toggles with an overlay group"
```

---

### Task 4: Overlay card host

**Files:**
- Create: `src/components/overlay-host.ts`
- Modify: `src/globals.d.ts`
- Test: `test/overlay-host.test.ts`

**Interfaces:**
- Consumes: `OverlayConfig` (Task 1), `HomeAssistant` (`src/ha-types.ts`).
- Produces:
  - `export interface HassCard extends HTMLElement { hass?: HomeAssistant }`
  - `export class OverlayCards { card(key: string, config: Record<string, unknown>): Promise<HTMLElement>; set hass(hass: HomeAssistant); retain(keys: Set<string>): void; }`
  - `export function renderOverlay(overlay: OverlayConfig, card: Promise<HTMLElement>): TemplateResult`
  - `window.loadCardHelpers?: () => Promise<{ createCardElement(config: Record<string, unknown>): HTMLElement & { hass?: unknown } }>`

- [ ] **Step 1: Write the failing tests**

Create `test/overlay-host.test.ts`:

```ts
// @vitest-environment happy-dom
import { render } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverlayCards, renderOverlay, type HassCard } from '../src/components/overlay-host';
import { normalizeConfig } from '../src/config';
import type { HomeAssistant } from '../src/ha-types';
import { makeHass } from './fixtures';

const todo = { type: 'todo-list', entity: 'todo.shopping' };
let created: HassCard[];
let createCardElement: ReturnType<typeof vi.fn>;

beforeEach(() => {
  created = [];
  createCardElement = vi.fn((config: Record<string, unknown>) => {
    const el = document.createElement('div') as HassCard;
    el.className = 'hosted';
    el.dataset.type = String(config.type);
    created.push(el);
    return el;
  });
  window.loadCardHelpers = async () => ({ createCardElement });
});

afterEach(() => {
  delete window.loadCardHelpers;
  document.body.replaceChildren();
});

const hassA = (): HomeAssistant => makeHass(async () => []).hass;

describe('OverlayCards', () => {
  it('creates a card once per key with the given config', async () => {
    const cards = new OverlayCards();
    const first = cards.card('k', todo);
    expect(cards.card('k', todo)).toBe(first);
    await first;
    expect(createCardElement).toHaveBeenCalledTimes(1);
    expect(createCardElement).toHaveBeenCalledWith(todo);
  });

  it('gives a new card the current hass and pushes later updates', async () => {
    const cards = new OverlayCards();
    const a = hassA();
    cards.hass = a;
    const el = (await cards.card('k', todo)) as HassCard;
    expect(el.hass).toBe(a);
    const b = hassA();
    cards.hass = b;
    expect(el.hass).toBe(b);
  });

  it('does not assign hass before there is one', async () => {
    const el = await new OverlayCards().card('k', todo);
    expect('hass' in el).toBe(false);
  });

  it('drops cards that are no longer configured', async () => {
    const cards = new OverlayCards();
    const old = (await cards.card('old', todo)) as HassCard;
    cards.retain(new Set(['new']));
    await Promise.resolve();
    const a = hassA();
    cards.hass = a;
    expect(old.hass).toBeUndefined();
    await cards.card('old', todo);
    expect(createCardElement).toHaveBeenCalledTimes(2);
  });

  it('shows a message when the card factory is missing', async () => {
    delete window.loadCardHelpers;
    const el = await new OverlayCards().card('k', todo);
    expect(el.classList.contains('overlay__message')).toBe(true);
    expect(el.textContent).toMatch(/unavailable/);
  });
});

describe('renderOverlay', () => {
  it('places the hosted card in a positioned, sized container', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const overlay = normalizeConfig({
      entities: ['calendar.family'],
      overlays: [{ position: 'bottom-left', span: 1, width: '90%', max_height: 300, offset: 72, card: todo }],
    }).overlays[0];
    const card = new OverlayCards().card('k', todo);
    render(renderOverlay(overlay, card), host);
    await card;
    await Promise.resolve();
    const box = host.querySelector<HTMLElement>('.overlay.overlay--bottom-left');
    expect(box?.querySelector('.hosted')).not.toBeNull();
    expect(box?.style.getPropertyValue('--overlay-span')).toBe('1');
    expect(box?.style.getPropertyValue('--overlay-width')).toBe('0.9');
    expect(box?.style.getPropertyValue('--overlay-max-height')).toBe('300px');
    expect(box?.style.getPropertyValue('--overlay-offset')).toBe('72px');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/overlay-host.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Add the typing**

`src/globals.d.ts`, inside `interface Window`:

```ts
  loadCardHelpers?: () => Promise<{
    createCardElement(config: Record<string, unknown>): HTMLElement & { hass?: unknown };
  }>;
```

- [ ] **Step 4: Implement**

Create `src/components/overlay-host.ts`:

```ts
import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { until } from 'lit/directives/until.js';
import type { OverlayConfig } from '../config';
import type { HomeAssistant } from '../ha-types';

export interface HassCard extends HTMLElement {
  hass?: HomeAssistant;
}

// Cards live here, not in the DOM, so a hidden overlay drops out of the page (and its card stops
// its subscriptions) but showing it again reuses the same element. The promise per key must stay
// the same object between renders, or `until` would swap the node out and reconnect the card.
export class OverlayCards {
  private _cards = new Map<string, Promise<HTMLElement>>();
  private _live = new Set<HassCard>();
  private _hass?: HomeAssistant;

  card(key: string, config: Record<string, unknown>): Promise<HTMLElement> {
    let card = this._cards.get(key);
    if (!card) {
      card = createCard(config).then(
        (el) => {
          if (this._hass) el.hass = this._hass;
          this._live.add(el);
          return el;
        },
        (error: unknown) => message(`Overlay card unavailable: ${error instanceof Error ? error.message : String(error)}`),
      );
      this._cards.set(key, card);
    }
    return card;
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    for (const el of this._live) el.hass = hass;
  }

  retain(keys: Set<string>): void {
    for (const [key, card] of this._cards) {
      if (keys.has(key)) continue;
      this._cards.delete(key);
      void card.then((el) => this._live.delete(el as HassCard));
    }
  }
}

export function renderOverlay(overlay: OverlayConfig, card: Promise<HTMLElement>): TemplateResult {
  const vars = {
    '--overlay-span': String(overlay.span),
    '--overlay-width': String(overlay.width),
    '--overlay-max-height': overlay.max_height,
    '--overlay-offset': `${overlay.offset}px`,
  };
  return html`<div class="overlay overlay--${overlay.position}" style=${styleMap(vars)}>${until(card, nothing)}</div>`;
}

async function createCard(config: Record<string, unknown>): Promise<HassCard> {
  if (!window.loadCardHelpers) throw new Error('the Home Assistant card factory is not available');
  const helpers = await window.loadCardHelpers();
  return helpers.createCardElement(config) as HassCard;
}

function message(text: string): HTMLElement {
  const el = document.createElement('p');
  el.className = 'overlay__message';
  el.textContent = text;
  return el;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/overlay-host.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/overlay-host.ts src/globals.d.ts test/overlay-host.test.ts
git commit -m "feat: host Lovelace cards for overlays through the HA card factory"
```

---

### Task 5: Render overlays in the card

**Files:**
- Modify: `src/wallcal-card.ts`, `src/theme/styles.ts`, `src/theme/presets.ts`
- Test: `test/card.test.ts`

**Interfaces:**
- Consumes: `OverlayConfig`, `WallCalConfig.overlays` (Task 1); `OverlayState`, `overlayKey`, `loadOverlayState`, `isOverlayShown`, `toggleOverlay` (Task 2); `HeaderToggle`, `TopBarProps.overlayToggles`, `onOverlayToggle` (Task 3); `OverlayCards`, `renderOverlay`, `HassCard` (Task 4).

- [ ] **Step 1: Write the failing tests**

Append inside `describe('wallcal-card', …)` in `test/card.test.ts`:

```ts
  describe('overlays', () => {
    const todo = { type: 'todo-list', entity: 'todo.shopping' };
    const withOverlays = (...overlays: Record<string, unknown>[]) => ({ ...config, overlays });
    const right = (extra: Record<string, unknown> = {}) => ({ position: 'bottom-right', card: todo, ...extra });
    const hosted = (el: WallCalCard, position = 'bottom-right') =>
      root(el).querySelector<HTMLElement>(`.overlay--${position} .hosted`);
    let created: Array<HTMLElement & { hass?: unknown }>;

    const settle = async (el: WallCalCard) => {
      await flush(el);
      await flush(el);
    };

    beforeEach(() => {
      created = [];
      window.loadCardHelpers = async () => ({
        createCardElement: (cardConfig: Record<string, unknown>) => {
          const el = document.createElement('div') as HTMLElement & { hass?: unknown };
          el.className = 'hosted';
          el.dataset.entity = String(cardConfig.entity);
          created.push(el);
          return el;
        },
      });
    });

    afterEach(() => {
      delete window.loadCardHelpers;
    });

    it('starts hidden with a header button and shows the card when tapped', async () => {
      const el = await mount(withOverlays(right()), makeHass(async () => []).hass);
      expect(root(el).querySelector('.overlay')).toBeNull();
      const button = root(el).querySelector<HTMLButtonElement>('.toggle');
      expect(button?.getAttribute('aria-label')).toBe('Show todo.shopping');

      button?.click();
      await settle(el);
      expect(hosted(el)).not.toBeNull();
      expect(root(el).querySelector('.toggle')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('names the button from the card title or the entity friendly name', async () => {
      const { hass } = makeHass(async () => []);
      hass.states['todo.shopping'] = { last_changed: '', attributes: { friendly_name: 'Shopping' } };
      const named = await mount(withOverlays(right()), hass);
      expect(root(named).querySelector('.toggle')?.getAttribute('aria-label')).toBe('Show Shopping');
      const titled = await mount(withOverlays(right({ card: { ...todo, title: 'Groceries' } })), hass);
      expect(root(titled).querySelector('.toggle')?.getAttribute('aria-label')).toBe('Show Groceries');
    });

    it('passes every hass update to the hosted card', async () => {
      const { hass } = makeHass(async () => []);
      const el = await mount(withOverlays(right({ visible: true })), hass);
      await settle(el);
      expect(created[0].hass).toBe(hass);
      const next = { ...hass };
      el.hass = next;
      expect(created[0].hass).toBe(next);
    });

    it('keeps the same hosted node across re-renders and when the other overlay hides', async () => {
      const left = { position: 'bottom-left', span: 1, card: { type: 'tile', entity: 'weather.home' }, visible: true };
      const el = await mount(withOverlays(left, right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      const node = hosted(el);
      click(el, '.nav[aria-label="Next week"]');
      await settle(el);
      expect(hosted(el)).toBe(node);
      click(el, '.toggle');
      await settle(el);
      expect(root(el).querySelector('.overlay--bottom-left')).toBeNull();
      expect(hosted(el)).toBe(node);
    });

    it('reuses the card element across hide and show', async () => {
      const el = await mount(withOverlays(right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      const node = hosted(el);
      click(el, '.toggle');
      await settle(el);
      expect(root(el).querySelector('.overlay')).toBeNull();
      click(el, '.toggle');
      await settle(el);
      expect(hosted(el)).toBe(node);
      expect(created).toHaveLength(1);
    });

    it('remembers the choice on this device', async () => {
      const first = await mount(withOverlays(right()), makeHass(async () => []).hass);
      click(first, '.toggle');
      const second = await mount(withOverlays(right()), makeHass(async () => []).hass);
      await settle(second);
      expect(hosted(second)).not.toBeNull();
    });

    it('always shows an overlay with toggle: false and gives it no button', async () => {
      const el = await mount(withOverlays(right({ toggle: false })), makeHass(async () => []).hass);
      await settle(el);
      expect(root(el).querySelector('.toggle')).toBeNull();
      expect(hosted(el)).not.toBeNull();
    });

    it('creates a new card when the card config changes', async () => {
      const el = await mount(withOverlays(right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      el.setConfig(withOverlays(right({ visible: true, card: { ...todo, entity: 'todo.chores' } })));
      await settle(el);
      expect(created).toHaveLength(2);
      expect(hosted(el)?.dataset.entity).toBe('todo.chores');
    });

    it('counts a touch on an overlay as activity but not as touching the day lists', async () => {
      const el = await mount(withOverlays(right({ visible: true })), makeHass(async () => []).hass);
      await settle(el);
      const probe = el as unknown as { _lastListTouch: number; _lastTouch: number };
      hosted(el)?.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
      expect(probe._lastListTouch).toBe(0);
      expect(probe._lastTouch).toBe(Date.now());
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/card.test.ts`
Expected: FAIL (no `.toggle`, no `.overlay`).

- [ ] **Step 3: Wire the card**

In `src/wallcal-card.ts`:

Imports:

```ts
import { repeat } from 'lit/directives/repeat.js';
import { OverlayCards, renderOverlay } from './components/overlay-host';
import { isCalendarEntityId, normalizeConfig, type HeaderTitle, type OverlayConfig, type WallCalConfig } from './config';
import { isOverlayShown, loadOverlayState, overlayKey, toggleOverlay, type OverlayState } from './data/overlays';
```

Reactive state: add `_overlayState: { state: true },` to `static properties`, `declare _overlayState: OverlayState;`, and in the constructor `this._overlayState = loadOverlayState();`.

Private field: `private _overlayCards = new OverlayCards();`

`setConfig`, after `this._config = normalizeConfig(config);`:

```ts
    this._overlayCards.retain(new Set(this._config.overlays.map(overlayKey)));
```

`set hass`, first line after `this._hass = hass;`:

```ts
    this._overlayCards.hass = hass;
```

`render()`: in the `renderTopBar({...})` call replace the Task 3 placeholders with:

```ts
        overlayToggles: this._overlayToggles(config),
        onOverlayToggle: (key) => this._toggleOverlay(key),
```

Change the grid handlers to pass the event:

```ts
        @pointerdown=${(event: Event) => this._touchList(event)}
        @wheel=${{ handleEvent: (event: Event) => this._touchList(event), passive: true }}
```

and after the `${days.map(...)}` block, still inside `.grid`:

```ts
        ${repeat(
          config.overlays.filter((o) => isOverlayShown(o, this._overlayState)),
          overlayKey,
          (o) => renderOverlay(o, this._overlayCards.card(overlayKey(o), o.card)),
        )}
```

New methods next to `_toggles` / `_toggleCalendar`:

```ts
  private _overlayToggles(config: WallCalConfig): HeaderToggle[] {
    return config.overlays
      .filter((o) => o.toggle)
      .map((o) => ({
        id: overlayKey(o),
        label: o.name ?? overlayName(this._hass, o),
        color: 'var(--wallcal-accent)',
        icon: o.icon,
        hidden: !isOverlayShown(o, this._overlayState),
      }));
  }

  private _toggleOverlay(key: string): void {
    const overlay = this._config?.overlays.find((o) => overlayKey(o) === key);
    if (overlay) this._overlayState = toggleOverlay(overlay, this._overlayState);
  }
```

Replace `_touchList`:

```ts
  // The overlays sit inside the grid; using one must not pause auto-scroll of the day lists.
  private _touchList(event: Event): void {
    const inOverlay = event
      .composedPath()
      .some((node) => node instanceof HTMLElement && node.classList.contains('overlay'));
    if (!inOverlay) this._lastListTouch = Date.now();
    this._touch();
  }
```

Module-level helper next to `friendlyName`:

```ts
function overlayName(hass: HomeAssistant | undefined, overlay: OverlayConfig): string {
  const { title, entity, type } = overlay.card;
  if (typeof title === 'string' && title.trim()) return title;
  if (typeof entity === 'string') {
    const name = hass?.states[entity]?.attributes?.friendly_name;
    return typeof name === 'string' && name.trim() ? name : entity;
  }
  return String(type);
}
```

- [ ] **Step 4: Add the token and the styles**

In `src/theme/presets.ts` add `'overlay_background',` to `TOKENS` after `'chip_radius',`, and to `DEFAULT_TOKENS` after `chip_radius`:

```ts
  // Column colour plus a light wash: a touch lighter than the columns it covers, and opaque.
  overlay_background:
    'linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08)), linear-gradient(var(--wallcal-surface), var(--wallcal-surface)), var(--wallcal-background)',
```

(`test/presets.test.ts` already checks every token resolves; no test change needed.)

In `src/theme/styles.ts`, add `position: relative;` to the `.grid` rule, then add after the `.grid` rule:

```css
  .overlay {
    --overlay-col: calc((100% - (var(--wallcal-days, 7) - 1) * var(--wallcal-gap)) / var(--wallcal-days, 7));
    --overlay-band: calc(var(--overlay-span) * var(--overlay-col) + (var(--overlay-span) - 1) * var(--wallcal-gap));
    position: absolute;
    z-index: 1;
    bottom: var(--overlay-offset);
    width: calc(var(--overlay-band) * var(--overlay-width));
    max-height: var(--overlay-max-height);
    overflow: auto;
    box-sizing: border-box;
    background: var(--wallcal-overlay-background);
    border-radius: var(--wallcal-day-radius);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    --ha-card-background: transparent;
    --card-background-color: transparent;
    --ha-card-box-shadow: none;
    --ha-card-border-width: 0;
    --primary-text-color: var(--wallcal-text);
    --secondary-text-color: var(--wallcal-muted);
    --primary-color: var(--wallcal-accent);
    --divider-color: var(--wallcal-divider);
  }
  .overlay--bottom-left {
    left: calc(var(--overlay-band) * (1 - var(--overlay-width)) / 2);
  }
  .overlay--bottom-right {
    right: calc(var(--overlay-band) * (1 - var(--overlay-width)) / 2);
  }
  .overlay--bottom-center {
    left: calc((100% - var(--overlay-band) * var(--overlay-width)) / 2);
  }
  .overlay__message {
    margin: 0;
    padding: 12px 16px;
    color: var(--wallcal-muted);
    font-size: 14px;
  }
```

- [ ] **Step 5: Run all tests, typecheck and build**

Run: `npm test && npm run build`
Expected: all tests PASS; build succeeds. Check `dist/wallcal-card.js` gzipped size stays under 30 KB: `gzip -c dist/wallcal-card.js | wc -c`.

- [ ] **Step 6: Commit**

```bash
git add src/wallcal-card.ts src/theme/styles.ts src/theme/presets.ts test/card.test.ts
git commit -m "feat: float toggleable overlay cards over the bottom of the week grid"
```

---

### Task 6: Dev harnesses and live check

**Files:**
- Create: `dev/ha/config/custom_components/wallcal_fixture/todo.py`
- Modify: `dev/ha/config/configuration.yaml`, `dev/ha/config/ui-lovelace.yaml`, `dev/main.ts`

- [ ] **Step 1: In-memory todo list for dev HA**

Create `dev/ha/config/custom_components/wallcal_fixture/todo.py`:

```python
"""In-memory to-do list for the WallCal dev instance; it resets on restart."""

from __future__ import annotations

from dataclasses import replace
from uuid import uuid4

from homeassistant.components.todo import TodoItem, TodoItemStatus, TodoListEntity, TodoListEntityFeature
from homeassistant.core import HomeAssistant

ITEMS = ("Milk", "Bread", "Call grandma", "Water the plants", "Return library books")


async def async_setup_platform(hass: HomeAssistant, config, async_add_entities, discovery_info=None) -> None:
    async_add_entities([FixtureTodo()])


class FixtureTodo(TodoListEntity):
    _attr_name = "Shopping"
    _attr_unique_id = "wallcal_fixture_shopping"
    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM
        | TodoListEntityFeature.UPDATE_TODO_ITEM
        | TodoListEntityFeature.DELETE_TODO_ITEM
        | TodoListEntityFeature.MOVE_TODO_ITEM
    )

    def __init__(self) -> None:
        self._attr_todo_items = [
            TodoItem(summary=summary, uid=uuid4().hex, status=TodoItemStatus.NEEDS_ACTION) for summary in ITEMS
        ]

    async def async_create_todo_item(self, item: TodoItem) -> None:
        new = replace(item, uid=uuid4().hex, status=item.status or TodoItemStatus.NEEDS_ACTION)
        self._attr_todo_items = [*self._attr_todo_items, new]
        self.async_write_ha_state()

    async def async_update_todo_item(self, item: TodoItem) -> None:
        self._attr_todo_items = [item if existing.uid == item.uid else existing for existing in self._attr_todo_items]
        self.async_write_ha_state()

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        self._attr_todo_items = [item for item in self._attr_todo_items if item.uid not in uids]
        self.async_write_ha_state()

    async def async_move_todo_item(self, uid: str, previous_uid: str | None = None) -> None:
        items = list(self._attr_todo_items)
        moving = next(item for item in items if item.uid == uid)
        items.remove(moving)
        index = 0 if previous_uid is None else next(i for i, item in enumerate(items) if item.uid == previous_uid) + 1
        items.insert(index, moving)
        self._attr_todo_items = items
        self.async_write_ha_state()
```

In `dev/ha/config/configuration.yaml`, after the `calendar:` block:

```yaml
todo:
  - platform: wallcal_fixture
```

- [ ] **Step 2: Overlays on the dev dashboards**

In `dev/ha/config/ui-lovelace.yaml`, add to the Wall view card (after `period:`):

```yaml
        overlays:
          - position: bottom-right
            icon: mdi:format-list-checks
            visible: true
            card:
              type: todo-list
              entity: todo.shopping
          - position: bottom-left
            span: 1
            icon: mdi:weather-partly-cloudy
            visible: true
            card:
              type: tile
              entity: weather.home
```

and to the "Paper 5 days" card (after `moon:`), to check centred geometry on 5 columns:

```yaml
        overlays:
          - position: bottom-center
            span: 3
            visible: true
            icon: mdi:format-list-checks
            card:
              type: todo-list
              entity: todo.shopping
```

- [ ] **Step 3: Stub card factory in the Vite harness**

In `dev/main.ts`, add `'mdi:format-list-checks': '☑️'` and `'mdi:card-outline': '▢'` to `GLYPHS`. After the `ha-icon` definition add:

```ts
// Stand-in for HA's card factory so overlay placement and theming can be checked outside HA.
window.loadCardHelpers = async () => ({
  createCardElement: (config: Record<string, unknown>) => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:12px 16px;color:var(--primary-text-color)';
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.textContent = String(config.title ?? config.entity ?? config.type);
    const rows = ['Milk', 'Bread', 'Call grandma', 'Water the plants', 'Return library books'].map((text) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--divider-color)';
      const box = document.createElement('input');
      box.type = 'checkbox';
      row.append(box, text);
      return row;
    });
    card.append(title, ...rows);
    return card;
  },
});
```

Add a first entry to `VARIANTS`:

```ts
  [
    'Overlays: todo over the weekend, entity bottom-left',
    {
      ...chips,
      weather: { entity: 'weather.home' },
      overlays: [
        { position: 'bottom-right', visible: true, icon: 'mdi:format-list-checks', card: { type: 'todo-list', entity: 'todo.shopping' } },
        { position: 'bottom-left', span: 1, visible: true, icon: 'mdi:weather-partly-cloudy', card: { type: 'tile', entity: 'weather.home' } },
      ],
    },
  ],
```

- [ ] **Step 4: Check in the Vite harness**

Start with preview_start `dev`. Check: the overlay is centred over the Sat/Sun boundary at 90 % of the two columns, floating 8 px above the bottom; each overlay has its own header button that toggles it; the `paper` and `midnight` variants theme the overlay. Screenshot.

- [ ] **Step 5: Check in dev Home Assistant**

Start with preview_start `ha` (it rebuilds and copies the card), open `http://localhost:8124/wall`, and bust the cached card with `fetch('/local/wallcal-card.js', {cache: 'reload'})` then reload. Check:
- The real `todo-list` card renders inside the overlay, items can be checked off and added, and it matches the theme.
- Hiding the overlay removes it from the DOM (in DevTools, `wallcal-card` shadow root has no `.overlay--bottom-right`).
- Showing it again shows the same items immediately.
- The `paper` view's `bottom-center` overlay with `span: 3` sits centred on 5 columns.
- No console errors.

- [ ] **Step 6: Commit**

```bash
git add dev
git commit -m "chore: add an in-memory todo list and overlay examples to the dev harnesses"
```

---

### Task 7: Docs

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-13-wallcal-design.md`, `TODO.md`

- [ ] **Step 1: README**

In the `## Configure` YAML block, after `theme: paper` / `style:` add:

```yaml
overlays:            # small cards floating over the bottom of the week, one per position
  - position: bottom-right   # bottom-left | bottom-center | bottom-right
    span: 2          # day columns it is centred over
    width: 90%       # share of those columns
    max_height: 40%  # of the grid height, or px; scrolls past it
    offset: 8        # px from the bottom, e.g. 72 to clear navbar-card
    icon: mdi:format-list-checks  # header button; toggle: false shows it always
    card:
      type: todo-list
      entity: todo.shopping
```

Under `## Please note` add:

```markdown
- Overlays can hold any card. Built-in HA cards follow the WallCal theme; cards that hard-code
  their colours may not. The panel colour is the `overlay_background` style token. Shown/hidden overlays are remembered per device, like hidden calendars.
```

- [ ] **Step 2: Main spec configuration reference**

In `docs/superpowers/specs/2026-10-13-wallcal-design.md` section 6, add the `overlays:` block from the README step, followed by: `See docs/superpowers/specs/2026-10-14-wallcal-overlays-design.md.`

- [ ] **Step 3: TODO.md**

Append:

```markdown
## Overlay space in covered columns
Events under a shown overlay are hidden until it is toggled off. Pad the covered day lists by the
overlay's measured height (ResizeObserver) so the last events can be scrolled clear of it.
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-13-wallcal-design.md TODO.md
git commit -m "docs: document floating overlays"
```
