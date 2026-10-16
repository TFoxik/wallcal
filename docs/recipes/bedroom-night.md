---
harnessView: recipe-bedroom
---

# Bedroom (night)

A calm, low-glare week for a bedroom tablet: the Midnight theme, five working days, bigger text, no navigation buttons, and finished events out of the way.

![The bedroom setup: five days in the near-black Midnight theme with larger text](/img/recipe-bedroom.webp)

## The card

Paste this into the card's code editor:

```yaml
type: custom:wallcal-card
entities:
  - entity: calendar.family
    color: "#8E87E0"
days: 5
theme: midnight
past_days: grey
past_events: hide
header:
  title: range
  navigation: false
style:
  date_size: 40
  event_size: 18
  time_size: 15
```

## In the visual editor

- **In the visual editor:** Calendars → add Family
- **In the visual editor:** Week → Days shown: 5, Earlier days: grey, Today's finished events: hide
- **In the visual editor:** Top bar → Title: range, Week navigation off
- **In the visual editor:** Theme & style → Theme: midnight
- **In the visual editor:** Theme & style → date_size 40, event_size 18, time_size 15
