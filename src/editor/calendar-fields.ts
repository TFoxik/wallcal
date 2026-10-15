import { ENTITY_DISPLAYS } from '../config';
import { hexToRgb, isHex, rgbToHex } from './colors';
import { isPlainObject, type Raw } from './raw-config';
import { bool, colorField, grid, select, text, type SectionDef } from './sections';

export const CALENDAR: SectionDef = {
  id: 'calendar',
  title: 'Calendar',
  icon: 'mdi:calendar',
  prefix: [],
  rules: {
    defaults: {
      entity: undefined, name: undefined, color: undefined, display: 'chip',
      strip_prefix: undefined, suffix: undefined, toggle: false, icon: undefined,
    },
    fromForm: (f) => ({ ...f, color: Array.isArray(f.color) ? rgbToHex(f.color as number[]) : f.color }),
  },
  lowercase: ['display'],
  labels: {
    entity: 'Calendar',
    color: 'Colour',
    display: 'Show as',
    strip_prefix: 'Remove this prefix from titles',
    suffix: 'Tag after each title',
    toggle: 'Show/hide chip in the top bar',
    icon: 'Chip icon',
  },
  toForm: (v) => (isHex(v.color) ? { ...v, color: hexToRgb(v.color) } : v),
  schema: (f) => [
    { name: 'entity', required: true, selector: { entity: { filter: { domain: 'calendar' } } } },
    grid(text('name'), colorField('color', f.color)),
    grid({ name: 'display', selector: select(ENTITY_DISPLAYS) }, text('strip_prefix'), text('suffix')),
    grid(bool('toggle'), f.toggle === true && { name: 'icon', selector: { icon: {} } }),
  ],
};

/** One editable row per YAML entry, with a map back to the entry as written so untouched rows stay exactly as they were. */
export function calendarRows(entities: unknown): { rows: Raw[]; originals: Map<Raw, unknown> } {
  const originals = new Map<Raw, unknown>();
  const rows = (Array.isArray(entities) ? entities : []).map((entry) => {
    const row = typeof entry === 'string' ? { entity: entry } : isPlainObject(entry) ? entry : {};
    originals.set(row, entry);
    return row;
  });
  return { rows, originals };
}

export function calendarEntries(rows: Raw[], originals: Map<Raw, unknown>): unknown[] {
  return rows.map((row) => {
    if (originals.has(row)) return originals.get(row);
    const keys = Object.keys(row);
    return keys.length === 1 && keys[0] === 'entity' ? row.entity : row;
  });
}
