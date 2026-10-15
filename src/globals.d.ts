declare const __WALLCAL_VERSION__: string;

interface Window {
  customCards?: Array<{
    type: string;
    name: string;
    description: string;
    preview?: boolean;
    documentationURL?: string;
    getEntitySuggestion?: (hass: unknown, entityId: string) => { config: Record<string, unknown> } | null;
  }>;
  loadCardHelpers?: () => Promise<{
    createCardElement(config: Record<string, unknown>): HTMLElement & { hass?: unknown };
  }>;
}
