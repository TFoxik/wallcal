# TODO — later iterations

## Learned cycle prediction
Store period history in a dedicated HA Local Calendar (`calendar.cycle`, one "Period" event per
period). Log it from the HA phone app, an automation, or a "Period started" button on the card
(`calendar.create_event`).

- Cycle length = median of the last 6 cycles.
- Period length from event durations.
- Uncertainty band on predicted days, sized by cycle variability.
- Moves period data out of Lovelace config (privacy).
- `cycle/predict.ts` already takes `{ starts[], cycleLength, periodLength }`, so only the input
  source changes.

## Visual config editor
GUI editor (`getConfigElement`) for everything currently YAML-only.

## Top bar slots
Clock or other widgets in the `start | center | end` slots.

## Release workflow
GitHub Action that builds `dist/wallcal-card.js` and attaches it to a GitHub release, so HACS
installs a built file instead of requiring `dist/` in git.

## Overlay space in covered columns
Events under a shown overlay are hidden until it is toggled off. Pad the covered day lists by the
overlay's measured height (ResizeObserver) so the last events can be scrolled clear of it.
