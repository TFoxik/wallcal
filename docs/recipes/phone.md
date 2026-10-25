---
harnessView: recipe-phone
---

# Phone

WallCal on a phone: a Calendar tab with the next seven days, and a small "next up" card on your Home view
that opens it. The week grid needs a wide screen; these two views are made for a quick look at today while
you're out.

![The agenda view on a phone: a strip of seven days with dots, and today's and tomorrow's events below](/img/recipe-phone-dark.webp){.dark-only}
![The agenda view on a phone: a strip of seven days with dots, and today's and tomorrow's events below](/img/recipe-phone-light.webp){.light-only}

## The Calendar tab

Put this card alone in its own view with the **Panel** layout, so it fills the screen. The strip of days stays
at the top; tap a day to jump to it, and **Today** brings you back.

```yaml
type: custom:wallcal-card
view: agenda
entities:
  - entity: calendar.family
    color: "#7F77DD"
  - entity: calendar.work
    color: "#5DCAA5"
    toggle: true
    icon: mdi:briefcase
  - entity: calendar.namedays
    color: "#F4A27A"
    display: label
    strip_prefix: "Svátek:"
past_events: dim
moon:
  enabled: true
```

## The next-up card

Add this to your Home view. It shows today's name day and the next three events, and a tap opens the Calendar
tab. Set `navigation_path` to that tab's path: the dashboard's URL followed by the view's path.

![The next-up card: today's name day and the next three events](/img/recipe-phone-home-dark.webp){.dark-only}
![The next-up card: today's name day and the next three events](/img/recipe-phone-home-light.webp){.light-only}

```yaml
type: custom:wallcal-card
view: upcoming
entities:
  - entity: calendar.family
    color: "#7F77DD"
  - entity: calendar.work
    color: "#5DCAA5"
    toggle: true
  - entity: calendar.namedays
    color: "#F4A27A"
    display: label
    strip_prefix: "Svátek:"
upcoming:
  count: 3
  navigation_path: /dashboard-phone/calendar
```

Calendars you hide with a chip on the Calendar tab stay hidden on the next-up card too, on that phone.

## In the visual editor

- **In the visual editor:** View → Layout: agenda, or upcoming with Events shown and Open on tap
- **In the visual editor:** Calendars → add Family and Work with their colours, Work with a chip, and the name-day calendar with Show as: label
- **In the visual editor:** Moon → Enabled

The phone views leave out the top bar and the weather, so the editor hides those panels. The next-up card has no
floating cards either.

## A navbar on the Calendar tab

A Panel view shows exactly one card, so a phone navbar can't sit next to the agenda. Host it as a floating card
instead, always shown; a navbar that floats over the page (like navbar-card) places itself:

```yaml
overlays:
  - position: bottom-right
    toggle: none
    card:
      type: custom:navbar-card
      template: phone
```

Floating cards in the agenda count its width as seven columns, so `span: 7` covers the whole width.

## As a pop-up instead of a tab

With [Bubble Card](https://github.com/Clooos/Bubble-Card), the agenda can slide up from the bottom of your Home view
instead of living on its own tab. Point the next-up card at the pop-up's hash and give the agenda a height, since a
pop-up doesn't hand out a full screen the way a Panel view does:

```yaml
type: custom:bubble-card
card_type: pop-up
hash: "#calendar"
name: Calendar
icon: mdi:calendar-month
cards:
  - type: custom:wallcal-card
    view: agenda
    entities:
      - calendar.family
    agenda:
      style: cards
      height: 75vh
```

and on the next-up card:

```yaml
upcoming:
  navigation_path: "#calendar"
```

`agenda.style` picks how days look: `list` (the default) puts the date in a column on the left with a line between
days; `cards` gives each day its own card, with today outlined.

