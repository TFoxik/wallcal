# WallCal — floating overlays design spec

Date: 2026-10-14
Status: draft, awaiting review

## 1. Purpose

Show small Home Assistant cards (a todo list, an entity, a few buttons) floating over the bottom of
the week grid, each shown or hidden with its own button in the top bar.

The driving case: on the wall tablet, a todo list floats over the weekend columns; one tap in the
header shows or hides it, and items can be checked off and added right there. The bottom middle of
the screen stays free for navbar-card.

Success: the todo overlay sits centered over the boundary between the two weekend days, matches the
active WallCal theme, survives reloads with its shown/hidden state, and costs nothing while hidden.

## 2. Scope

### In
- `overlays:` list, at most one overlay per position: `bottom-left | bottom-center | bottom-right`.
- Any Lovelace card config as overlay content, created with HA's card factory.
- Per-overlay header toggle button, or always-on (`toggle: false`).
- Shown/hidden state remembered per device.
- Sizing aligned to the day columns (`span`, `width`), height capped (`max_height`), lifted by
  `offset` to clear a bottom navigation bar.
- WallCal theme tokens mapped onto HA card variables inside the overlay.

### Not in scope
- Top positions and free x/y placement.
- Built-in navigation. Navigation stays in navbar-card, or can be an overlay hosting a
  `horizontal-stack` of `button` cards with `tap_action: navigate` (no extra code).
- Reserving space in the covered day columns. Events under an overlay stay hidden until it is
  toggled off. Padding the covered lists by the overlay's measured height (ResizeObserver) is the
  follow-up if this bothers in practice.
- Auto-hide after idle.
- Visual editor support.

## 3. Configuration

```yaml
overlays:
  - position: bottom-right            # required; bottom-left | bottom-center | bottom-right
    span: 2                           # day columns the overlay is centered over; 1..days, default 2
    width: 90%                        # share of those columns, centered; 10%..100%, default 90%
    max_height: 40%                   # % of the grid height or px (e.g. 320); default 40%
    offset: 8                         # px between the grid bottom and the overlay; 0..400, default 8
    toggle: header                    # header | pill | none (true/false = header/none); default header
    visible: false                    # state on a device that never toggled it; default false
    icon: mdi:format-list-checks      # header button icon; default mdi:card-outline
    name: Shopping                    # button tooltip / aria label; default derived (see 4.2)
    card:                             # required; any Lovelace card config
      type: todo-list
      entity: todo.shopping
```

Validation (`config.ts`, throws like the rest of `normalizeConfig`):
- `overlays` must be a list; each item a mapping with a `card` mapping that has a string `type`.
- `position` must be one of the three values and must not repeat.
- `span` integer in `1..days`; `width` a percentage `10%..100%`; `max_height` a percentage
  `10%..100%` or a positive integer number of px; `offset` integer `0..400`.
- `icon` must match the existing `ICON` pattern.
- The contents of `card` are not validated; that is the card factory's job (4.4).

## 4. Behaviour

### 4.1 Geometry
- The overlay is absolutely positioned inside `.grid`, which becomes its containing block
  (`position: relative`).
- Its horizontal band is `span` day columns including the gaps between them:
  - `bottom-left`: columns `1 .. span`.
  - `bottom-right`: the last `span` columns.
  - `bottom-center`: the band centered on the grid.
- Within that band the overlay is `width` wide and centered. With `span: 2` it is centered on the
  boundary between the two days. For `bottom-center` with odd `days` and even `span` (or the
  reverse) the center falls mid-column; that is expected geometry, not a bug.
- `bottom: offset px` (default 8 px, so the panel visibly floats); height grows with content up to `max_height` (percent of the grid height),
  then the overlay scrolls internally.
- The column band width is computed with `calc()` from `--wallcal-days`, `--wallcal-gap` and
  `span`, so it follows the grid at any card width without JS measurement.

