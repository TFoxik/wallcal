// @vitest-environment happy-dom
import { render } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHeaderToggles, type HeaderToggle } from '../src/components/header-toggles';
import { ringDash } from '../src/components/cycle-ring';
import { renderDayColumn, type DayColumnProps } from '../src/components/day-column';
import { renderEventChip } from '../src/components/event-chip';
import { renderTopBar, type TopBarProps } from '../src/components/top-bar';
import { normalizeConfig } from '../src/config';
import type { WallCalEvent } from '../src/data/events';
import { wallEvent } from './fixtures';

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.replaceChildren(host);
});

const defaults = normalizeConfig({ entities: ['calendar.family'] });
const event = (title: string, allDay = false) =>
  wallEvent(title, new Date(2026, 9, 13, 14, 5), new Date(2026, 9, 13, 15), allDay);
const item = (e: WallCalEvent, continued = false, endsLater = false) => ({ event: e, continued, endsLater });

describe('ringDash', () => {
  it('fills the arc proportionally to the cycle day', () => {
    expect(ringDash({ day: 7, length: 28, isPeriod: false, isFertile: false, isOvulation: false })).toBe('34.56 138.23');
  });
});

describe('renderEventChip', () => {
  it('renders the title as text, never as HTML', () => {
    render(renderEventChip(item(event('<img src=x onerror=alert(1)>')), 'en-US', 'h23'), host);
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.chip__title')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('shows the start time for timed events', () => {
    render(renderEventChip(item(event('Dentist')), 'en-US', 'h23'), host);
    expect(host.querySelector('.chip__time')?.textContent).toBe('14:05');
  });

  it('shows "continues" for events carried over from a previous day', () => {
    render(renderEventChip(item(event('Deploy'), true), 'en-US', 'h23'), host);
    expect(host.querySelector('.chip__time')?.textContent).toBe('continues');
  });

  it('shows start and end when asked', () => {
    render(renderEventChip(item(event('Dentist')), 'en-US', 'h23', true), host);
    expect(host.querySelector('.chip__time')?.textContent?.replace(/\s+/g, ' ')).toBe('14:05 – 15:00');
  });

  it('shows only the start when the event ends on a later day, even when asked for the end', () => {
    render(renderEventChip(item(event('Deploy'), false, true), 'en-US', 'h23', true), host);
    expect(host.querySelector('.chip__time')?.textContent).toBe('14:05');
  });

  it('shows "until" on the last day of a carried-over event when asked for the end', () => {
    render(renderEventChip(item(event('Deploy'), true), 'en-US', 'h23', true), host);
    expect(host.querySelector('.chip__time')?.textContent).toBe('until 15:00');
    render(renderEventChip(item(event('Conference'), true, true), 'en-US', 'h23', true), host);
    expect(host.querySelector('.chip__time')?.textContent).toBe('continues');
  });

  it('shows a single time for zero-length events', () => {
    const ping = wallEvent('Ping', new Date(2026, 9, 13, 10), new Date(2026, 9, 13, 10));
    render(renderEventChip(item(ping), 'en-US', 'h23', true), host);
    expect(host.querySelector('.chip__time')?.textContent).toBe('10:00');
  });

  it('omits the time for all-day events', () => {
    render(renderEventChip(item(event('Holiday', true)), 'en-US', 'h23'), host);
    expect(host.querySelector('.chip--allday')).not.toBeNull();
    expect(host.querySelector('.chip__time')).toBeNull();
  });
});

