export interface HassEntity {
  state?: string;
  last_changed: string;
  attributes?: Record<string, unknown>;
}

export interface HassLocale {
  language: string;
  time_format: 'language' | 'system' | '12' | '24';
}

export interface HassConnection {
  subscribeMessage<T>(callback: (message: T) => void, message: Record<string, unknown>): Promise<() => Promise<void>>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  locale: HassLocale;
  connection: HassConnection;
  callApi<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T>;
}
