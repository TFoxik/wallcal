import { describe, expect, it } from 'vitest';
import { conditionIcon, forecastByDay, forecastType } from '../src/data/weather';

describe('forecastType', () => {
  const state = (supported_features: number) => ({ last_changed: '', attributes: { supported_features } });

  it('prefers daily, falls back to twice_daily, and rejects hourly-only entities', () => {
    expect(forecastType(state(1 | 2 | 4))).toBe('daily');
    expect(forecastType(state(2 | 4))).toBe('twice_daily');
    expect(forecastType(state(2))).toBeNull();
    expect(forecastType(undefined)).toBeNull();
  });
});

describe('forecastByDay', () => {
  it('keys daily entries by their local date', () => {
    const days = forecastByDay([
      { datetime: '2026-10-13T22:00:00Z', condition: 'sunny', temperature: 18, templow: 9 },
      { datetime: '2026-10-14T22:00:00Z', condition: 'rainy', temperature: 14 },
    ]);
    expect(days.get('2026-10-14')).toEqual({ condition: 'sunny', high: 18, low: 9 });
    expect(days.get('2026-10-15')).toEqual({ condition: 'rainy', high: 14, low: null });
  });

  it('merges twice_daily halves, taking the condition from the daytime half', () => {
    const days = forecastByDay([
      { datetime: '2026-10-14T06:00:00+02:00', condition: 'partlycloudy', temperature: 16, is_daytime: true },
      { datetime: '2026-10-14T18:00:00+02:00', condition: 'clear-night', temperature: 7, is_daytime: false },
    ]);
    expect(days.get('2026-10-14')).toEqual({ condition: 'partlycloudy', high: 16, low: 7 });
  });

  it('skips entries without a temperature or a valid date', () => {
    const days = forecastByDay([
      { datetime: 'nope', temperature: 10 },
      { datetime: '2026-10-14T10:00:00Z', condition: 'sunny' },
    ]);
    expect(days.size).toBe(0);
  });
});

describe('conditionIcon', () => {
  it('maps HA conditions to mdi icons with a fallback', () => {
    expect(conditionIcon('partlycloudy')).toBe('mdi:weather-partly-cloudy');
    expect(conditionIcon('something-new')).toBe('mdi:thermometer');
  });
});
