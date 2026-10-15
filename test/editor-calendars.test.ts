import { describe, expect, it } from 'vitest';
import { CALENDARS_SCHEMA, fromCalendarItems, toCalendarItems } from '../src/editor/calendars';

describe('calendar items', () => {
  const original = ['calendar.work', { entity: 'calendar.family', color: '#7F77DD', toggle: true }, { entity: 'calendar.odd', color: 'var(--x)' }];

  it('converts YAML to selector items', () => {
    expect(toCalendarItems(original)).toEqual([
      { entity: 'calendar.work' },
      { entity: 'calendar.family', color: [127, 119, 221], toggle: true },
      { entity: 'calendar.odd', color: 'var(--x)' },
    ]);
    expect(toCalendarItems(undefined)).toEqual([]);
  });

  it('returns the original values for unchanged items, in any order', () => {
    const items = toCalendarItems(original);
    const result = fromCalendarItems([items[2], items[0], items[1]], original);
    expect(result).toEqual([original[2], original[0], original[1]]);
    expect(result[1]).toBe(original[0]);
  });

  it('writes edited items as compact YAML', () => {
    const items = toCalendarItems(original);
    const edited = { ...items[1], color: [255, 0, 0], toggle: false, display: 'chip', name: '' };
    expect(fromCalendarItems([items[0], edited], original)).toEqual(['calendar.work', { entity: 'calendar.family', color: '#FF0000' }]);
    expect(fromCalendarItems([{ entity: 'calendar.new', toggle: false }], original)).toEqual(['calendar.new']);
  });

  it('uses an object selector list filtered to calendars', () => {
    const field = CALENDARS_SCHEMA[0] as { name: string; selector: { object: Record<string, unknown> } };
    expect(field.name).toBe('entities');
    expect(field.selector.object.multiple).toBe(true);
    expect((field.selector.object.fields as Record<string, { selector: unknown }>).entity.selector).toEqual({ entity: { filter: { domain: 'calendar' } } });
  });
});
