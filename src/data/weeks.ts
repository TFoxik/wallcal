import type { EntityConfig } from '../config';
import { addDays } from '../date';
import type { HomeAssistant } from '../ha-types';
import { fetchEvents, mergeResults, type EventCache } from './events';

// The shown week plus its prefetched neighbours fill three; six keep this week through about three
// weeks of browsing ahead, so the idle return to it stays instant.
const WEEKS_KEPT = 6;

export function rangeKeyOf(start: Date, days: number): string {
  return `${start.getTime()}-${addDays(start, days).getTime()}`;
}

// Recently shown weeks, oldest first: going back to one shows it at once while it refetches.
export class WeekCache {
  private _weeks = new Map<string, EventCache>();
  // Prefetches still loading or failed. Neither is asked for again, so a calendar that keeps failing
  // does not cost two extra requests on every refresh.
  private _pending = new Set<string>();

  get(rangeKey: string): EventCache | null {
    return this._weeks.get(rangeKey) ?? null;
  }

  put(rangeKey: string, cache: EventCache): void {
    const weeks = this._weeks;
    weeks.delete(rangeKey);
    weeks.set(rangeKey, cache);
    if (weeks.size > WEEKS_KEPT) weeks.delete(weeks.keys().next().value!);
  }

  // Fresh collections rather than emptied ones: a prefetch for the old calendars sees its map is gone.
  clear(): void {
    this._weeks = new Map();
    this._pending = new Set();
  }

  // Loads the weeks either side of start once. They are not polled: showing one refetches it like any
  // other week change.
  prefetchAround(hass: HomeAssistant, entities: EntityConfig[], start: Date, days: number): void {
    const weeks = this._weeks;
    for (const from of [addDays(start, -7), addDays(start, 7)]) {
      const rangeKey = rangeKeyOf(from, days);
      if (weeks.has(rangeKey) || this._pending.has(rangeKey)) continue;
      this._pending.add(rangeKey);
      void fetchEvents(hass, entities, from, addDays(from, days)).then((results) => {
        // A week with a failed calendar is left out: it would show as if that calendar had no events.
        if (weeks !== this._weeks || results.some((r) => r.error)) return;
        this._pending.delete(rangeKey);
        // A visit that landed first fetched later, so its copy wins.
        if (!weeks.has(rangeKey)) this.put(rangeKey, mergeResults(null, rangeKey, results));
      });
    }
  }
}
