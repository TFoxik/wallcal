import { css } from 'lit';

export const cardStyles = css`
  :host {
    display: block;
  }
  ha-card {
    display: flex;
    flex-direction: column;
    gap: var(--wallcal-gap);
    height: 100%;
    box-sizing: border-box;
    padding: 20px;
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
  .bar__title {
    margin: 0;
    font-family: var(--wallcal-title-font);
    font-size: var(--wallcal-title-size);
    font-weight: 500;
    line-height: 1.2;
  }
  .bar__warning svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: var(--wallcal-period-color);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
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
  .nav svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .nav--current {
    color: var(--wallcal-muted);
  }
  .grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(var(--wallcal-days, 7), minmax(0, 1fr));
    gap: var(--wallcal-gap);
    min-height: 0;
  }
  .day {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 240px;
    padding: 12px;
    border-radius: var(--wallcal-radius);
    background: var(--wallcal-surface);
  }
  .day > *,
  .day__header > *,
  .chip > * {
    position: relative;
  }
  .day--today {
    box-shadow: inset 0 0 0 2px var(--wallcal-accent);
  }
  .day--today::before,
  .day--fertile .day__header::before,
  .chip--allday::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    border-radius: inherit;
    pointer-events: none;
  }
  .day--today::before {
    background: var(--wallcal-today-background);
    opacity: 0.12;
  }
  .day__header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px;
    border-radius: calc(var(--wallcal-radius) - 4px);
  }
  .day--fertile .day__header::before {
    background: var(--wallcal-fertile-color);
    opacity: 0.25;
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
    font-size: var(--wallcal-weekday-size);
    color: var(--wallcal-muted);
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
    width: calc(var(--wallcal-date-size) * 1.75);
    height: calc(var(--wallcal-date-size) * 1.75);
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
  .day__events {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
  }
  .chip {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 8px 10px;
    border-radius: var(--wallcal-chip-radius);
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
`;
