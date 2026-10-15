// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadHaEditors, resetHaEditorsForTest } from '../src/editor/ha-loader';

afterEach(() => {
  resetHaEditorsForTest();
  delete window.loadCardHelpers;
  vi.useRealTimers();
});

describe('loadHaEditors', () => {
  it('reports missing elements after the timeout', async () => {
    vi.useFakeTimers();
    const result = loadHaEditors(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toEqual({ 'ha-form': false, 'hui-card-element-editor': false, 'hui-card-picker': false });
  });

  it('loads them through the stack card editor once its lazily defined class arrives', async () => {
    class Stack extends HTMLElement {
      static async getConfigElement() {
        for (const tag of ['ha-form', 'hui-card-element-editor', 'hui-card-picker']) {
          if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
        }
        return document.createElement('div');
      }
    }
    const createCardElement = vi.fn((_config: Record<string, unknown>) => {
      const element = document.createElement('test-stack');
      setTimeout(() => customElements.define('test-stack', Stack), 0);
      return element;
    });
    window.loadCardHelpers = async () => ({ createCardElement });
    expect(await loadHaEditors()).toEqual({ 'ha-form': true, 'hui-card-element-editor': true, 'hui-card-picker': true });
    expect(createCardElement).toHaveBeenCalledWith({ type: 'vertical-stack', cards: [] });
  });

  it('skips the helpers when everything is already defined and caches the result', async () => {
    const createCardElement = vi.fn((_config: Record<string, unknown>) => document.createElement('div'));
    window.loadCardHelpers = async () => ({ createCardElement });
    const first = await loadHaEditors();
    expect(await loadHaEditors()).toBe(first);
    expect(createCardElement).not.toHaveBeenCalled();
  });
});
