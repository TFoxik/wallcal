import { ENTITY_DISPLAYS } from '../config';
import { hexToRgb, isHex, rgbToHex } from './colors';
import { deepEqual, isEmpty, isPlainObject, type Raw } from './raw-config';
import { select, type FormSchema } from './sections';

const FIELDS = {
  entity: { label: 'Calendar', required: true, selector: { entity: { filter: { domain: 'calendar' } } } },
  name: { label: 'Name', selector: { text: {} } },
  color: { label: 'Colour', selector: { color_rgb: {} } },
  display: { label: 'Show as', selector: select(ENTITY_DISPLAYS) },
  strip_prefix: { label: 'Remove this prefix from titles', selector: { text: {} } },
  suffix: { label: 'Tag after each title', selector: { text: {} } },
  toggle: { label: 'Show/hide chip in the top bar', selector: { boolean: {} } },
  icon: { label: 'Chip icon', description: 'Used by the show/hide chip', selector: { icon: {} } },
};

export const CALENDARS_SCHEMA: FormSchema[] = [
  { name: 'entities', selector: { object: { multiple: true, label_field: 'entity', description_field: 'name', fields: FIELDS } } },
];

const DEFAULTS: Raw = { toggle: false, display: 'chip' };

export function toCalendarItems(entities: unknown): Raw[] {
  if (!Array.isArray(entities)) return [];
  return entities.map((item) => {
    if (typeof item === 'string') return { entity: item };
    const obj = isPlainObject(item) ? { ...item } : {};
    if (isHex(obj.color)) obj.color = hexToRgb(obj.color);
    return obj;
  });
}

export function fromCalendarItems(items: unknown, original: unknown): unknown[] {
  const originals = Array.isArray(original) ? original : [];
  const converted = toCalendarItems(originals);
  const used = new Set<number>();
  return (Array.isArray(items) ? items : []).map((item) => {
    const match = converted.findIndex((c, i) => !used.has(i) && deepEqual(c, item));
    if (match >= 0) {
      used.add(match);
      return originals[match];
    }
    return toYaml(isPlainObject(item) ? item : {});
  });
}

function toYaml(item: Raw): unknown {
  const out: Raw = {};
  for (const [key, value] of Object.entries(item)) {
    if (isEmpty(value) || deepEqual(value, DEFAULTS[key])) continue;
    out[key] = key === 'color' && Array.isArray(value) ? rgbToHex(value) : value;
  }
  const keys = Object.keys(out);
  return keys.length === 1 && keys[0] === 'entity' ? out.entity : out;
}
