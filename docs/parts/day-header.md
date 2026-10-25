# Day header

The top of each day column. Click a number to jump to that piece.

<PartMap map="day-header" />

## Date and weekday

The day's number and name. Today is highlighted.

**In the visual editor:** Week → Weekday names, Week starts on, Days shown

![The Week panel in the visual editor](/img/editor-week-dark.webp){.editor-shot .dark-only}
![The Week panel in the visual editor](/img/editor-week-light.webp){.editor-shot .light-only}

**In YAML:** `weekday_format`, `first_day`, `days`. Add these lines to your card:

```yaml
weekday_format: long   # Monday instead of Mon
days: 7                # 5 for Monday to Friday
first_day: sunday      # with 7 days; default monday
```

The today highlight uses the theme's accent colour; change it with `accent` or `today_background` in
[Colours, fonts & sizes](../look/style).

## Weather

A condition icon and the high temperature for each day, with the low after a slash. Use any weather entity that has a daily (or twice-daily) forecast. If it has none, the card says so instead of showing empty days.

**In the visual editor:** Weather → Entity, Show the low temperature

![The Weather panel in the visual editor](/img/editor-weather-dark.webp){.editor-shot .dark-only}
![The Weather panel in the visual editor](/img/editor-weather-light.webp){.editor-shot .light-only}

**In YAML:** `weather`. Add these lines to your card:

```yaml
weather:
  entity: weather.home
  show_low: true
```

## Name days and holidays

Calendars such as name days or public holidays crowd a day if every entry is an event. Shown as a label, their titles appear
as one small line under the date instead. Up to two calendars can be labels.

**In the visual editor:** Calendars → Show as, Remove this prefix from titles, Tag after each title, Colour

![The Calendars panel in the visual editor](/img/editor-calendars-dark.webp){.editor-shot .dark-only}
![The Calendars panel in the visual editor](/img/editor-calendars-light.webp){.editor-shot .light-only}

**In YAML:** `display: label` on a calendar. Add these lines to your card:

```yaml
entities:
  - entity: calendar.namedays
    display: label
    strip_prefix: "Name day:"   # removed from the start of each title
    suffix: CZ                  # small tag after each name
    color: "#F4A27A"
```

## Moon

The moon's phase for each day, beside the weather.

**In the visual editor:** Moon → Enabled, Show the phase name, Hemisphere

![The Moon panel in the visual editor](/img/editor-moon-dark.webp){.editor-shot .dark-only}
![The Moon panel in the visual editor](/img/editor-moon-light.webp){.editor-shot .light-only}

**In YAML:** `moon`. Add these lines to your card:

```yaml
moon:
  enabled: true
  show_name: true      # "Waxing crescent" next to the icon, where there's room
  hemisphere: south    # flips the drawing for the southern hemisphere
```

The phase comes from the average lunar cycle and can be off by up to about half a day.

## Cycle tracking: period, fertile window and ovulation {#cycle-tracking}

Optional, off by default. What you'll see on each day:

- a **ring** around the date showing where the day sits in the cycle,
- a **drop** on expected period days,
- a soft **tint** on the fertile window,
- an **egg** icon on the expected ovulation day.

**In the visual editor:** Cycle → Enabled, Values from, Last period started, Cycle length, Period length, Show the fertile window, Show ovulation

![The Cycle panel in the visual editor](/img/editor-cycle-dark.webp){.editor-shot .dark-only}
![The Cycle panel in the visual editor](/img/editor-cycle-light.webp){.editor-shot .light-only}

**In YAML:** `period`. Add these lines to your card:

```yaml
period:
  enabled: true
  last_period: 2026-10-02    # YYYY-MM-DD
  cycle_length: 28           # days
  period_length: 5           # days
  show_fertile: true
  show_ovulation: true
```

Update the last period date when a new period starts.

### From helpers {#cycle-helpers}

To keep one start date for several dashboards, or to log a new period from a phone, store the values in Home Assistant
helpers and point the card at them. Create them under Settings → Devices & services → Helpers:

- **Date and time**, date only, for the start date,
- **Number**, 20 – 45, for the cycle length, and **Number**, 1 – 10, for the period length (optional).

Or define them in `configuration.yaml`. Leave out `initial`: with it, Home Assistant resets the helper on every restart.

```yaml
input_datetime:
  last_period:
    name: Last period
    has_date: true
    has_time: false

input_number:
  cycle_length:
    name: Cycle length
    min: 20
    max: 45
    step: 1
    mode: box
    unit_of_measurement: days
  period_length:
    name: Period length
    min: 1
    max: 10
    step: 1
    mode: box
    unit_of_measurement: days
```

In the visual editor, set **Values from** to **Helpers** and pick them. In YAML, use the entity ids instead of the values:

```yaml
period:
  enabled: true
  last_period: input_datetime.last_period
  cycle_length: input_number.cycle_length
  period_length: input_number.period_length
```

Each of the three can be a helper or a fixed value on its own. A sensor works too: a date sensor, or a timestamp sensor,
which counts as its local date. The card redraws as soon as a helper changes. While a helper is missing, `unknown` or
`unavailable`, the card shows no cycle at all rather than a guess.

To log a new start in one tap, add a script that sets the date to today or a few days back:

```yaml
script:
  period_started:
    alias: Period started
    mode: single
    fields:
      days_ago:
        name: Days ago
        default: 0
        selector:
          number:
            min: 0
            max: 7
    sequence:
      - action: input_datetime.set_datetime
        target:
          entity_id: input_datetime.last_period
        data:
          date: "{{ (now().date() - timedelta(days=days_ago | int(0))) | string }}"
```

and a button for it on any dashboard (`days_ago: 1` makes a "Started yesterday" button):

```yaml
type: button
name: Started today
icon: mdi:water
tap_action:
  action: perform-action
  perform_action: script.period_started
  data:
    days_ago: 0
  confirmation:
    text: Set today as the start of a new period?
```

::: warning Good to know
- **Privacy:** fixed values are stored in the dashboard configuration. Anyone who can open that dashboard in Home
  Assistant can read them, and they are included in backups. Helpers are readable by every Home Assistant user,
  through the app and the API, and their history keeps past dates in the recorder database and in backups.
- **Accuracy:** predictions use a fixed cycle length and the standard 14-day luteal phase. They are a calendar hint, not
  medical advice and not a contraception method.
:::

The ring, drop, tint and egg colours are style tokens: see [Colours, fonts & sizes](../look/style).