describe('renderDayColumn', () => {
  const base: DayColumnProps = {
    date: new Date(2026, 9, 13),
    isToday: false,
    events: [],
    language: 'en-US',
    hourCycle: 'h23',
    moon: defaults.moon,
    cycle: null,
    showFertile: true,
    showOvulation: true,
    showEndTime: false,
    isPast: false,
    now: null,
    weather: null,
    showLow: true,
    weekdayFormat: 'short',
    labelCalendars: [],
    weatherRow: false,
    markersInInfo: false,
  };
  const ovulating = { day: 14, length: 28, isPeriod: false, isFertile: true, isOvulation: true };
  const bleeding = { day: 2, length: 28, isPeriod: true, isFertile: false, isOvulation: false };

  it('shows only date and weekday with no overlays', () => {
    render(renderDayColumn(base), host);
    expect(host.querySelector('.day__date')?.textContent).toBe('13');
    expect(host.querySelector('.day__weekday')?.textContent).toBe('Tue');
    expect(host.querySelector('.ring, .moon, .marker')).toBeNull();
  });

  it('shows label calendars as header text instead of chips', () => {
    const nameday = { ...event('Sabina', true), entity: 'calendar.namedays', color: '#F4A27A' };
    const props = { ...base, labelCalendars: ['calendar.namedays'] };
    render(renderDayColumn({ ...props, events: [item(nameday), item(event('Trip', true))] }), host);
    const line = host.querySelector('.day__label-line') as HTMLElement;
    expect(line.textContent?.trim()).toBe('Sabina');
    expect(line.style.color).toBe('#F4A27A');
    expect([...host.querySelectorAll('.chip__title')].map((t) => t.textContent)).toEqual(['Trip']);
  });

  it('gives each label calendar its own line, in config order, even when it has no entry that day', () => {
    const cz = { ...event('Vendelín', true), entity: 'calendar.cz' };
    const sk = { ...event('Vendelín', true), entity: 'calendar.sk', suffix: 'SK' };
    const lines = () => [...host.querySelectorAll('.day__label-line')].map((l) => l.textContent?.replace(/\s+/g, ' ').trim());
    render(renderDayColumn({ ...base, labelCalendars: ['calendar.cz', 'calendar.sk'], events: [item(sk), item(cz)] }), host);
    expect(lines()).toEqual(['Vendelín', 'Vendelín SK']);
    render(renderDayColumn({ ...base, labelCalendars: ['calendar.cz', 'calendar.sk'], events: [item(sk)] }), host);
    expect(lines()).toEqual(['', 'Vendelín SK']);
    const second = { ...event('Valentýn', true), entity: 'calendar.cz' };
    render(renderDayColumn({ ...base, labelCalendars: ['calendar.cz'], events: [item(cz), item(second)] }), host);
    expect(lines()).toEqual(['Vendelín · Valentýn']);
  });

  it('puts the weather under the weekday and moves the markers to the info line', () => {
    const moon = { ...defaults.moon, enabled: true };
    const weather = { condition: 'rainy', high: 17.6, low: 8.4 };
    render(renderDayColumn({ ...base, moon }), host);
    expect(host.querySelector('.day__meta .moon')).not.toBeNull();
    expect(host.querySelector('.day__info')).toBeNull();
    render(renderDayColumn({ ...base, moon, weatherRow: true, markersInInfo: true, weather }), host);
    expect(host.querySelector('.day__meta .day__weather')).not.toBeNull();
    expect(host.querySelector('.day__info .moon')).not.toBeNull();
  });

  it('drops the moon name beside the labels, where there is no room for it', () => {
    const moon = { ...defaults.moon, enabled: true, show_name: true };
    render(renderDayColumn({ ...base, moon }), host);
    expect(host.querySelector('.moon')?.textContent?.trim()).not.toBe('');
    render(renderDayColumn({ ...base, moon, weatherRow: true, markersInInfo: true }), host);
    expect(host.querySelector('.moon')?.textContent?.trim()).toBe('');
  });

  it('keeps the forecast slot and the marker line on days without a forecast or a marker', () => {
    render(renderDayColumn({ ...base, weatherRow: true, markersInInfo: true }), host);
    expect(host.querySelector('.day__forecast')).not.toBeNull();
    expect(host.querySelector('.day__info .day__markers')).not.toBeNull();
  });

  it('shows the long weekday name when asked', () => {
    render(renderDayColumn({ ...base, weekdayFormat: 'long' }), host);
    expect(host.querySelector('.day__weekday')?.textContent).toBe('Tuesday');
  });

  it('marks past days', () => {
    render(renderDayColumn(base), host);
    expect(host.querySelector('.day--past')).toBeNull();
    render(renderDayColumn({ ...base, isPast: true }), host);
    expect(host.querySelector('.day--past')).not.toBeNull();
  });

  it('marks today', () => {
    render(renderDayColumn({ ...base, isToday: true }), host);
    expect(host.querySelector('.day--today')).not.toBeNull();
  });

  it('shows the moon when enabled, with the name only when asked', () => {
    render(renderDayColumn({ ...base, moon: { ...base.moon, enabled: true } }), host);
    expect(host.querySelector('.moon path')).not.toBeNull();
    expect(host.querySelector('.moon__name')).toBeNull();
    render(renderDayColumn({ ...base, moon: { ...base.moon, enabled: true, show_name: true } }), host);
    expect(host.querySelector('.moon__name')?.textContent).toBe('Waxing crescent');
  });

  it('shows ring and drop on expected period days', () => {
    render(renderDayColumn({ ...base, cycle: bleeding }), host);
    expect(host.querySelector('.ring--period')).not.toBeNull();
    expect(host.querySelector('.marker--period')).not.toBeNull();
  });

  it('shows fertile tint and ovulation marker when enabled', () => {
    render(renderDayColumn({ ...base, cycle: ovulating }), host);
    expect(host.querySelector('.day--fertile')).not.toBeNull();
    expect(host.querySelector('.marker--ovulation')).not.toBeNull();
  });

  it('hides fertile tint and ovulation marker when switched off', () => {
    render(renderDayColumn({ ...base, cycle: ovulating, showFertile: false, showOvulation: false }), host);
    expect(host.querySelector('.ring')).not.toBeNull();
    expect(host.querySelector('.day--fertile, .marker--ovulation')).toBeNull();
  });

  it('renders events in the given order', () => {
    const events = [item(event('First')), item(event('Second'))];
    render(renderDayColumn({ ...base, events }), host);
    expect([...host.querySelectorAll('.chip__title')].map((n) => n.textContent)).toEqual(['First', 'Second']);
  });

  it('pins all-day events above the scrolling list of timed events', () => {
    render(renderDayColumn({ ...base, events: [item(event('Name day', true)), item(event('Dentist'))] }), host);
    expect(host.querySelector('.day__allday .chip__title')?.textContent).toBe('Name day');
    expect([...host.querySelectorAll('.day__events .chip__title')].map((n) => n.textContent)).toEqual(['Dentist']);
  });

  describe('past events on today', () => {
    const at = (h: number) => new Date(2026, 9, 13, h);
    const events = [
      item(wallEvent('Holiday', new Date(2026, 9, 13), new Date(2026, 9, 14), true)),
      item(wallEvent('Standup', at(9), at(10))),
      item(wallEvent('Review', at(15), at(16))),
    ];
    const titles = () => [...host.querySelectorAll('.chip__title')].map((n) => n.textContent);
    const endedTitles = () => [...host.querySelectorAll('.chip--ended .chip__title')].map((n) => n.textContent);

    it('marks ended timed events, never all-day ones', () => {
      render(renderDayColumn({ ...base, isToday: true, events, now: at(12) }), host);
      expect(titles()).toEqual(['Holiday', 'Standup', 'Review']);
      expect(endedTitles()).toEqual(['Standup']);
    });

    it('leaves other days alone', () => {
      render(renderDayColumn({ ...base, events }), host);
      expect(titles()).toEqual(['Holiday', 'Standup', 'Review']);
      expect(endedTitles()).toEqual([]);
    });
  });

  it('shows the weather icon with rounded high and low temperatures', () => {
    const weather = { condition: 'rainy', high: 17.6, low: 8.4 };
    const configured = { ...base, weatherRow: true };
    render(renderDayColumn({ ...configured, weather }), host);
    expect(host.querySelector('.day__weather ha-icon')?.getAttribute('icon')).toBe('mdi:weather-rainy');
    expect(host.querySelector('.day__temp')?.textContent?.replace(/\s+/g, '')).toBe('18°/8°');
    render(renderDayColumn({ ...configured, weather, showLow: false }), host);
    expect(host.querySelector('.day__temp')?.textContent?.trim()).toBe('18°');
    render(renderDayColumn(base), host);
    expect(host.querySelector('.day__weather')).toBeNull();
  });
});

