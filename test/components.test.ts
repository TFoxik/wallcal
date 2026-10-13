// @vitest-environment happy-dom
import { render } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ringDash } from '../src/components/cycle-ring';
import { renderDayColumn, type DayColumnProps } from '../src/components/day-column';
import { renderEventChip } from '../src/components/event-chip';
import { renderTopBar, type TopBarProps } from '../src/components/top-bar';
import { normalizeConfig } from '../src/config';
import { wallEvent } from './fixtures';

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.replaceChildren(host);
});

const defaults = normalizeConfig({ entities: ['calendar.family'] });
const event = (title: string, allDay = false) =>
  wallEvent(title, new Date(2026, 9, 13, 14, 5), new Date(2026, 9, 13, 15), allDay);

describe('ringDash', () => {
  it('fills the arc proportionally to the cycle day', () => {
    expect(ringDash({ day: 7, length: 28, isPeriod: false, isFertile: false, isOvulation: false })).toBe('34.56 138.23');
  });
});

describe('renderEventChip', () => {
  it('renders the title as text, never as HTML', () => {
    render(renderEventChip({ event: event('<img src=x onerror=alert(1)>'), continued: false }, 'en-US', 'h23'), host);
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.chip__title')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('shows the start time for timed events', () => {
    render(renderEventChip({ event: event('Dentist'), continued: false }, 'en-US', 'h23'), host);
    expect(host.querySelector('.chip__time')?.textContent).toBe('14:05');
  });

  it('shows "continues" for events carried over from a previous day', () => {
    render(renderEventChip({ event: event('Deploy'), continued: true }, 'en-US', 'h23'), host);
    expect(host.querySelector('.chip__time')?.textContent).toBe('continues');
  });

  it('omits the time for all-day events', () => {
    render(renderEventChip({ event: event('Holiday', true), continued: false }, 'en-US', 'h23'), host);
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
  };
  const ovulating = { day: 14, length: 28, isPeriod: false, isFertile: true, isOvulation: true };
  const bleeding = { day: 2, length: 28, isPeriod: true, isFertile: false, isOvulation: false };

  it('shows only date and weekday with no overlays', () => {
    render(renderDayColumn(base), host);
    expect(host.querySelector('.day__date')?.textContent).toBe('13');
    expect(host.querySelector('.day__weekday')?.textContent).toBe('Tue');
    expect(host.querySelector('.ring, .moon, .marker')).toBeNull();
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
    const events = [{ event: event('First'), continued: false }, { event: event('Second'), continued: false }];
    render(renderDayColumn({ ...base, events }), host);
    expect([...host.querySelectorAll('.chip__title')].map((n) => n.textContent)).toEqual(['First', 'Second']);
  });
});

describe('renderTopBar', () => {
  const props = (): TopBarProps => ({
    header: defaults.header,
    title: 'October 2026',
    isCurrentWeek: true,
    warning: null,
    onPrev: vi.fn(),
    onToday: vi.fn(),
    onNext: vi.fn(),
  });

  it('renders nothing when hidden', () => {
    const p = props();
    render(renderTopBar({ ...p, header: { ...p.header, show: false } }), host);
    expect(host.querySelector('.bar')).toBeNull();
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
