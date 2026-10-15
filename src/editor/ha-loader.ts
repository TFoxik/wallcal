const HA_EDITOR_TAGS = ['ha-form', 'hui-card-element-editor', 'hui-card-picker'] as const;
export type HaEditorAvailability = Record<(typeof HA_EDITOR_TAGS)[number], boolean>;

let loading: Promise<HaEditorAvailability> | null = null;

// HA registers these lazily; its stack card editor imports all three, so asking for that editor loads them.
// The card element is created before its class is upgraded, so the class comes from the registry, not stack.constructor.
export function loadHaEditors(timeoutMs = 5000): Promise<HaEditorAvailability> {
  loading ??= load(timeoutMs).then((result) => {
    if (!Object.values(result).every(Boolean)) loading = null;
    return result;
  });
  return loading;
}

export function resetHaEditorsForTest(): void {
  loading = null;
}

async function load(timeoutMs: number): Promise<HaEditorAvailability> {
  if (!HA_EDITOR_TAGS.every((tag) => customElements.get(tag))) {
    try {
      const helpers = await window.loadCardHelpers?.();
      const stack = helpers?.createCardElement({ type: 'vertical-stack', cards: [] });
      if (stack) {
        const stackClass = await Promise.race([
          customElements.whenDefined(stack.localName).then(() => customElements.get(stack.localName)),
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs)),
        ]);
        await (stackClass as { getConfigElement?: () => Promise<unknown> } | undefined)?.getConfigElement?.();
      }
    } catch {
      // Whatever got registered is used; the editor falls back for the rest.
    }
  }
  const entries = await Promise.all(HA_EDITOR_TAGS.map(async (tag) => [tag, await defined(tag, timeoutMs)] as const));
  return Object.fromEntries(entries) as HaEditorAvailability;
}

function defined(tag: string, timeoutMs: number): Promise<boolean> {
  if (customElements.get(tag)) return Promise.resolve(true);
  return Promise.race([
    customElements.whenDefined(tag).then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}
