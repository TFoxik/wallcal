// @vitest-environment happy-dom
import { render } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { OverlayCards, renderOverlay, renderPill, type HassCard } from '../src/components/overlay-host';
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
    document.body.append(el);
    const b = hassA();
    cards.hass = b;
    expect(el.hass).toBe(b);
  });

  it('skips hass updates for a card that is not on the page and catches up when it is shown again', async () => {
    const cards = new OverlayCards();
    const a = hassA();
    cards.hass = a;
    const el = (await cards.card('k', todo)) as HassCard;
    const b = hassA();
    cards.hass = b;
    expect(el.hass).toBe(a);
    await cards.card('k', todo);
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

  it('recreates a card that asks to be rebuilt, e.g. a custom card that loaded late', async () => {
    const onRebuild = vi.fn();
    const cards = new OverlayCards(onRebuild);
    const first = (await cards.card('k', todo)) as HassCard;
    first.dispatchEvent(new Event('ll-rebuild'));
    expect(onRebuild).toHaveBeenCalledTimes(1);
    const second = await cards.card('k', todo);
    expect(second).not.toBe(first);
    expect(createCardElement).toHaveBeenCalledTimes(2);
    const a = hassA();
    cards.hass = a;
    expect(first.hass).toBeUndefined();
  });

  it('ignores a rebuild request from a card that is no longer configured', async () => {
    const onRebuild = vi.fn();
    const cards = new OverlayCards(onRebuild);
    const old = await cards.card('k', todo);
    cards.retain(new Set());
    await Promise.resolve();
    const current = await cards.card('k', todo);
    old.dispatchEvent(new Event('ll-rebuild'));
    expect(onRebuild).not.toHaveBeenCalled();
    expect(await cards.card('k', todo)).toBe(current);
  });

  it('keeps a failure while it is shown and retries the next time the overlay is shown', async () => {
    const helpers = window.loadCardHelpers;
    delete window.loadCardHelpers;
    const cards = new OverlayCards();
    const failed = cards.card('k', todo);
    const message = await failed;
    expect(message.classList.contains('overlay__message')).toBe(true);

    document.body.append(message);
    expect(cards.card('k', todo)).toBe(failed);

    message.remove();
    window.loadCardHelpers = helpers;
    const retried = await cards.card('k', todo);
    expect(retried.classList.contains('hosted')).toBe(true);
    expect(createCardElement).toHaveBeenCalledTimes(1);
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

describe('overlay pill and handle', () => {
  const overlay = normalizeConfig({
    entities: ['calendar.family'],
    overlays: [{ position: 'bottom-right', toggle: 'pill', icon: 'mdi:cart', card: todo }],
  }).overlays[0];
  let host: HTMLElement;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
  });

  it('shows icon, name and count, and expands when tapped', () => {
    const onExpand = vi.fn();
    render(renderPill(overlay, { label: 'Shopping', count: '4', onExpand }), host);
    const pill = host.querySelector<HTMLButtonElement>('button.pill.pill--bottom-right');
    expect(pill?.getAttribute('aria-label')).toBe('Show Shopping');
    expect(pill?.querySelector('ha-icon')?.getAttribute('icon')).toBe('mdi:cart');
    expect(pill?.querySelector('.pill__label')?.textContent).toBe('Shopping');
    expect(pill?.querySelector('.pill__count')?.textContent).toBe('4');
    pill?.click();
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('shows only the icon and count when compact, keeping the name for the label and tooltip', () => {
    const compact = { ...overlay, pill: 'compact' as const };
    render(renderPill(compact, { label: 'Shopping', count: '4', onExpand: vi.fn() }), host);
    const pill = host.querySelector<HTMLButtonElement>('button.pill.pill--compact');
    expect(pill?.querySelector('.pill__label')).toBeNull();
    expect(pill?.querySelector('.pill__count')?.textContent).toBe('4');
    expect(pill?.querySelector('ha-icon')).not.toBeNull();
    expect(pill?.getAttribute('aria-label')).toBe('Show Shopping');
    expect(pill?.getAttribute('title')).toBe('Shopping');
  });

  it('leaves the count out when there is none', () => {
    render(renderPill(overlay, { label: 'Home', count: null, onExpand: vi.fn() }), host);
    expect(host.querySelector('.pill__count')).toBeNull();
  });

  it('adds a handle that minimizes the panel only when asked to', () => {
    const onMinimize = vi.fn();
    const card = new OverlayCards().card('k', todo);
    render(renderOverlay(overlay, card, { label: 'Shopping', onMinimize }), host);
    const handle = host.querySelector<HTMLButtonElement>('.overlay > button.overlay__handle');
    expect(handle?.getAttribute('aria-label')).toBe('Minimize Shopping');
    handle?.click();
    expect(onMinimize).toHaveBeenCalledTimes(1);
    render(renderOverlay(overlay, card), document.createElement('div'));
  });

  it('has no handle without a minimize action', () => {
    render(renderOverlay(overlay, new OverlayCards().card('k', todo)), host);
    expect(host.querySelector('.overlay__handle')).toBeNull();
  });
});