describe('renderHeaderToggles', () => {
  const toggles: HeaderToggle[] = [
    { id: 'calendar.svatky', label: 'Čeští svátci', color: '#F4A27A', hidden: false },
    { id: 'calendar.namedays', label: 'Namedays', color: '#5DCAA5', icon: 'mdi:flag', hidden: true },
  ];

  it('renders nothing without toggles', () => {
    render(renderHeaderToggles([], vi.fn()), host);
    expect(host.querySelector('.toggles')).toBeNull();
  });

  it('shows the first letter or the icon, with the pressed state and an action label', () => {
    render(renderHeaderToggles(toggles, vi.fn()), host);
    const [first, second] = host.querySelectorAll('button');
    expect(first.textContent?.trim()).toBe('Č');
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(first.getAttribute('aria-label')).toBe('Hide Čeští svátci');
    expect(second.querySelector('ha-icon')?.getAttribute('icon')).toBe('mdi:flag');
    expect(second.classList.contains('toggle--hidden')).toBe(true);
    expect(second.getAttribute('aria-label')).toBe('Show Namedays');
  });

  it('reports the tapped calendar', () => {
    const onToggle = vi.fn();
    render(renderHeaderToggles(toggles, onToggle), host);
    host.querySelectorAll('button')[1].click();
    expect(onToggle).toHaveBeenCalledWith('calendar.namedays');
  });
});

