"""In-memory to-do list for the WallCal dev instance; it resets on restart."""

from __future__ import annotations

from dataclasses import replace
from uuid import uuid4

from homeassistant.components.todo import TodoItem, TodoItemStatus, TodoListEntity, TodoListEntityFeature
from homeassistant.core import HomeAssistant

ITEMS = ("Milk", "Bread", "Call grandma", "Water the plants", "Return library books")


async def async_setup_platform(hass: HomeAssistant, config, async_add_entities, discovery_info=None) -> None:
    async_add_entities([FixtureTodo()])


class FixtureTodo(TodoListEntity):
    _attr_name = "Shopping"
    _attr_unique_id = "wallcal_fixture_shopping"
    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM
        | TodoListEntityFeature.UPDATE_TODO_ITEM
        | TodoListEntityFeature.DELETE_TODO_ITEM
        | TodoListEntityFeature.MOVE_TODO_ITEM
    )

    def __init__(self) -> None:
        self._attr_todo_items = [
            TodoItem(summary=summary, uid=uuid4().hex, status=TodoItemStatus.NEEDS_ACTION) for summary in ITEMS
        ]

    async def async_create_todo_item(self, item: TodoItem) -> None:
        new = replace(item, uid=uuid4().hex, status=item.status or TodoItemStatus.NEEDS_ACTION)
        self._attr_todo_items = [*self._attr_todo_items, new]
        self.async_write_ha_state()

    async def async_update_todo_item(self, item: TodoItem) -> None:
        self._attr_todo_items = [item if existing.uid == item.uid else existing for existing in self._attr_todo_items]
        self.async_write_ha_state()

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        self._attr_todo_items = [item for item in self._attr_todo_items if item.uid not in uids]
        self.async_write_ha_state()

    async def async_move_todo_item(self, uid: str, previous_uid: str | None = None) -> None:
        items = list(self._attr_todo_items)
        moving = next(item for item in items if item.uid == uid)
        items.remove(moving)
        index = 0 if previous_uid is None else next(i for i, item in enumerate(items) if item.uid == previous_uid) + 1
        items.insert(index, moving)
        self._attr_todo_items = items
        self.async_write_ha_state()
