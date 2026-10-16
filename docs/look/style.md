# Colours, fonts & sizes

Every colour, corner, gap and font size of the card is a style token you can change.

**In the visual editor:** Theme & style → colour pickers, sizes in px, Font stylesheet URL, and the font text fields

![The Theme & style panel in the visual editor](/img/editor-theme-style-dark.webp){.editor-shot .dark-only}
![The Theme & style panel in the visual editor](/img/editor-theme-style-light.webp){.editor-shot .light-only}

Below the theme picker the panel lists every token in the tables on this page. A colour or size the pickers can't show (for example an `rgba(…)` colour or `1.2em`) becomes a text box there.

**In YAML:** `style`. Add these lines to your card:

```yaml
style:
  accent: "#D4537E"          # today highlight and buttons
  date_size: 40              # px
  event_size: 17
  font_url: https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap
  font_family: Inter, sans-serif
```

## Colours

| Token | Default | Purpose |
|-------|---------|---------|
| `background` | HA card background | card background |
| `surface` | `rgba(127, 127, 127, 0.1)` | day column and button background |
| `text` | HA primary text colour | main text |
| `muted` | HA secondary text colour | weekday, times |
| `accent` | HA primary colour | today highlight, buttons |
| `today_background` | `accent` at 12% opacity | today column tint |
| `divider` | HA divider colour | separators |
| `overlay_background` | day-column colour with a light wash | floating card panel |
| `period_color` | `#E24B4A` | drop, period ring |
| `fertile_color` | `#5DCAA5` | fertile tint |
| `ovulation_color` | `#1D9E75` | ovulation icon |
| `ring_color` | `#D4537E` | cycle ring outside the period |
| `moon_color` | `muted` | lit part of the moon |

## Shape and spacing

| Token | Default | Purpose |
|-------|---------|---------|
| `radius` | HA card radius, else 16px | card corners |
| `day_radius` | `radius` | day column corners |
| `chip_radius` | 10px | event chip corners |
| `gap` | 4px | gap between columns |
| `padding` | 8px | space between the card edge and its content |

## Text

| Token | Default | Purpose |
|-------|---------|---------|
| `font_family` | `inherit` | all text |
| `title_font` | `font_family` | top bar title |
| `title_size` | 28px | top bar title |
| `date_size` | 32px | day number |
| `weekday_size` | 15px | weekday name |
| `event_size` | 15px | event title |
| `allday_size` | `event_size` − 2px | all-day event title |
| `time_size` | 13px | event time |

`font_url` (must start with `https://` or `/`) loads a font stylesheet once per page. Otherwise WallCal uses fonts the
browser already has.
