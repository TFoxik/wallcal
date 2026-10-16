---
harnessView: recipe-kitchen
---

# Kitchen tablet

The whole family's week on the kitchen wall, with the weather, the moon, and the shopping list one tap away. Work can be hidden with its chip, and the card comes back to this week a minute after someone browses ahead.

![The kitchen tablet setup: a week with weather, moon, a work chip and a shopping-list pill](/img/recipe-kitchen-dark.webp){.dark-only}
![The kitchen tablet setup: a week with weather, moon, a work chip and a shopping-list pill](/img/recipe-kitchen-light.webp){.light-only}

## The card

Paste this into the card's code editor:

```yaml
type: custom:wallcal-card
entities:
  - entity: calendar.family
    color: "#7F77DD"
  - entity: calendar.work
    color: "#5DCAA5"
    toggle: true
    icon: mdi:briefcase
past_events: dim
header:
  idle_return: 60
weather:
  entity: weather.home
  show_low: true
moon:
  enabled: true
overlays:
  - position: bottom-right
    icon: mdi:format-list-checks
    toggle: pill
    name: Shopping
    card:
      type: todo-list
      entity: todo.shopping
      hide_completed: true
```

## In the visual editor

- **In the visual editor:** Calendars → add Family and Work; on Work turn on Show/hide chip in the top bar
- **In the visual editor:** Week → Today's finished events: dim
- **In the visual editor:** Top bar → Back to this week after: 60
- **In the visual editor:** Weather → Entity, Show the low temperature
- **In the visual editor:** Moon → Enabled
- **In the visual editor:** Floating cards → add one at bottom-right, Show and hide with: pill, then a To-do list card for the shopping list
