import uuid
from typing import Any

from sqlmodel import Session, col, func, select

from fast_items.models import Item
from fast_items.query_params import SortDirection, SortParam
from fast_items.schemas import ItemCreate, ItemUpdate


class ItemRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_user(
        self,
        *,
        owner_id: uuid.UUID,
        is_superuser: bool,
        skip: int = 0,
        limit: int = 100,
        sort: SortParam,
        title: str | None = None,
    ) -> tuple[list[Item], int]:
        filters: list[Any] = [] if is_superuser else [Item.owner_id == owner_id]
        if title:
            filters.append(col(Item.title).ilike(f"%{title}%"))

        count_statement = select(func.count()).select_from(Item).where(*filters)
        statement = select(Item).where(*filters)
        statement = statement.order_by(
            self._sort_column(sort.field, direction=sort.direction)
        )
        statement = statement.offset(skip).limit(limit)

        count = self.session.exec(count_statement).one()
        items = list(self.session.exec(statement).all())
        return items, count

    def get(self, item_id: uuid.UUID) -> Item | None:
        return self.session.get(Item, item_id)

    def create(self, *, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
        item = Item.model_validate(item_in, update={"owner_id": owner_id})
        self.session.add(item)
        self.session.flush()
        self.session.refresh(item)
        return item

    def update(self, *, item: Item, item_in: ItemUpdate) -> Item:
        update_dict = item_in.model_dump(exclude_unset=True)
        item.sqlmodel_update(update_dict)
        self.session.add(item)
        self.session.flush()
        self.session.refresh(item)
        return item

    def delete(self, item: Item) -> None:
        self.session.delete(item)
        self.session.flush()

    def _sort_column(self, field: str, *, direction: SortDirection):
        columns = {
            "created_at": col(Item.created_at),
            "title": col(Item.title),
        }
        column = columns[field]
        if direction == "desc":
            return column.desc()
        return column.asc()
