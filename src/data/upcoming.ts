import { eventsForDay, isEnded, type DayEvent, type WallCalEvent } from './events';

export interface UpcomingItem {
  item: DayEvent;
  day: Date;
}

// An event that spans days is listed on the first day it is still upcoming, and counts once.
export function upcomingEvents(
  events: WallCalEvent[],
  days: Date[],
  now: Date,
  count: number,
  skip: ReadonlySet<string>,
): UpcomingItem[] {
  const shown = events.filter((e) => !skip.has(e.entity));
  const taken = new Set<WallCalEvent>();
  const items: UpcomingItem[] = [];
  for (const day of days) {
    for (const item of eventsForDay(shown, day)) {
      if (items.length >= count) return items;
      if (taken.has(item.event) || isEnded(item, now)) continue;
      taken.add(item.event);
      items.push({ item, day });
    }
  }
  return items;
}
