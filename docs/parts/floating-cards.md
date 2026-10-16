# Floating cards

![A shopping list floating over the bottom of the last day columns](/img/overlay-dark.webp){.dark-only}
![The floating shopping list in the Paper theme](/img/overlay-light.webp){.light-only}

A floating card puts any Lovelace card over the bottom of the week: a shopping list, a thermostat, a media player. There can
be one at each of bottom-left, bottom-center and bottom-right.

## Adding a floating card

**In the visual editor:** Floating cards → add one, pick its Position, then set up its card with that card's own editor

![The Floating cards panel in the visual editor](/img/editor-floating-cards-dark.webp){.editor-shot .dark-only}
![The Floating cards panel in the visual editor](/img/editor-floating-cards-light.webp){.editor-shot .light-only}

**In YAML:** `overlays`. Add these lines to your card:

```yaml
overlays:
  - position: bottom-right
    icon: mdi:format-list-checks
    toggle: pill
    card:
      type: todo-list
      entity: todo.shopping
      hide_completed: true
```

## Showing and hiding

| How | Behaviour |
|---|---|
| `header` (default) | A button in the top bar shows and hides it. |
| `pill` | It shrinks to a small pill in place. `pill: compact` shows only the icon and count. |
| `none` | Always shown. |

**In the visual editor:** Floating cards → Show and hide with, Pill style, Shown on a new device, Icon, Name

**In YAML:** `toggle`, `pill`, `visible`, `icon`, `name`. Add these lines to your card:

```yaml
overlays:
  - position: bottom-right
    toggle: pill
    pill: compact
    visible: true      # open on a device that has never toggled it
    card:
      type: todo-list
      entity: todo.shopping
```

Each device remembers whether it's open.

## Size and placement

**In the visual editor:** Floating cards → Day columns, Width, Max height (% or px), Distance from the bottom

**In YAML:** `span`, `width`, `max_height`, `offset`. Add these lines to your card:

```yaml
overlays:
  - position: bottom-center
    span: 2            # day columns it sits over
    width: 90%         # share of those columns
    max_height: 40%    # of the grid height, or px; scrolls beyond that
    offset: 72         # px from the bottom, e.g. to clear navbar-card
    card:
      type: todo-list
      entity: todo.shopping
```

::: tip Good to know
Home Assistant's own cards pick up WallCal's colours. Cards that hard-code their colours may not. The panel background is
the `overlay_background` style token.
:::
