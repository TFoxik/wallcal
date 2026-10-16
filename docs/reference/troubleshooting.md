# Troubleshooting

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