### 4.2 Toggle buttons
- Overlays with `toggle: true` get a round button in the top bar `end` slot, after the calendar
  chips, styled like them, in config order.
- `aria-pressed` reflects visibility; label is `Show <name>` / `Hide <name>`.
- Default `name`: the card's `title`, else the friendly name of the card's `entity`, else its
  `type`.
- With `header.show: false` there are no buttons; overlays use their stored or initial state.

### 4.2a Pill mode (`toggle: pill`)
- Minimized, the overlay is a pill at its own position (same `offset`), centred on its band so it
  expands in place: icon, name (4.2 rules) and, when the card's `entity` state is numeric, a count
  badge with the unit if any. A todo entity's state is its open-item count.
- `pill: compact` leaves the name out (icon and count; a round icon button without a count); the
  name stays as the pill's aria-label and tooltip.
- Tapping the pill expands it; the expanded panel has a 22 px handle strip on top that minimizes it.
  No header button. Expanded/minimized uses the same per-device state as 4.3 (`visible` = expanded).
- WallCal re-renders on a hass update only when a pill's count changed (besides calendar changes).

### 4.3 Visibility state
- `src/data/overlays.ts`, same shape as `hidden.ts`: one localStorage map under `wallcal:overlays`,
  `{ [key]: boolean }`, re-read before every write so other cards on the page are not clobbered.
- `key = position + ':' + short hash of JSON(card)`. Keying by position alone would make toggling
  on one dashboard flip an unrelated overlay on another. Changing an overlay's `card` config resets
  its state to `visible`.
- A key with no stored value uses `visible`. Storage blocked: state lasts until reload.
- `toggle: false` overlays are always shown and never read or write storage.

### 4.4 Hosting the card
- `src/components/overlay-host.ts` owns card creation and caching:
  - `cardFor(card)` awaits `window.loadCardHelpers()` and calls `createCardElement(card)`. Invalid
    card config yields HA's own error card inside the overlay.
  - Created elements are cached in a `Map<key, Promise<HTMLElement>>` on the WallCalCard instance
    (key from 4.3), so hiding and re-showing reuses the element. `setConfig` drops entries whose
    key is no longer configured; a changed `card` config has a new key and gets a new element.
- The overlay template renders a container `div.overlay` and inserts the resolved element into it
  (Lit renders an `HTMLElement` value as a node).
- **hass flow:** `WallCalCard.set hass` deliberately does not re-render on every update. It assigns
  `hass` to every cached card element directly; a newly created element gets the current `hass`
  before it is inserted.
