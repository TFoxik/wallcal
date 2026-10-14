import { css } from 'lit';

export const cardStyles = css`
  :host {
    display: block;
    height: 100%;
  }
  /* The panel view wraps the card in an auto-height element, so 100% would grow with the events
     instead of fitting the screen and letting busy days scroll. */
  :host([layout='panel']) {
    height: calc(100vh - var(--header-height, 56px));
  }
  /* The panel view squares every card's corners but keeps the theme's radius here; the default
     radius token reads --ha-card-border-radius, so restoring it rounds the card, days and headers. */
  :host([layout='panel']) ha-card {
    --ha-card-border-radius: var(--restore-card-border-radius, 16px);
  }
  ha-card {
    display: flex;
    flex-direction: column;
    gap: var(--wallcal-gap);
    height: 100%;
    box-sizing: border-box;
    padding: var(--wallcal-padding);
    overflow: hidden;
    background: var(--wallcal-background);
    color: var(--wallcal-text);
    font-family: var(--wallcal-font-family);
    border-radius: var(--wallcal-radius);
  }
  .bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
  }
  .bar__center {
    text-align: center;
  }
  .bar__end {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  }
  .bar__heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 14px;
    min-width: 0;
  }
  .bar__center .bar__heading {
    justify-content: center;
  }
  .bar__subtitle {
    font-size: calc(var(--wallcal-title-size) * 0.64);
    color: var(--wallcal-muted);
    font-variant-numeric: tabular-nums;
  }
  .bar__title {
    margin: 0;
    font-family: var(--wallcal-title-font);
    font-size: var(--wallcal-title-size);
    font-weight: 500;
    line-height: 1.2;
  }
  .nav {
    all: unset;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 44px;
    padding: 0 12px;
    box-sizing: border-box;
    border-radius: 22px;
    background: var(--wallcal-surface);
    color: var(--wallcal-text);
    font-size: 15px;
  }
  .nav svg,
  .bar__warning svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .bar__warning svg {
    stroke: var(--wallcal-period-color);
  }
  .nav--current {
    color: var(--wallcal-muted);
  }
  .toggles {
    display: flex;
    gap: 8px;
  }
  .toggle {
    all: unset;
    cursor: pointer;
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--toggle-color);
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
    --mdc-icon-size: 22px;
  }
  .toggle--hidden {
    background: var(--wallcal-surface);
    color: var(--toggle-color);
    opacity: 0.6;
  }
  .grid {
    --ring-size: calc(var(--wallcal-date-size) * 1.75);
    flex: 1;
    display: grid;
    grid-template-columns: repeat(var(--wallcal-days, 7), minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr);
    gap: var(--wallcal-gap);
    min-height: 0;
    position: relative;
  }
  /* The button reset goes first so the shared rule below is not wiped by it. */
  .pill {
    all: unset;
  }
  .overlay,
  .pill {
    --overlay-col: calc((100% - (var(--wallcal-days, 7) - 1) * var(--wallcal-gap)) / var(--wallcal-days, 7));
    --overlay-band: calc(var(--overlay-span) * var(--overlay-col) + (var(--overlay-span) - 1) * var(--wallcal-gap));
    position: absolute;
    z-index: 1;
    bottom: var(--overlay-offset);
    box-sizing: border-box;
    background: var(--wallcal-overlay-background);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  }
  /* Centre of the band: the panel and the pill share it, so a pill expands in place. */
  .overlay--bottom-left,
  .pill--bottom-left {
    --overlay-centre: calc(var(--overlay-band) / 2);
  }
  .overlay--bottom-right,
  .pill--bottom-right {
    --overlay-centre: calc(100% - var(--overlay-band) / 2);
  }
  .overlay--bottom-center,
  .pill--bottom-center {
    --overlay-centre: 50%;
  }
  .overlay {
    left: calc(var(--overlay-centre) - var(--overlay-band) * var(--overlay-width) / 2);
    width: calc(var(--overlay-band) * var(--overlay-width));
    max-height: var(--overlay-max-height);
    overflow: auto;
    border-radius: var(--wallcal-day-radius);
    --ha-card-background: transparent;
    --card-background-color: transparent;
    --ha-card-box-shadow: none;
    --ha-card-border-width: 0;
    --primary-text-color: var(--wallcal-text);
    --secondary-text-color: var(--wallcal-muted);
    --primary-color: var(--wallcal-accent);
    --divider-color: var(--wallcal-divider);
    /* HA resolves these from its own theme once on the page; remap them so hosted cards follow the
       WallCal preset even when it differs from the HA theme (paper on a dark HA). */
    --mdc-theme-text-primary-on-background: var(--wallcal-text);
    --mdc-theme-text-secondary-on-background: var(--wallcal-muted);
    --mdc-theme-on-surface: var(--wallcal-text);
    --mdc-theme-primary: var(--wallcal-accent);
    --mdc-theme-secondary: var(--wallcal-accent);
    --mdc-checkbox-unchecked-color: var(--wallcal-muted);
    --ha-color-fill-primary-loud-resting: var(--wallcal-accent);
    --ha-color-fill-primary-loud-hover: var(--wallcal-accent);
    --ha-color-text-primary: var(--wallcal-text);
    --ha-color-text-secondary: var(--wallcal-muted);
    --wa-color-text-normal: var(--wallcal-text);
    --wa-color-text-quiet: var(--wallcal-muted);
    --wa-form-control-value-color: var(--wallcal-text);
    --wa-form-control-placeholder-color: var(--wallcal-muted);
    --ha-color-form-background: var(--wallcal-surface);
    --ha-color-form-background-hover: var(--wallcal-surface);
    --wa-form-control-background-color: var(--wallcal-surface);
  }
  .overlay__handle {
    all: unset;
    cursor: pointer;
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 22px;
    background: inherit;
  }
  .overlay__handle::before {
    content: '';
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--wallcal-muted);
    opacity: 0.6;
  }
  .pill {
    left: var(--overlay-centre);
    transform: translateX(-50%);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 16px 0 12px;
    border-radius: 22px;
    color: var(--wallcal-text);
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
    --mdc-icon-size: 22px;
  }
  .pill--compact {
    justify-content: center;
    min-width: 44px;
    padding: 0 11px;
  }
  .pill ha-icon {
    color: var(--wallcal-accent);
  }
  .pill__count {
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    box-sizing: border-box;
    border-radius: 11px;
    background: var(--wallcal-accent);
    color: #fff;
    font-size: 13px;
    display: inline-grid;
    place-items: center;
  }
  .overlay__message {
    margin: 0;
    padding: 12px 16px;
    color: var(--wallcal-muted);
    font-size: 14px;
  }
  .day {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    min-height: 240px;
    padding: 8px;
    border-radius: var(--wallcal-day-radius);
    background: var(--wallcal-surface);
  }
  .grid--past-dim .day--past {
    opacity: 0.5;
  }
  .grid--past-grey .day--past {
    filter: grayscale(1) opacity(0.5);
  }
  .day--today {
    box-shadow: inset 0 0 0 2px var(--wallcal-accent);
  }
  .day--today::before,
  .day--fertile .day__header::before,
  .chip--allday::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    pointer-events: none;
  }
  .day--today::before {
    background: var(--wallcal-today-background);
    opacity: 0.12;
  }
  .day__header {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    border-radius: calc(var(--wallcal-day-radius) - 4px);
  }
  .day--fertile .day__header::before {
    background: var(--wallcal-fertile-color);
    opacity: 0.25;
  }
  .day__top {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  /* The weekday and forecast need about five weekday-font widths beside the ring. The fixed basis
     makes every column wrap at the same card width, so narrow cards put them under the ring without
     uneven heights. */
  .day--weather .day__top {
    flex-wrap: wrap;
    row-gap: 4px;
  }
  .day--weather .day__meta {
    flex: 1 0 calc(var(--wallcal-weekday-size) * 5);
  }
  /* Days before the first configured period have no ring; give the bare date the ring's footprint
     so their header matches, beside or above the weekday. */
  .grid--cycle .day__top > .day__date {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--ring-size);
    height: var(--ring-size);
  }
  /* Every info line, and the markers on the first one, share this height so headers match. */
  .day__info {
    --line: 18px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-height: var(--line);
    font-size: var(--wallcal-time-size);
    line-height: var(--line);
  }
  .day__labels {
    flex: 1;
    min-width: 0;
  }
  .day__label-line {
    height: var(--line);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .day__date {
    font-size: var(--wallcal-date-size);
    font-weight: 500;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .day--today .day__date {
    color: var(--wallcal-accent);
  }
  .day__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .day__weekday {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--wallcal-weekday-size);
    color: var(--wallcal-muted);
  }
  .suffix {
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.04em;
    opacity: 0.6;
  }
  .day__markers {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 18px;
  }
  .marker {
    width: 18px;
    height: 18px;
  }
  .marker--period {
    fill: var(--wallcal-period-color);
  }
  .marker--ovulation {
    fill: none;
    stroke: var(--wallcal-ovulation-color);
    stroke-width: 2;
  }
  .ring {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: var(--ring-size);
    height: var(--ring-size);
  }
  .ring svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  .ring__track {
    fill: none;
    stroke: var(--wallcal-divider);
    stroke-width: 3;
  }
  .ring__fill {
    fill: none;
    stroke: var(--wallcal-ring-color);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .ring--period .ring__fill {
    stroke: var(--wallcal-period-color);
  }
  .ring__content {
    position: relative;
  }
  .ring .day__date {
    font-size: calc(var(--wallcal-date-size) * 0.8);
  }
  .moon {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--wallcal-time-size);
    color: var(--wallcal-muted);
  }
  .moon svg {
    width: 18px;
    height: 18px;
  }
  .moon__dark {
    fill: var(--wallcal-divider);
  }
  .moon__lit {
    fill: var(--wallcal-moon-color);
  }
  /* Slot and content share one height so days with and without a forecast match. */
  .day__forecast {
    --forecast-line: 22px;
    display: flex;
    height: var(--forecast-line);
  }
  .day__weather {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--wallcal-weekday-size);
    line-height: var(--forecast-line);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    --mdc-icon-size: var(--forecast-line);
  }
  .day__weather ha-icon {
    display: flex;
  }
  .day__info .day__markers {
    flex: none;
  }
  .day__low {
    font-size: 0.85em;
    color: var(--wallcal-muted);
  }
  .day__allday,
  .day__events {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .day__allday {
    flex: none;
    max-height: 40%;
    overflow-y: auto;
  }
  .day__events {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .grid--events-dim .chip--ended {
    opacity: 0.5;
  }
  .grid--events-hide .chip--ended {
    display: none;
  }
  .chip {
    position: relative;
    isolation: isolate;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 8px 10px;
    border-radius: var(--wallcal-chip-radius);
  }
  .chip--allday {
    padding-block: 4px;
  }
  .chip--allday::before {
    background: var(--chip-color);
    opacity: 0.22;
  }
  .chip--timed {
    background: var(--wallcal-background);
    box-shadow: inset 3px 0 0 var(--chip-color);
  }
  .chip__time {
    font-size: var(--wallcal-time-size);
    color: var(--wallcal-muted);
    font-variant-numeric: tabular-nums;
  }
  .chip__title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: var(--wallcal-event-size);
    line-height: 1.3;
  }
  .chip--allday .chip__title {
    -webkit-line-clamp: 1;
    font-size: var(--wallcal-allday-size);
  }
`;
