export interface HassEntity {
  last_changed: string;
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
