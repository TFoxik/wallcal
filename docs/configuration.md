# WallCal configuration reference

Every option with its default. Only `type` and `entities` are required. Invalid config shows as an
error card with a message naming the bad option.

```yaml
type: custom:wallcal-card
entities:                         # required, at least one
  - entity: calendar.family
    color: "#7F77DD"              # default from a built-in palette
    name: Family                  # toggle chip label/tooltip; default: the entity's friendly name
    toggle: false                 # true adds a show/hide chip in the top bar
    icon: mdi:account-group       # chip icon; default is the first letter of the name
    display: chip                 # chip | label: label shows titles as a line in the day header (max 2 calendars)
    strip_prefix: "Svátek:"       # removed from the start of this calendar's titles
    suffix: SK                    # small tag after each title
  - calendar.work                 # shorthand: entity id only
days: 7                           # 5 | 7
first_day: monday                 # monday … sunday; ignored when days: 5
time_format: auto                 # 12 | 24 | auto
weekday_format: short             # short (Mon) | long (Monday)
show_end_time: false              # timed events show "8:30 – 9:15"
past_days: normal                 # normal | dim | grey: days before today
past_events: show                 # show | dim | hide: today's events that have ended
auto_scroll: true                 # today's list scrolls to the next upcoming event
refresh_interval: 300             # seconds, 60 – 86400
header:
  show: true
  title: month                    # month | range | none | any other text, shown as is
  subtitle: none                  # same values as title, smaller and muted beside it
  align: left                     # left | center
  navigation: true
  idle_return: 60                 # seconds before jumping back to this week; 0 = never
weather:                          # off when omitted
  entity: weather.home
  show_low: true
moon:
  enabled: false
  show_name: false
  hemisphere: north               # north | south
period:
  enabled: false
  last_period: 2026-10-02         # required when enabled, YYYY-MM-DD
  cycle_length: 28
  period_length: 5
  show_fertile: true
  show_ovulation: true
theme: default                    # default | paper | midnight
style: {}                         # any token below, plus font_url
overlays:                         # cards floating over the bottom of the week, one per position
  - position: bottom-right        # required: bottom-left | bottom-center | bottom-right
    span: 2                       # day columns it is centred over
    width: 90%                    # share of those columns, 10% – 100%
    max_height: 40%               # of the grid height, or px; scrolls past it
    offset: 8                     # px from the bottom, e.g. 72 to clear navbar-card
    toggle: header                # header (button in the top bar) | pill (minimizes in place) | none (always shown)
    pill: full                    # full (icon, name, count) | compact (icon and count only)
    visible: false                # shown on a device that has never toggled it
    icon: mdi:card-outline
    name: Shopping                # button label; default: the card's title or its entity's name
    card:                         # required: any Lovelace card with its own options
      type: todo-list
      entity: todo.shopping
```

## Style tokens

Set under `style:`. Later wins: Home Assistant theme → `theme:` preset → `style:`.

| Token | Default | Purpose |
|-------|---------|---------|
| `background` | HA card background | card background |
| `surface` | `rgba(127, 127, 127, 0.1)` | day column and button background |
| `text` | HA primary text colour | main text |
| `muted` | HA secondary text colour | weekday, times |
| `accent` | HA primary colour | today highlight, buttons |
| `today_background` | `accent` at 12% opacity | today column tint |
| `divider` | HA divider colour | separators |
| `radius` | HA card radius, else 16px | card corners |
| `day_radius` | `radius` | day column corners |
| `chip_radius` | 10px | event chip corners |
| `overlay_background` | day-column colour with a light wash | floating overlay panel |
| `gap` | 4px | gap between columns |
| `padding` | 8px | space between the card edge and its content |
| `font_family` | `inherit` | all text |
| `title_font` | `font_family` | top bar title |
| `title_size` | 28px | top bar title |
| `date_size` | 32px | day number |
| `weekday_size` | 15px | weekday name |
| `event_size` | 15px | event title |
| `allday_size` | `event_size` − 2px | all-day event title |
| `time_size` | 13px | event time |
| `period_color` | `#E24B4A` | drop, period ring |
| `fertile_color` | `#5DCAA5` | fertile tint |
| `ovulation_color` | `#1D9E75` | ovulation icon |
| `ring_color` | `#D4537E` | cycle ring outside the period |
| `moon_color` | `muted` | lit part of the moon |

`style.font_url` (must start with `https://` or `/`) loads a font stylesheet once per page.
Otherwise WallCal uses fonts the browser already has.

Presets: `default` uses the Home Assistant theme as is, `paper` is warm off-white with a serif
title, `midnight` is near-black and low-glare for night.
