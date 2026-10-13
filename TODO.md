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
Clock, weather, or other widgets in the `start | center | end` slots.
