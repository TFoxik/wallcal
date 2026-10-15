# WallCal user guide

What WallCal can do and how to set each part up. Every example is a complete card you can paste
into the card's YAML editor. For a compact list of every option and its default, see the
[configuration reference](configuration.md).

- [Getting started](#getting-started)
- [Calendars](#calendars)
- [The week](#the-week)
- [Top bar and navigation](#top-bar-and-navigation)
- [Weather](#weather)
- [Moon phase](#moon-phase)
- [Cycle tracking](#cycle-tracking)
- [Floating cards](#floating-cards)
- [Themes and styling](#themes-and-styling)
- [Wall tablet tips](#wall-tablet-tips)
- [Troubleshooting](#troubleshooting)

## Getting started

The smallest working card is a list of calendars:

```yaml
type: custom:wallcal-card
entities:
  - calendar.family
```

Any Home Assistant calendar works: Google, CalDAV, Local Calendar, holiday calendars and so on.
If something in the config is wrong, the card shows an error that names the option, for example
`days must be 5 or 7`.

Where you put the card changes how it sizes itself:

| Dashboard view | What happens |
|---|---|
| **Panel** (recommended for a wall) | Fills the screen below the HA header. Busy days scroll inside their column. |
| **Sections** | Uses the section's height. Give the section a wide column span: seven days need about 900 px. |
| **Masonry** | Grows to fit every event, so the card can get very tall. |

## Calendars

Each calendar gets a colour from a built-in palette, or you choose one:

```yaml
type: custom:wallcal-card
entities:
  - entity: calendar.family
    color: "#7F77DD"
  - entity: calendar.work
    color: "#5DCAA5"
  - calendar.school          # shorthand: default colour
```

All-day events sit at the top of each day. An event that started on an earlier day shows
**continues** instead of a start time.

### Show and hide calendars from the top bar

Add `toggle: true` and the calendar gets a round chip in the top bar. Tap it to hide or show that
calendar.

```yaml
entities:
  - entity: calendar.work
    toggle: true
    name: Work               # chip tooltip; default is the calendar's name
    icon: mdi:briefcase      # default is the first letter of the name
```

The choice is remembered on that device until you tap again, so the kitchen tablet can hide work
while your desk browser still shows it.

### Name days and holidays as labels

Calendars such as name days or public holidays crowd a day if every entry is an event. With
`display: label`, their titles appear as one small line under the date instead. Up to two
calendars can be labels.

```yaml
entities:
  - calendar.family
  - entity: calendar.namedays
    display: label
    strip_prefix: "Name day:"   # removed from the start of each title
    suffix: CZ                  # small tag after each name
    color: "#F4A27A"
```

## The week

```yaml
type: custom:wallcal-card
entities:
  - calendar.family
days: 5                  # Monday to Friday; default 7
first_day: sunday        # with 7 days; default monday
time_format: 24          # 12, 24 or auto (from your HA profile)
weekday_format: long     # Monday instead of Mon
show_end_time: true      # 8:30 – 9:15
past_days: dim           # earlier days: normal, dim or grey
past_events: hide        # today's finished events: show, dim or hide
```

- **Today** is highlighted. Its list scrolls to the next upcoming event on its own
  (`auto_scroll: false` turns that off).
- **"+N more"** appears under a day whose events don't all fit. Tap it to scroll to them.
- Events refresh every 5 minutes. Change it with `refresh_interval` (in seconds, 60 or more).

## Top bar and navigation

The top bar shows the month, arrows to move between weeks, and a **Today** button.

```yaml
header:
  title: range           # month, range, none, or any text such as "Our week"
  subtitle: month        # same choices, smaller and muted
  align: center          # left or center
  navigation: true       # arrows and Today button
  idle_return: 120       # seconds untouched before it jumps back to this week; 0 = never
```

`header: { show: false }` hides the top bar completely.

## Weather

Point WallCal at any weather entity that has a daily forecast. Each day then shows a condition
icon and the high temperature, with the low after a slash.

```yaml
weather:
  entity: weather.home
  show_low: true
```

If the entity has no daily forecast, the card says so instead of showing empty days.

## Moon phase

```yaml
moon:
  enabled: true
  show_name: true        # "Waxing crescent" next to the icon, where there's room
  hemisphere: south      # flips the drawing for the southern hemisphere
```

The phase comes from the average lunar cycle and can be off by up to about half a day.

## Cycle tracking

Optional, off by default. Give the start date of the last period and the usual lengths:

```yaml
period:
  enabled: true
  last_period: 2026-10-02    # YYYY-MM-DD
  cycle_length: 28           # days
  period_length: 5           # days
  show_fertile: true
  show_ovulation: true
```

What you'll see on each day:

- a **ring** around the date showing where the day sits in the cycle,
- a **drop** on expected period days,
- a soft **tint** on the fertile window,
- an **egg** icon on the expected ovulation day.

Update `last_period` when a new period starts. Two things to keep in mind:

- **Privacy:** these settings are stored in the dashboard configuration. Anyone who can open that
  dashboard in Home Assistant can read them, and they are included in backups.
- **Accuracy:** predictions use a fixed cycle length and the standard 14-day luteal phase. They are
  a calendar hint, not medical advice and not a contraception method.

## Floating cards

An overlay floats any Lovelace card over the bottom of the week: a shopping list, a thermostat, a
media player. There can be one at each of `bottom-left`, `bottom-center` and `bottom-right`.

```yaml
overlays:
  - position: bottom-right
    icon: mdi:format-list-checks
    toggle: pill             # how to show and hide it, see below
    card:
      type: todo-list
      entity: todo.shopping
      hide_completed: true
```

**Showing and hiding** (`toggle`):

| Value | Behaviour |
|---|---|
| `header` (default) | A button in the top bar shows and hides it. |
| `pill` | It shrinks to a small pill in place. `pill: compact` shows only the icon and count. |
| `none` | Always shown. |

Use `visible: true` for an overlay that should be open on a device that has never toggled it.
After that, each device remembers its own choice.

**Size and placement:**

```yaml
    span: 2                  # day columns it sits over
    width: 90%               # share of those columns
    max_height: 40%          # of the grid height, or px; scrolls beyond that
    offset: 72               # px from the bottom, e.g. to clear navbar-card
```

Home Assistant's own cards pick up WallCal's colours. Cards that hard-code their colours may not.
The panel background is the `overlay_background` style token.

## Themes and styling

Pick a preset:

| Theme | Look |
|---|---|
| `default` | Follows your Home Assistant theme. |
| `paper` | Warm off-white with a serif title. |
| `midnight` | Near-black and low-glare, for a bedroom or night use. |

Then adjust anything under `style`. Values apply in this order, later wins: Home Assistant theme,
then `theme`, then `style`.

```yaml
theme: paper
style:
  accent: "#D4537E"          # today highlight and buttons
  date_size: 40              # px
  event_size: 17
  font_url: https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap
  font_family: Inter, sans-serif
```

The [configuration reference](configuration.md#style-tokens) lists every token: colours, corner
radii, spacing, font sizes, and the cycle and moon colours.

## Wall tablet tips

- Give the card its own **Panel** view and open that view's URL on the tablet.
- Keep the screen on with your tablet's kiosk or "stay awake" setting.
- WallCal does nothing between refreshes, so it is gentle on old devices and batteries.
- After updating WallCal, reload the page on the tablet. If it still shows the old version, clear
  the browser cache or restart the Home Assistant app. Tablets cache the card aggressively.

## Troubleshooting

**"Custom element doesn't exist: wallcal-card"**
The card's file isn't loaded. Reload the browser. With HACS, check that Settings → Dashboards →
⋮ → Resources lists `/hacsfiles/wallcal/wallcal-card.js`. Dashboards in YAML mode need that
resource added under `lovelace: resources:` by hand.

**The card shows an error message**
It names the option that's wrong and what it expects. Fix that line in the YAML.

**No weather**
The weather entity needs a daily (or twice-daily) forecast. The card shows a note when it has
none.

**A calendar is missing**
Check whether it was hidden with its top-bar chip on this device. Tap the chip to bring it back.

**Still stuck?**
[Open an issue](https://github.com/TFoxik/wallcal/issues) with your card YAML (remove anything
private) and what you see.
