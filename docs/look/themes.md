# Themes

<div class="themes">

![WallCal in the default theme](/img/theme-default.webp)

![WallCal in the Paper theme](/img/theme-paper.webp)

![WallCal in the Midnight theme](/img/theme-midnight.webp)

</div>

| Theme | Look |
|---|---|
| `default` | Follows your Home Assistant theme. |
| `paper` | Warm off-white with a serif title. |
| `midnight` | Near-black and low-glare, for a bedroom or night use. |

**In the visual editor:** Theme & style → Theme

![The Theme & style panel in the visual editor](/img/editor-theme-style-dark.webp){.editor-shot .dark-only}
![The Theme & style panel in the visual editor](/img/editor-theme-style-light.webp){.editor-shot .light-only}

**In YAML:** `theme`. Add these lines to your card:

```yaml
theme: paper
```

Then adjust anything in [Colours, fonts & sizes](./style). Values apply in this order, later wins: Home Assistant theme,
then the theme, then style.
