// @vitest-environment happy-dom
import { render } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { OverlayCards, renderOverlay, type HassCard } from '../src/components/overlay-host';
import { normalizeConfig } from '../src/config';
import type { HomeAssistant } from '../src/ha-types';
import { makeHass } from './fixtures';

const todo = { type: 'todo-list', entity: 'todo.shopping' };
let created: HassCard[];
let createCardElement: Mock<(config: Record<string, unknown>) => HassCard>;

beforeEach(() => {
  created = [];
  createCardElement = vi.fn((config: Record<string, unknown>) => {
    const el = document.createElement('div') as HassCard;
    el.className = 'hosted';
    el.dataset.type = String(config.type);
    created.push(el);
    return el;
  });
  window.loadCardHelpers = async () => ({ createCardElement });
});

afterEach(() => {
  delete window.loadCardHelpers;
  document.body.replaceChildren();
});

const hassA = (): HomeAssistant => makeHass(async () => []).hass;

describe('OverlayCards', () => {
  it('creates a card once per key with the given config', async () => {
    const cards = new OverlayCards();
    const first = cards.card('k', todo);
    expect(cards.card('k', todo)).toBe(first);
    await first;
    expect(createCardElement).toHaveBeenCalledTimes(1);
    expect(createCardElement).toHaveBeenCalledWith(todo);
  });

  it('gives a new card the current hass and pushes later updates', async () => {
    const cards = new OverlayCards();
    const a = hassA();
    cards.hass = a;
    const el = (await cards.card('k', todo)) as HassCard;
    expect(el.hass).toBe(a);
    const b = hassA();
    cards.hass = b;
    expect(el.hass).toBe(b);
  });

  it('does not assign hass before there is one', async () => {
    const el = await new OverlayCards().card('k', todo);
    expect('hass' in el).toBe(false);
  });

  it('drops cards that are no longer configured', async () => {
    const cards = new OverlayCards();
    const old = (await cards.card('old', todo)) as HassCard;
    cards.retain(new Set(['new']));
    await Promise.resolve();
    const a = hassA();
    cards.hass = a;
    expect(old.hass).toBeUndefined();
    await cards.card('old', todo);
    expect(createCardElement).toHaveBeenCalledTimes(2);
  });

  it('shows a message when the card factory is missing', async () => {
    delete window.loadCardHelpers;
    const el = await new OverlayCards().card('k', todo);
    expect(el.classList.contains('overlay__message')).toBe(true);
    expect(el.textContent).toMatch(/unavailable/);
  });
});

describe('renderOverlay', () => {
  it('places the hosted card in a positioned, sized container', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const overlay = normalizeConfig({
      entities: ['calendar.family'],
      overlays: [{ position: 'bottom-left', span: 1, width: '90%', max_height: 300, offset: 72, card: todo }],
    }).overlays[0];
    const card = new OverlayCards().card('k', todo);
    render(renderOverlay(overlay, card), host);
    await card;
    await Promise.resolve();
    const box = host.querySelector<HTMLElement>('.overlay.overlay--bottom-left');
    expect(box?.querySelector('.hosted')).not.toBeNull();
    expect(box?.style.getPropertyValue('--overlay-span')).toBe('1');
    expect(box?.style.getPropertyValue('--overlay-width')).toBe('0.9');
    expect(box?.style.getPropertyValue('--overlay-max-height')).toBe('300px');
    expect(box?.style.getPropertyValue('--overlay-offset')).toBe('72px');
  });
});
