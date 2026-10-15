import { OVERLAY_POSITIONS, OVERLAY_TOGGLES, PERCENT, PILL_STYLES } from '../config';
import type { Raw } from './raw-config';
import { bool, grid, number, select, text, type SectionDef } from './sections';

export const OVERLAY: SectionDef = {
  id: 'overlay',
  title: 'Floating card',
  icon: 'mdi:card-outline',
  prefix: [],
  rules: {
    defaults: {
      position: undefined, toggle: 'header', pill: 'full', visible: false, icon: 'mdi:card-outline',
      name: undefined, span: 2, width: '90%', max_height: '40%', offset: 8,
    },
    fromForm: (f) => ({ ...f, width: typeof f.width === 'number' ? `${f.width}%` : f.width }),
  },
  lowercase: ['position', 'toggle', 'pill'],
  labels: {
    toggle: 'Show and hide with',
    pill: 'Pill style',
    visible: 'Shown on a new device',
    span: 'Day columns',
    max_height: 'Max height (% or px)',
    offset: 'Distance from the bottom',
  },
  toForm: (v: Raw) => ({
    ...v,
    toggle: v.toggle === true ? 'header' : v.toggle === false ? 'none' : v.toggle,
    width: typeof v.width === 'string' && PERCENT.test(v.width) ? parseFloat(v.width) : v.width,
  }),
  schema: (f, ctx) => [
    {
      name: 'position',
      required: true,
      selector: select(OVERLAY_POSITIONS.filter((p) => p === f.position || !(ctx.taken ?? []).includes(p))),
    },
    grid({ name: 'toggle', selector: select(OVERLAY_TOGGLES) }, f.toggle === 'pill' && { name: 'pill', selector: select(PILL_STYLES) }),
    bool('visible'),
    grid({ name: 'icon', selector: { icon: {} } }, text('name')),
    grid(number('span', 1, ctx.days), typeof f.width === 'number' ? number('width', 10, 100, '%') : text('width')),
    grid(text('max_height'), number('offset', 0, 400, 'px')),
  ],
};
