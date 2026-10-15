// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { OVERLAY } from '../src/editor/overlay-fields';
import { WallCalOverlayList } from '../src/editor/overlay-list';
import { applyFormChange } from '../src/editor/raw-config';
import { fieldNames, formData } from '../src/editor/sections';

class Stub extends HTMLElement {
  data?: Record<string, unknown>;
  schema?: unknown;
  value?: unknown;
}

beforeAll(() => {
  for (const tag of ['ha-form', 'hui-card-element-editor', 'hui-card-picker']) customElements.define(tag, class extends Stub {});
  customElements.define('wallcal-overlay-list', WallCalOverlayList);
});

const todo = { position: 'bottom-right', card: { type: 'todo-list', entity: 'todo.shopping' } };

async function mount(overlays: unknown, days = 7) {
  const el = document.createElement('wallcal-overlay-list') as WallCalOverlayList;
  Object.assign(el, { overlays, days, cardEditors: true, hass: {} });
  const changes: unknown[] = [];
  el.addEventListener('overlays-changed', (e) => changes.push((e as CustomEvent).detail.overlays));
  document.body.append(el);
  await el.updateComplete;
  return { el, changes, root: el.shadowRoot! };
}

describe('overlay fields', () => {
  it('offers only free positions plus its own', () => {
    const schema = OVERLAY.schema(formData(OVERLAY, todo), { days: 7, taken: ['bottom-left'] });
    const position = schema.find((s) => 'name' in s && s.name === 'position') as unknown as { selector: { select: { options: { value: string }[] } } };
    expect(position.selector.select.options.map((o) => o.value)).toEqual(['bottom-center', 'bottom-right']);
  });

  it('shows pill style only with the pill toggle and caps span at the day count', () => {
    expect(fieldNames(OVERLAY.schema(formData(OVERLAY, todo), { days: 5, taken: [] }))).not.toContain('pill');
    const pill = OVERLAY.schema(formData(OVERLAY, { ...todo, toggle: 'pill' }), { days: 5, taken: [] });
    expect(fieldNames(pill)).toContain('pill');
    const span = pill.flatMap((s) => ('schema' in s ? s.schema : [s])).find((f) => f.name === 'span')!;
    expect(span.selector).toEqual({ number: { min: 1, max: 5, step: 1, mode: 'box' } });
  });

  it('round-trips width and legacy toggle values', () => {
    const legacy = { ...todo, toggle: true, width: '75%' };
    const before = formData(OVERLAY, legacy);
    expect(before).toMatchObject({ toggle: 'header', width: 75 });
    expect(applyFormChange(legacy, [], before, { ...before, offset: 72 }, OVERLAY.rules)).toEqual({ ...legacy, offset: 72 });
    expect(applyFormChange(legacy, [], before, { ...before, width: 50 }, OVERLAY.rules)).toEqual({ ...legacy, width: '50%' });
  });
});

