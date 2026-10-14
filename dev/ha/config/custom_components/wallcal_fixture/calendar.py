"""Calendars whose events come from wallcal_fixture.json, relative to today.

Each item: {"summary", "day": offset from today, "days": n} for all-day events, or
{"summary", "day", "start": "HH:MM", "end": "HH:MM"} for timed ones ("25:00" = 01:00 next day).
Timed events can add "end_day" (offset from today) to end on a later day.
The file is re-read on every poll and query, so editing it simulates calendar changes.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

SCAN_INTERVAL = timedelta(seconds=15)
CALENDARS = ("family", "work", "namedays", "namedays_sk")


async def async_setup_platform(hass: HomeAssistant, config, async_add_entities, discovery_info=None) -> None:
    path = Path(hass.config.path("wallcal_fixture.json"))
    async_add_entities([FixtureCalendar(path, key) for key in CALENDARS], update_before_add=True)


def _at(day: date, hhmm: str) -> datetime:
    hours, minutes = (int(part) for part in hhmm.split(":"))
    midnight = dt_util.start_of_local_day(day)
    return midnight + timedelta(hours=hours, minutes=minutes)


def _to_event(item: dict, today: date) -> CalendarEvent:
    day = today + timedelta(days=item.get("day", 0))
    if "start" not in item:
        return CalendarEvent(summary=item["summary"], start=day, end=day + timedelta(days=item.get("days", 1)))
    end_day = today + timedelta(days=item.get("end_day", item.get("day", 0)))
    return CalendarEvent(summary=item["summary"], start=_at(day, item["start"]), end=_at(end_day, item["end"]))


def _read(path: Path, key: str) -> list[CalendarEvent]:
    items = json.loads(path.read_text()).get(key, [])
    today = dt_util.now().date()
    return sorted((_to_event(item, today) for item in items), key=lambda e: e.start_datetime_local)


class FixtureCalendar(CalendarEntity):
    def __init__(self, path: Path, key: str) -> None:
        self._path = path
        self._key = key
        self._events: list[CalendarEvent] = []
        self._attr_name = key.title()
        self._attr_unique_id = f"wallcal_fixture_{key}"
        self.entity_id = f"calendar.{key}"

    @property
    def event(self) -> CalendarEvent | None:
        now = dt_util.now()
        return next((e for e in self._events if e.end_datetime_local > now), None)

    async def async_update(self) -> None:
        self._events = await self.hass.async_add_executor_job(_read, self._path, self._key)

    async def async_get_events(self, hass: HomeAssistant, start_date: datetime, end_date: datetime) -> list[CalendarEvent]:
        await self.async_update()
        return [e for e in self._events if e.start_datetime_local < end_date and e.end_datetime_local > start_date]
