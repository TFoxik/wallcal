# Your first card

![WallCal showing a week with colour-coded events, weather and name days](/img/card-map-dark.webp){.dark-only}
![The same week in the Paper theme](/img/card-map-light.webp){.light-only}

## Copy a first card

Edit a dashboard → **Add card** → search for **WallCal**, switch the card editor to **Show code editor** and paste:

```yaml
type: custom:wallcal-card
entities:
  - calendar.family
  - entity: calendar.work
    color: "#7F77DD"
```

Any Home Assistant calendar works: Google, CalDAV, Local Calendar, holiday calendars and so on. If something in the config is
wrong, the card shows an error naming the option, for example `days must be 5 or 7`.

## Or use the visual editor

1. Edit a dashboard → **Add card** → search for **WallCal**.
2. In **Calendars**, pick your calendars. Each gets a colour you can change.
3. Open the other panels (Week, Top bar, Weather, Moon, Cycle, Floating cards, Theme & style) to change the rest.
   The editor only writes what you change, so YAML you wrote by hand stays as it is.

The visual editor needs Home Assistant 2026.10 or newer.

## Where to put it

| Dashboard view | What happens |
|---|---|
| **Panel** (recommended for a wall) | Fills the screen below the HA header. Busy days scroll inside their column. |
| **Sections** | Uses the section's height. Give the section a wide column span: seven days need about 900 px. |
| **Masonry** | Grows to fit every event, so the card can get very tall. |

Next: find what to change on the [card map](../card-map), or copy a [recipe](../recipes/kitchen-tablet).
