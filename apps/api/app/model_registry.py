"""Import all SQLModel table models for Alembic metadata registration."""

from fast_auth.models import User
from fast_items.models import Item

# Alembic 只需要 import side effect，让 SQLModel.metadata 收集全部 table。
__all__ = [
    "Item",
    "User",
]
