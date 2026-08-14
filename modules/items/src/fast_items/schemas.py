import uuid
from datetime import datetime

from fast_core.pagination import Page
from sqlmodel import Field, SQLModel

from fast_items.models import ItemBase


class ItemCreate(ItemBase):
    pass


class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(Page[ItemPublic]):
    pass


class Message(SQLModel):
    message: str
