---
harnessView: recipe-family
---

# Family with name days

Everyone's calendar in its own colour, with Czech and Slovak name days as a small line under each date, plus the weather and the moon with its phase name.

![The family setup: coloured calendars with Czech and Slovak name days under each date](/img/recipe-family-dark.webp){.dark-only}
![The family setup: coloured calendars with Czech and Slovak name days under each date](/img/recipe-family-light.webp){.light-only}

## The card

Paste this into the card's code editor:

```yaml
type: custom:wallcal-card
entities:
  - entity: calendar.family
    color: "#7F77DD"
  - entity: calendar.work
    color: "#5DCAA5"
  - entity: calendar.namedays
    color: "#F4A27A"
    display: label
    strip_prefix: "Svátek:"
    suffix: CZ
  - entity: calendar.namedays_sk
    color: "#8FB8E8"
    display: label
    suffix: SK
weekday_format: long
weather:
  entity: weather.home
moon:
  enabled: true
  show_name: true
```

## In the visual editor

- **In the visual editor:** Calendars → add Family and Work with their colours, then the two name-day calendars with Show as: label, a prefix to remove and a tag (CZ, SK)
- **In the visual editor:** Week → Weekday names: long
- **In the visual editor:** Weather → Entity
- **In the visual editor:** Moon → Enabled, Show the phase name
