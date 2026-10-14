# Roadmap

## Now

Nothing in progress.

## Next

### Learned cycle prediction
Store period history in a dedicated HA Local Calendar (`calendar.cycle`, one "Period" event per
period). Log it from the HA phone app, an automation, or a "Period started" button on the card
(`calendar.create_event`).

- Cycle length = median of the last 6 cycles.
- Period length from event durations.
- Uncertainty band on predicted days, sized by cycle variability.
- Moves period data out of Lovelace config (privacy).
- `cycle/predict.ts` already takes `{ starts[], cycleLength, periodLength }`, so only the input
  source changes.

### Visual config editor
GUI editor (`getConfigElement`) for everything currently YAML-only.

## Later

### Top bar slots
Clock or other widgets in the `start | center | end` slots.

### Overlay auto-hide
Hide overlays automatically after idle. Today an overlay is hidden only with its header toggle.

### Overlay top positions
Overlays sit only at `bottom-left | bottom-center | bottom-right`. Add positions at the top of the
grid; free x/y placement was left out with them.