describe('renderTopBar', () => {
  const props = (): TopBarProps => ({
    header: defaults.header,
    title: 'October 2026',
    subtitle: null,
    isCurrentWeek: true,
    warning: null,
    toggles: [],
    overlayToggles: [],
    onToggle: vi.fn(),
    onOverlayToggle: vi.fn(),
    onPrev: vi.fn(),
    onToday: vi.fn(),
    onNext: vi.fn(),
  });

  it('renders nothing when hidden', () => {
    const p = props();
    render(renderTopBar({ ...p, header: { ...p.header, show: false } }), host);
    expect(host.querySelector('.bar')).toBeNull();
  });

  it('puts overlay toggles after the calendar toggles and reports them separately', () => {
    const onToggle = vi.fn();
    const onOverlayToggle = vi.fn();
    render(
      renderTopBar({
        ...props(),
        toggles: [{ id: 'calendar.work', label: 'Work', color: '#378ADD', hidden: false }],
        overlayToggles: [
          { id: 'bottom-right:abc', label: 'Shopping', color: 'var(--wallcal-accent)', icon: 'mdi:cart', hidden: true },
        ],
        onToggle,
        onOverlayToggle,
      }),
      host,
    );
    const buttons = host.querySelectorAll<HTMLButtonElement>('.bar__end .toggle');
    expect([...buttons].map((b) => b.getAttribute('aria-label'))).toEqual(['Hide Work', 'Show Shopping']);
    buttons[1].click();
    expect(onOverlayToggle).toHaveBeenCalledWith('bottom-right:abc');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('puts the title in the start or centre slot', () => {
    const p = props();
    render(renderTopBar(p), host);
    expect(host.querySelector('.bar__start .bar__title')?.textContent).toBe('October 2026');
    render(renderTopBar({ ...p, header: { ...p.header, align: 'center' } }), host);
    expect(host.querySelector('.bar__center .bar__title')).not.toBeNull();
  });

  it('omits the title when there is none', () => {
    render(renderTopBar({ ...props(), title: null }), host);
    expect(host.querySelector('.bar__title')).toBeNull();
  });

  it('shows the subtitle beside the title, or alone', () => {
    render(renderTopBar({ ...props(), title: 'Family calendar', subtitle: 'Oct 12 – 18' }), host);
    expect(host.querySelector('.bar__start .bar__title')?.textContent).toBe('Family calendar');
    expect(host.querySelector('.bar__start .bar__subtitle')?.textContent).toBe('Oct 12 – 18');
    render(renderTopBar({ ...props(), title: null, subtitle: 'Oct 12 – 18' }), host);
    expect(host.querySelector('.bar__title')).toBeNull();
    expect(host.querySelector('.bar__subtitle')?.textContent).toBe('Oct 12 – 18');
  });

  it('wires navigation buttons', () => {
    const p = props();
    render(renderTopBar(p), host);
    host.querySelector<HTMLButtonElement>('button[aria-label="Previous week"]')?.click();
    host.querySelector<HTMLButtonElement>('button[aria-label="Next week"]')?.click();
    host.querySelector<HTMLButtonElement>('.nav--today')?.click();
    expect([p.onPrev, p.onNext, p.onToday].map((f) => (f as ReturnType<typeof vi.fn>).mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('hides navigation when disabled', () => {
    const p = props();
    render(renderTopBar({ ...p, header: { ...p.header, navigation: false } }), host);
    expect(host.querySelector('button')).toBeNull();
  });

  it('shows a warning with the error as tooltip', () => {
    render(renderTopBar({ ...props(), warning: 'calendar.family: boom' }), host);
    expect(host.querySelector('.bar__warning')?.getAttribute('title')).toBe('calendar.family: boom');
  });
});
