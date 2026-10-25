import { describe, expect, it } from 'vitest';
import { addDays } from '../src/date';
import type { WallCalEvent } from '../src/data/events';
import { upcomingEvents } from '../src/data/upcoming';
import { wallEvent } from './fixtures';

const today = new Date(2026, 9, 13);
const now = new Date(2026, 9, 13, 10, 0);
const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
const at = (day: number, h: number, m = 0) => new Date(2026, 9, 13 + day, h, m);
const titles = (events: WallCalEvent[], count = 3, skip = new Set<string>()) =>
  upcomingEvents(events, days, now, count, skip).map((u) => u.item.event.title);

describe('upcomingEvents', () => {
  it('skips timed events that have ended', () => {
    const events = [wallEvent('early', at(0, 8), at(0, 9)), wallEvent('swim', at(0, 15, 30), at(0, 16, 30))];
    expect(titles(events)).toEqual(['swim']);
  });

  it('keeps an event that is under way', () => {
    expect(titles([wallEvent('meeting', at(0, 9), at(0, 11))])).toEqual(['meeting']);
  });

  it("keeps today's all-day events, sorted first", () => {
    const events = [wallEvent('swim', at(0, 15), at(0, 16)), wallEvent('holiday', today, addDays(today, 1), true)];
    expect(titles(events)).toEqual(['holiday', 'swim']);
  });

  it('crosses into the next days up to count', () => {
    const events = [
      wallEvent('tue-a', at(1, 8), at(1, 9)),
      wallEvent('tue-b', at(1, 12), at(1, 13)),
      wallEvent('tue-c', at(1, 18), at(1, 19)),
      wallEvent('thu-a', at(3, 9), at(3, 10)),
      wallEvent('thu-b', at(3, 11), at(3, 12)),
    ];
    const items = upcomingEvents(events, days, now, 4, new Set());
    expect(items.map((u) => u.item.event.title)).toEqual(['tue-a', 'tue-b', 'tue-c', 'thu-a']);
    expect(items.map((u) => u.day.getDate())).toEqual([14, 14, 14, 16]);
  });

  it('lists an event spanning days once', () => {
    const events = [
      wallEvent('trip', new Date(2026, 9, 12), new Date(2026, 9, 16), true),
      wallEvent('late', at(0, 23), at(1, 1)),
      wallEvent('wed', at(1, 9), at(1, 10)),
    ];
    expect(titles(events)).toEqual(['trip', 'late', 'wed']);
  });

  it('drops calendars in skip', () => {
    const nameDay = { ...wallEvent('Beáta', today, addDays(today, 1), true), entity: 'calendar.namedays' };
    expect(titles([nameDay, wallEvent('swim', at(0, 15), at(0, 16))], 3, new Set(['calendar.namedays']))).toEqual(['swim']);
  });

  it('returns nothing when the week is empty', () => {
    expect(titles([])).toEqual([]);
  });
});
