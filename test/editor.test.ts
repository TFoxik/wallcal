// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import { defineEditor, type WallCalCardEditor } from '../src/editor/wallcal-card-editor';
import { deepFreeze } from './fixtures';

class Stub extends HTMLElement {
  data?: Record<string, unknown>;
  schema?: { name?: string; schema?: { name: string }[] }[];
}

beforeAll(() => {
  for (const tag of ['ha-form', 'hui-card-element-editor', 'hui-card-picker']) customElements.define(tag, class extends Stub {});
  defineEditor();
});

const base = { type: 'custom:wallcal-card', entities: ['calendar.family'], custom_key: { kept: true } };

async function mount(config: Record<string, unknown>) {
  const el = document.createElement('wallcal-card-editor') as WallCalCardEditor;
  el.hass = {} as never;
  el.setConfig(deepFreeze(structuredClone(config)));
  const events: Record<string, unknown>[] = [];
  el.addEventListener('config-changed', (e) => events.push((e as CustomEvent).detail.config));
  document.body.append(el);
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  return { el, events };
}

function form(el: WallCalCardEditor, field: string): Stub {
  const forms = [...el.shadowRoot!.querySelectorAll<Stub>('ha-form')];
  const found = forms.find((f) => (f.schema ?? []).some((s) => s.name === field || s.schema?.some((c) => c.name === field)));
  if (!found) throw new Error(`no form with ${field}`);
  return found;
}

function change(target: Stub, values: Record<string, unknown>) {
  target.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { ...target.data, ...values } } }));
}

describe('wallcal-card-editor', () => {
  it('emits nothing when a form reports its own data back', async () => {
    const { el, events } = await mount(base);
    change(form(el, 'days'), {});
    change(form(el, 'entities'), {});
    expect(events).toEqual([]);
  });

  it('writes a changed field and keeps everything else', async () => {
    const { el, events } = await mount(base);
    change(form(el, 'days'), { days: '5' });
    expect(events).toEqual([{ ...base, days: 5 }]);
  });

  it('removes a field set back to its default', async () => {
    const { el, events } = await mount({ ...base, days: 5 });
    change(form(el, 'days'), { days: '7' });
    expect(events).toEqual([base]);
  });

  it('shows an invalid edit and does not emit it', async () => {
    const { el, events } = await mount(base);
    change(form(el, 'refresh_interval'), { refresh_interval: 10 });
    await el.updateComplete;
    expect(events).toEqual([]);
    expect(el.shadowRoot!.querySelector('ha-alert')!.textContent).toContain('refresh_interval');
  });

  it('removing the last calendar shows the error and emits nothing', async () => {
    const { el, events } = await mount(base);
    change(form(el, 'entities'), { entities: [] });
    await el.updateComplete;
    expect(events).toEqual([]);
    expect(el.shadowRoot!.querySelector('ha-alert')!.textContent).toContain('at least one calendar');
  });

  it('writes calendar colours as hex and keeps untouched calendars as written', async () => {
    const config = { ...base, entities: ['calendar.family', { entity: 'calendar.work', color: '#7F77DD' }] };
    const { el, events } = await mount(config);
    const items = form(el, 'entities').data!.entities as Record<string, unknown>[];
    change(form(el, 'entities'), { entities: [items[0], { ...items[1], color: [255, 0, 0] }] });
    expect(events).toEqual([{ ...config, entities: ['calendar.family', { entity: 'calendar.work', color: '#FF0000' }] }]);
  });

  it('keeps form data across hass updates', async () => {
    const { el } = await mount(base);
    const before = [...el.shadowRoot!.querySelectorAll<Stub>('ha-form')].map((f) => [f.data, f.schema]);
    el.hass = { states: {} } as never;
    await el.updateComplete;
    const after = [...el.shadowRoot!.querySelectorAll<Stub>('ha-form')].map((f) => [f.data, f.schema]);
    after.forEach(([data, schema], i) => {
      expect(data).toBe(before[i][0]);
      expect(schema).toBe(before[i][1]);
    });
  });

  it('setConfig echo is a no-op', async () => {
    const { el, events } = await mount(base);
    change(form(el, 'days'), { days: '5' });
    await el.updateComplete;
    const data = form(el, 'days').data;
    el.setConfig(deepFreeze(structuredClone(events[0])));
    expect(el.isUpdatePending).toBe(false);
    await el.updateComplete;
    expect(form(el, 'days').data).toBe(data);
    expect(events).toHaveLength(1);
  });

  it('removes the overlays key when the last overlay is removed', async () => {
    const config = { ...base, overlays: [{ position: 'bottom-right', card: { type: 'todo-list' } }] };
    const { el, events } = await mount(config);
    const list = el.shadowRoot!.querySelector('wallcal-overlay-list')!;
    list.dispatchEvent(new CustomEvent('overlays-changed', { detail: { overlays: [] } }));
    expect(events).toEqual([base]);
  });

  it('an overlay added without a card shows the error and emits nothing', async () => {
    const { el, events } = await mount(base);
    const list = el.shadowRoot!.querySelector('wallcal-overlay-list')!;
    list.dispatchEvent(new CustomEvent('overlays-changed', { detail: { overlays: [{ position: 'bottom-left' }] } }));
    await el.updateComplete;
    expect(events).toEqual([]);
    expect(el.shadowRoot!.querySelector('ha-alert')!.textContent).toContain('needs a type');
  });

  it('reports every form its own data back without emitting or showing NaN', async () => {
    const config = {
      type: 'custom:wallcal-card',
      days: '5',
      time_format: 24,
      weekday_format: 'Long',
      header: { align: 'Center', title: 'Our week' },
      moon: { enabled: true, hemisphere: 'South' },
      period: { enabled: true, last_period: new Date(Date.UTC(2026, 9, 2)), cycle_length: 30 },
      weather: { entity: 'weather.home', show_low: false },
      theme: 'Paper',
      style: { accent: 'rgba(1,2,3,0.5)', date_size: '2rem', gap: '6px', text: '#abc' },
      entities: ['calendar.family', { entity: 'calendar.work', color: 'var(--x)', toggle: true, display: 'label' }],
      overlays: [{ position: 'Bottom-Right', toggle: true, width: '75%', card: { type: 'todo-list', entity: 'todo.shopping' } }],
      custom_key: { kept: true },
    };
    const { el, events } = await mount(config);
    const list = el.shadowRoot!.querySelector('wallcal-overlay-list') as HTMLElement & { updateComplete: Promise<boolean> };
    list.shadowRoot!.querySelector<HTMLButtonElement>('.expand')!.click();
    await list.updateComplete;

    const forms = [
      ...el.shadowRoot!.querySelectorAll<Stub>('ha-form'),
      ...list.shadowRoot!.querySelectorAll<Stub>('ha-form'),
    ];
    expect(forms).toHaveLength(9);
    const hasNaN = (v: unknown): boolean =>
      typeof v === 'number' ? Number.isNaN(v) : v !== null && typeof v === 'object' ? Object.values(v).some(hasNaN) : false;
    for (const f of forms) {
      expect(hasNaN(f.data)).toBe(false);
      f.dispatchEvent(new CustomEvent('value-changed', { detail: { value: f.data } }));
    }
    expect(events).toEqual([]);
  });
});