describe('wallcal-overlay-list', () => {
  it('adds an overlay at the first free position', async () => {
    const { root, changes } = await mount([todo]);
    root.querySelector<HTMLButtonElement>('.add')!.click();
    expect(changes).toEqual([[todo, { position: 'bottom-left' }]]);
  });

  it('treats a hand-written mixed-case position as taken', async () => {
    const written = { position: 'Bottom-Right', card: { type: 'todo-list' } };
    const { root, changes } = await mount([written]);
    root.querySelector<HTMLButtonElement>('.add')!.click();
    expect(changes).toEqual([[written, { position: 'bottom-left' }]]);
  });

  it('skips a mixed-case position that sits first in the order', async () => {
    const written = { position: 'Bottom-Left', card: { type: 'todo-list' } };
    const { root, changes } = await mount([written]);
    root.querySelector<HTMLButtonElement>('.add')!.click();
    expect(changes).toEqual([[written, { position: 'bottom-center' }]]);
  });

  it('does not offer a position another overlay holds in mixed case', async () => {
    const { el, root } = await mount([
      { position: 'Bottom-Left', card: { type: 'markdown' } },
      { position: 'bottom-right', card: { type: 'todo-list' } },
    ]);
    root.querySelectorAll<HTMLButtonElement>('.expand')[1].click();
    await el.updateComplete;
    const schema = root.querySelector<Stub>('ha-form')!.schema as { name: string; selector: { select: { options: { value: string }[] } } }[];
    expect(schema.find((s) => s.name === 'position')!.selector.select.options.map((o) => o.value)).toEqual(['bottom-center', 'bottom-right']);
  });

  it('shows mixed-case overlay enums in lower case', () => {
    expect(formData(OVERLAY, { position: 'Bottom-Right', toggle: 'Pill', pill: 'Compact' })).toMatchObject({
      position: 'bottom-right', toggle: 'pill', pill: 'compact',
    });
  });

  it('disables add when every position is used', async () => {
    const all = ['bottom-left', 'bottom-center', 'bottom-right'].map((position) => ({ position, card: { type: 'todo-list' } }));
    const { root } = await mount(all);
    expect(root.querySelector<HTMLButtonElement>('.add')!.disabled).toBe(true);
  });

  it('moves and removes overlays, and an empty list is reported as empty', async () => {
    const other = { position: 'bottom-left', card: { type: 'markdown' } };
    const { root, changes } = await mount([todo, other]);
    root.querySelectorAll<HTMLButtonElement>('.down')[0].click();
    expect(changes.at(-1)).toEqual([other, todo]);
    const single = await mount([todo]);
    single.root.querySelector<HTMLButtonElement>('.remove')!.click();
    expect(single.changes).toEqual([[]]);
  });

  it('inner card change is contained and applied to that overlay only', async () => {
    const { el, root, changes } = await mount([todo]);
    root.querySelector<HTMLButtonElement>('.expand')!.click();
    await el.updateComplete;
    const outside = vi.fn();
    document.body.addEventListener('config-changed', outside);
    const editor = root.querySelector('hui-card-element-editor')!;
    editor.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: 'todo-list', entity: 'todo.other' } }, bubbles: true, composed: true }));
    expect(outside).not.toHaveBeenCalled();
    expect(changes).toEqual([[{ ...todo, card: { type: 'todo-list', entity: 'todo.other' } }]]);
  });

  it('keeps GUImode-changed from the inner editor and picker away from HA', async () => {
    const { el, root } = await mount([todo, { position: 'bottom-left' }]);
    const outside = vi.fn();
    document.body.addEventListener('GUImode-changed', outside);
    const fire = (target: Element) =>
      target.dispatchEvent(new CustomEvent('GUImode-changed', { detail: { guiMode: false, guiModeAvailable: false }, bubbles: true, composed: true }));
    root.querySelectorAll<HTMLButtonElement>('.expand')[0].click();
    await el.updateComplete;
    fire(root.querySelector('hui-card-element-editor')!);
    root.querySelectorAll<HTMLButtonElement>('.expand')[1].click();
    await el.updateComplete;
    fire(root.querySelector('hui-card-picker')!);
    document.body.removeEventListener('GUImode-changed', outside);
    expect(outside).not.toHaveBeenCalled();
  });

  it('shows the card picker for an overlay without a card yet', async () => {
    const { el, root, changes } = await mount([{ position: 'bottom-left' }]);
    root.querySelector<HTMLButtonElement>('.expand')!.click();
    await el.updateComplete;
    const outside = vi.fn();
    document.body.addEventListener('config-changed', outside);
    root.querySelector('hui-card-picker')!.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: 'markdown', content: '' } }, bubbles: true, composed: true }));
    document.body.removeEventListener('config-changed', outside);
    expect(outside).not.toHaveBeenCalled();
    expect(changes).toEqual([[{ position: 'bottom-left', card: { type: 'markdown', content: '' } }]]);
  });

  it('keeps the same overlay expanded when a neighbour moves past it', async () => {
    const other = { position: 'bottom-left', card: { type: 'markdown' } };
    const { el, root } = await mount([other, todo]);
    root.querySelectorAll<HTMLButtonElement>('.expand')[1].click();
    await el.updateComplete;
    root.querySelectorAll<HTMLButtonElement>('.down')[0].click();
    el.overlays = [todo, other];
    await el.updateComplete;
    expect(root.querySelectorAll('ha-form')).toHaveLength(1);
    expect((root.querySelector('ha-form') as unknown as { data: { position: string } }).data.position).toBe('bottom-right');
  });

  it('falls back to a note when HA card editors are unavailable', async () => {
    const { el, root } = await mount([todo]);
    el.cardEditors = false;
    root.querySelector<HTMLButtonElement>('.expand')!.click();
    await el.updateComplete;
    expect(root.querySelector('hui-card-element-editor')).toBeNull();
    expect(root.textContent).toContain('Show code editor');
  });
});