- **Hidden = removed.** A hidden overlay's container is not rendered, so the hosted card
  disconnects and drops its subscriptions (the todo card's live item subscription). Detached cards
  get no `hass` updates (a Lit card would still re-render for each); they catch up when shown again.
- `loadCardHelpers` missing (dev harness) or rejecting: the overlay shows a one-line message
  instead of a card; the calendar keeps working. The failure is kept while the message is shown;
  hiding or minimizing the overlay and showing it again retries.

### 4.5 Interaction
- The overlay lives inside `.grid`, whose pointer / wheel handler marks the day lists as touched
  (`_touchList`, which pauses auto-scroll). That handler ignores events whose `composedPath()`
  includes an `.overlay`, so scrolling the todo list does not pause auto-scroll of today's column.
- Events are not stopped: the card-level `_touch()` still sees them, so using an overlay counts as
  interaction for idle-return.

### 4.6 Theming
Overlay container (it carries the look; the hosted card is made transparent):

| Property | Value |
|----------|-------|
| background | `--wallcal-overlay-background` (style token `overlay_background`, see below) |
| border-radius | `--wallcal-day-radius` |
| box-shadow | `0 4px 16px rgba(0, 0, 0, 0.18)` |
| overflow | `auto` |

Variables set on the container for the hosted card:

| HA variable | WallCal token |
|-------------|---------------|
| `--ha-card-background`, `--card-background-color` | `transparent` |
| `--ha-card-box-shadow` | `none` |
| `--ha-card-border-width` | `0` |
| `--primary-text-color` | `--wallcal-text` |
| `--secondary-text-color` | `--wallcal-muted` |
| `--primary-color` | `--wallcal-accent` |
| `--divider-color` | `--wallcal-divider` |

New style token `overlay_background` (CSS `background` value). Default:
`linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08)), linear-gradient(var(--wallcal-surface), var(--wallcal-surface)), var(--wallcal-background)`,
i.e. the day-column colour with a light wash, so the panel is slightly lighter than the columns it
covers in light and dark themes. It is opaque so events underneath never show through. Override it
per card with `style: overlay_background: "#2A2A30"`.

HA also resolves derived variables (`--mdc-theme-text-*`, `--ha-color-text-*`, `--wa-color-text-*`,
form backgrounds, `--mdc-theme-primary`, the checkbox fill `--ha-color-fill-primary-loud-*`) once on the page, so the overlay remaps those too
(`src/theme/styles.ts`); without them the paper preset on a dark HA theme leaves the todo card's
text light on light.

Third-party cards that hard-code colours may not follow; out of scope.

## 5. Units touched

| Unit | Change |
|------|--------|
| `config.ts` | `OverlayConfig`, `overlays: OverlayConfig[]`, validation (3) |
| `data/overlays.ts` | new: load / toggle visibility, key derivation (4.3) |
| `components/overlay-host.ts` | new: card creation, element cache, overlay template (4.4) |
| `components/calendar-toggles.ts` | renders overlay buttons after calendar chips (4.2) |
| `components/top-bar.ts` | passes overlay toggles through |
| `wallcal-card.ts` | renders visible overlays in `.grid`, forwards `hass`, owns the cache, ignores overlay events in `_touchList` (4.5) |
| `theme/styles.ts` | overlay geometry and theming (4.1, 4.6) |
| `theme/presets.ts` | `overlay_background` token (4.6) |
| `globals.d.ts` | `window.loadCardHelpers` / `createCardElement` typings |

## 6. Testing

Unit (vitest, existing setup):
- Config: defaults; each validation error; duplicate position; `span > days`.
- `overlays.ts`: default from `visible`; toggle round-trip; another key survives a write; blocked
  storage does not throw; key changes when `card` changes.
- Toggles: overlay buttons render after calendar chips with correct `aria-pressed`; none for
  `toggle: false`; none when `header.show: false`.
- Host: with a stubbed `window.loadCardHelpers` recording configs, the card is created once with
  the given config, receives `hass` on creation and on later `hass` sets, is reused across
  hide / show, is recreated when `card` changes, and a hidden overlay is not in the DOM. Missing
  `loadCardHelpers` shows the message.
- Touch: a pointerdown inside an overlay does not mark the lists as touched but does reset idle.

Live (dev HA, `dev/ha`):
- Add a `todo` platform to `wallcal_fixture` (a small in-memory `TodoListEntity` supporting
  create / update / delete) so `todo-list` is exercised without a config flow.
- Add a `bottom-right` todo overlay (`span: 2`) and a `bottom-left` `tile` overlay (`span: 1`),
  each with its own header toggle, to the Wall view; check geometry on 7 and 5 days, all three themes, and
  that hiding stops the todo websocket subscription.

## 7. Docs
- README: an `overlays:` example and a note on navbar-card + `offset`.
- Main spec section 6 (configuration reference): the overlay options.
- `TODO.md`: the column-padding follow-up from section 2.

## 8. Device support
- Grid-positioned absolute children, `calc()` and custom properties work on the existing floor
  (Chrome / WebView 87+, Safari 14.5+). No ResizeObserver, no animation.
- `loadCardHelpers` is a public but unversioned HA frontend API; if it breaks, overlays degrade to
  the message in 4.4 and the calendar is untouched.
