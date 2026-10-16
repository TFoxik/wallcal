# Top bar

![The top bar: the month title on the left, calendar chips, week arrows and the Today button on the right](/img/topbar-dark.webp){.dark-only}
![The top bar in the Paper theme](/img/topbar-light.webp){.light-only}

The strip above the week: a title, the calendar chips, and the arrows to move between weeks.

## Title and subtitle

The text on the left. It can show the month, the date range of the week, nothing, or your own words. The subtitle is the
same, smaller and muted, beside it.

**In the visual editor:** Top bar → Title, Subtitle, Align

![The Top bar panel in the visual editor](/img/editor-top-bar-dark.webp){.editor-shot .dark-only}
![The Top bar panel in the visual editor](/img/editor-top-bar-light.webp){.editor-shot .light-only}

**In YAML:** `header.title`, `header.subtitle`, `header.align`. Add these lines to your card:

```yaml
header:
  title: range      # month | range | none | any other text, e.g. "Our week"
  subtitle: month
  align: center     # left | center
```

## Calendar chips

A round chip for a calendar in the top bar. Tap it to hide or show that calendar. Each device remembers its own choice, so
the kitchen tablet can hide work while your desk browser still shows it.

**In the visual editor:** Calendars → Show/hide chip in the top bar, Chip icon, Name

![The Calendars panel in the visual editor](/img/editor-calendars-dark.webp){.editor-shot .dark-only}
![The Calendars panel in the visual editor](/img/editor-calendars-light.webp){.editor-shot .light-only}

**In YAML:** `toggle`, `icon` and `name` on a calendar. Add these lines to your card:

```yaml
entities:
  - entity: calendar.work
    toggle: true
    icon: mdi:briefcase    # default: the first letter of the name
    name: Work             # tooltip; default: the calendar's name
```

## Week arrows and Today

Arrows to move between weeks and a **Today** button. When nobody touches the card for a while, it jumps back to this week
by itself.

**In the visual editor:** Top bar → Week navigation, Back to this week after

**In YAML:** `header.navigation`, `header.idle_return`. Add these lines to your card:

```yaml
header:
  navigation: true
  idle_return: 60     # seconds untouched; 0 = never jump back
```

## Hiding the top bar

**In the visual editor:** Top bar → Show the top bar

**In YAML:** `header.show`. Add these lines to your card:

```yaml
header:
  show: false
```
