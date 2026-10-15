// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import { CALENDAR, calendarEntries, calendarRows } from '../src/editor/calendar-fields';
import { WallCalCalendarList } from '../src/editor/calendar-list';
import { fieldNames, formData, labelsFor } from '../src/editor/sections';
import { deepFreeze } from './fixtures';

class Stub extends HTMLElement {
  data?: Record<string, unknown>;
  schema?: { name?: string; selector?: Record<string, unknown>; schema?: { name: string; selector: Record<string, unknown> }[] }[];
}

beforeAll(() => {
  customElements.define('ha-form', class extends Stub {});
  customElements.define('wallcal-calendar-list', WallCalCalendarList);
});

const fields = (schema: ReturnType<typeof CALENDAR.schema>) => schema.flatMap((s) => ('schema' in s ? s.schema : [s]));

describe('calendar fields', () => {
  it('shows hex colours in the picker and anything else as text', () => {
    expect(formData(CALENDAR, { entity: 'calendar.work', color: '#7F77DD' }).color).toEqual([127, 119, 221]);
    const hex = fields(CALENDAR.schema(formData(CALENDAR, { color: '#7F77DD' }), { days: 7 }));
    expect(hex.find((f) => f.name === 'color')!.selector).toHaveProperty('color_rgb');
    const css = fields(CALENDAR.schema(formData(CALENDAR, { color: 'var(--x)' }), { days: 7 }));
    expect(css.find((f) => f.name === 'color')!.selector).toHaveProperty('text');
    const unset = fields(CALENDAR.schema(formData(CALENDAR, {}), { days: 7 }));
    expect(unset.find((f) => f.name === 'color')!.selector).toHaveProperty('color_rgb');
  });

  it('shows the chip icon only with the chip toggle on', () => {
    expect(fieldNames(CALENDAR.schema(formData(CALENDAR, {}), { days: 7 }))).not.toContain('icon');
    expect(fieldNames(CALENDAR.schema(formData(CALENDAR, { toggle: true }), { days: 7 }))).toContain('icon');
  });

  it('uses its own labels for names shared with other sections', () => {
    expect(labelsFor(CALENDAR)({ name: 'toggle' })).toBe('Show/hide chip in the top bar');
    expect(labelsFor(CALENDAR)({ name: 'entity' })).toBe('Calendar');
  });
});

async function mount(entities: unknown, states: Record<string, unknown> = {}) {
  const el = document.createElement('wallcal-calendar-list') as WallCalCalendarList;
  Object.assign(el, { entities: deepFreeze(structuredClone(entities)), hass: { states } });
  const changes: unknown[][] = [];
  el.addEventListener('entities-changed', (e) => changes.push((e as CustomEvent).detail.entities));
  document.body.append(el);
  await el.updateComplete;
  return { el, changes, root: el.shadowRoot! };
}

async function expand(el: WallCalCalendarList, i: number) {
  el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.expand')[i].click();
  await el.updateComplete;
  return el.shadowRoot!.querySelector<Stub>('ha-form')!;
}

const change = (form: Stub, values: Record<string, unknown>) =>
  form.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { ...form.data, ...values } } }));

describe('calendar rows', () => {
  it('maps untouched rows back to their YAML entries and collapses edited entity-only rows', () => {
    const entries = ['calendar.a', { entity: 'calendar.b' }, { entity: 'calendar.c', color: '#fff' }];
    const { rows, originals } = calendarRows(entries);
    expect(rows).toEqual([{ entity: 'calendar.a' }, { entity: 'calendar.b' }, { entity: 'calendar.c', color: '#fff' }]);
    expect(calendarEntries(rows, originals)).toEqual(entries);
    expect(calendarEntries(rows, originals)[1]).toBe(entries[1]);
    expect(calendarEntries([{ entity: 'calendar.d' }, { entity: 'calendar.e', name: 'E' }], originals)).toEqual(['calendar.d', { entity: 'calendar.e', name: 'E' }]);
  });
});

describe('wallcal-calendar-list', () => {
  const entities = ['calendar.family', { entity: 'calendar.work', color: '#7F77DD' }];

  it('writes a picked colour as hex and keeps the other calendars as written', async () => {
    const { el, changes } = await mount(entities);
    change(await expand(el, 1), { color: [255, 0, 0] });
    expect(changes).toEqual([['calendar.family', { entity: 'calendar.work', color: '#FF0000' }]]);
  });

  it('goes back to the palette colour with Use default colour', async () => {
    const { el, changes, root } = await mount(entities);
    await expand(el, 1);
    root.querySelector<HTMLButtonElement>('.reset')!.click();
    expect(changes).toEqual([['calendar.family', 'calendar.work']]);
  });

  it('keeps a non-hex colour editable as text and resettable', async () => {
    const { el, changes, root } = await mount([{ entity: 'calendar.work', color: 'var(--x)', toggle: true }]);
    const form = await expand(el, 0);
    expect(form.data!.color).toBe('var(--x)');
    change(form, { name: 'Work' });
    expect(changes.at(-1)).toEqual([{ entity: 'calendar.work', color: 'var(--x)', toggle: true, name: 'Work' }]);
    root.querySelector<HTMLButtonElement>('.reset')!.click();
    expect(changes.at(-1)).toEqual([{ entity: 'calendar.work', toggle: true }]);
  });

  it('offers no reset when the colour comes from the palette', async () => {
    const { el, root } = await mount(['calendar.family']);
    await expand(el, 0);
    expect(root.querySelector('.reset')).toBeNull();
  });

  it('emits the YAML unchanged when a form reports its own data back', async () => {
    const { el, changes } = await mount(entities);
    const form = await expand(el, 0);
    change(form, {});
    expect(changes).toEqual([entities]);
  });

  it('adds an empty calendar row and opens it', async () => {
    const { el, changes, root } = await mount(['calendar.family']);
    root.querySelector<HTMLButtonElement>('.add')!.click();
    expect(changes).toEqual([['calendar.family', {}]]);
    el.entities = changes[0];
    await el.updateComplete;
    expect(root.querySelectorAll('.expand')[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('moves and removes calendars without rewriting them', async () => {
    const { root, changes } = await mount(entities);
    root.querySelectorAll<HTMLButtonElement>('.down')[0].click();
    expect(changes.at(-1)).toEqual([entities[1], entities[0]]);
    root.querySelectorAll<HTMLButtonElement>('.remove')[0].click();
    expect(changes.at(-1)).toEqual([entities[1]]);
  });

  it("keeps the open row's form across hass updates", async () => {
    const { el } = await mount(entities);
    const form = await expand(el, 1);
    const [data, schema] = [form.data, form.schema];
    el.hass = { states: {} } as never;
    await el.updateComplete;
    const after = el.shadowRoot!.querySelector<Stub>('ha-form')!;
    expect(after.data).toBe(data);
    expect(after.schema).toBe(schema);
  });

  it('labels rows by name, then friendly name, then entity id', async () => {
    const { root } = await mount(
      [{ entity: 'calendar.a', name: 'Kids' }, 'calendar.b', 'calendar.c'],
      { 'calendar.b': { attributes: { friendly_name: 'Work' } } },
    );
    expect([...root.querySelectorAll('.title')].map((t) => t.textContent)).toEqual(['Kids', 'Work', 'calendar.c']);
  });
});
