import { dayKey } from '../date';
import type { HassEntity, HomeAssistant } from '../ha-types';

export type ForecastType = 'daily' | 'twice_daily';

export interface HaForecast {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  is_daytime?: boolean;
}

export interface ForecastEvent {
  type: string;
  forecast: HaForecast[] | null;
}

export interface DayForecast {
  condition: string;
  high: number;
  low: number | null;
}

const FEATURE_DAILY = 1;
const FEATURE_TWICE_DAILY = 4;

export function forecastType(state: HassEntity | undefined): ForecastType | null {
  const features = Number(state?.attributes?.supported_features ?? 0);
  if (features & FEATURE_DAILY) return 'daily';
  if (features & FEATURE_TWICE_DAILY) return 'twice_daily';
  return null;
}

// Keyed by the local calendar date the forecast starts on, the same way HA's own weather card
// reads the datetime. twice_daily gives two entries per date (day and night halves).
export function forecastByDay(entries: HaForecast[]): Map<string, DayForecast> {
  const groups = new Map<string, HaForecast[]>();
  for (const entry of entries) {
    const start = new Date(entry.datetime);
    if (Number.isNaN(start.getTime()) || typeof entry.temperature !== 'number') continue;
    const key = dayKey(start);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  const days = new Map<string, DayForecast>();
  for (const [key, group] of groups) {
    const lowsOf = (e: HaForecast) => (typeof e.templow === 'number' ? [e.templow] : []);
    const temps = group.flatMap((e) => [e.temperature as number, ...lowsOf(e)]);
    const lows = group.length > 1 ? temps : group.flatMap(lowsOf);
    const daytime = group.find((e) => e.is_daytime !== false) ?? group[0];
    days.set(key, {
      condition: daytime.condition ?? '',
      high: Math.max(...temps),
      low: lows.length ? Math.min(...lows) : null,
    });
  }
  return days;
}

export function sameForecast(a: Map<string, DayForecast> | null, b: Map<string, DayForecast>): boolean {
  return a !== null && JSON.stringify([...a]) === JSON.stringify([...b]);
}

const CONDITION_ICONS: Record<string, string> = {
  'clear-night': 'mdi:weather-night',
  cloudy: 'mdi:weather-cloudy',
  exceptional: 'mdi:alert-circle-outline',
  fog: 'mdi:weather-fog',
  hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning',
  'lightning-rainy': 'mdi:weather-lightning-rainy',
  partlycloudy: 'mdi:weather-partly-cloudy',
  pouring: 'mdi:weather-pouring',
  rainy: 'mdi:weather-rainy',
  snowy: 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy',
  sunny: 'mdi:weather-sunny',
  windy: 'mdi:weather-windy',
  'windy-variant': 'mdi:weather-windy-variant',
};

export function conditionIcon(condition: string): string {
  return CONDITION_ICONS[condition] ?? 'mdi:thermometer';
}

export function subscribeForecast(
  hass: HomeAssistant,
  entity: string,
  type: ForecastType,
  onForecast: (days: Map<string, DayForecast>) => void,
): Promise<() => Promise<void>> {
  return hass.connection.subscribeMessage<ForecastEvent>(
    (message) => onForecast(forecastByDay(message.forecast ?? [])),
    { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: entity },
  );
}
