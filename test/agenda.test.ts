import { describe, expect, it } from 'vitest';
import { stripDots } from '../src/components/agenda';
import { eventsForDay, type WallCalEvent } from '../src/data/events';
import { wallEvent } from './fixtures';

const day = new Date(2026, 9, 13);
const at = (h: number) => new Date(2026, 9, 13, h);
const colored = (event: WallCalEvent, color: string, entity = event.entity): WallCalEvent => ({ ...event, color, entity });

describe('stripDots', () => {
  it('caps at 3 dots, in day order', () => {
    const events = [9, 11, 13, 15].map((h, i) => colored(wallEvent(`e${h}`, at(h), at(h + 1)), `#00000${i}`));
    expect(stripDots(eventsForDay(events, day), [])).toEqual(['#000000', '#000001', '#000002']);
  });

  it('skips label calendars', () => {
    const nameDay = colored(wallEvent('Beáta', day, new Date(2026, 9, 14), true), '#aaaaaa', 'calendar.namedays');
    const swim = colored(wallEvent('Swim', at(15), at(16)), '#bbbbbb');
    expect(stripDots(eventsForDay([nameDay, swim], day), ['calendar.namedays'])).toEqual(['#bbbbbb']);
  });

  it('counts all-day chips such as a holiday', () => {
    const holiday = colored(wallEvent('Holiday', day, new Date(2026, 9, 14), true), '#cccccc', 'calendar.holidays');
    expect(stripDots(eventsForDay([holiday], day), [])).toEqual(['#cccccc']);
  });
});
