export interface HassEntity {
  entity_id: string;
  state: string;
  last_changed: string;
  last_updated: string;
  attributes: Record<string, unknown>;
}

export interface HassLocale {
  language: string;
  time_format: 'language' | 'system' | '12' | '24';
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  locale: HassLocale;
  callApi<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T>;
}
