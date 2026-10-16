# Events

![Two day columns: all-day events at the top, timed events below with a coloured stripe for their calendar](/img/events-dark.webp){.dark-only}
![The same events in the Paper theme](/img/events-light.webp){.light-only}

## Calendars and colours

Each calendar gets a colour from a built-in palette, or you choose one. Every event shows a stripe in its calendar's colour.

**In the visual editor:** Calendars → Calendar, Colour (Use default colour gives back the palette colour)

![The Calendars panel in the visual editor](/img/editor-calendars-dark.webp){.editor-shot .dark-only}
![The Calendars panel in the visual editor](/img/editor-calendars-light.webp){.editor-shot .light-only}

**In YAML:** `entities`, with `color` on a calendar. Add these lines to your card:

```yaml
entities:
  - entity: calendar.family
    color: "#7F77DD"
  - calendar.school          # shorthand: default colour
```

## All-day events

All-day events sit at the top of each day. An event that started on an earlier day shows **continues** instead of a start
time. There is nothing to set.

## Times

**In the visual editor:** Week → Time format, Show end times

![The Week panel in the visual editor](/img/editor-week-dark.webp){.editor-shot .dark-only}
![The Week panel in the visual editor](/img/editor-week-light.webp){.editor-shot .light-only}

**In YAML:** `time_format`, `show_end_time`. Add these lines to your card:

```yaml
time_format: 24        # 12 | 24 | auto (from your HA profile)
show_end_time: true    # 8:30 – 9:15
```

## Earlier days and finished events

Days before today can be dimmed or greyed, and today's finished events dimmed or hidden.

**In the visual editor:** Week → Earlier days, Today's finished events

**In YAML:** `past_days`, `past_events`. Add these lines to your card:

```yaml
past_days: dim         # normal | dim | grey
past_events: hide      # show | dim | hide
```

## More events than fit

When a day has more events than fit, **+N more** appears under it. Tap it to scroll to them. Today's list also scrolls to
the next upcoming event on its own.

**In the visual editor:** Week → Scroll today to the next event

**In YAML:** `auto_scroll`. Add these lines to your card:

```yaml
auto_scroll: false
```

## Refresh

Events refresh every 5 minutes.

**In the visual editor:** Week → Refresh every

**In YAML:** `refresh_interval`, in seconds, 60 or more. Add these lines to your card:

```yaml
refresh_interval: 120
```
