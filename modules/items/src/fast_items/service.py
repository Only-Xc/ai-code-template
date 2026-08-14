import uuid

from fast_core.errors import ForbiddenError, NotFoundError
from fast_core.pagination import PaginationParams
from sqlmodel import Session

from fast_items.models import Item
from fast_items.query_params import SortParam, parse_sort_param, validate_filter_field
from fast_items.repository import ItemRepository
from fast_items.schemas import ItemCreate, ItemPublic, ItemsPublic, ItemUpdate, Message


class ItemService:
    def __init__(self, session: Session, items: ItemRepository | None = None) -> None:
        self.session = session
        self.items = items or ItemRepository(session)

    def list_items(
        self,
        *,
        current_user_id: uuid.UUID,
        is_superuser: bool,
        skip: int = 0,
        limit: int = 100,
        sort: str | None = None,
        title: str | None = None,
    ) -> ItemsPublic:
        pagination = PaginationParams.from_skip_limit(skip=skip, limit=limit)
        sort_param = parse_sort_param(
            sort,
            allowed_fields={"created_at", "title"},
            default=SortParam(field="created_at", direction="desc"),
        )
        if title is not None:
            validate_filter_field("title", allowed_fields={"title"})
        items, count = self.items.list_for_user(
            owner_id=current_user_id,
            is_superuser=is_superuser,
            skip=pagination.offset,
            limit=pagination.limit,
            sort=sort_param,
            title=title,
        )
        items_public = [ItemPublic.model_validate(item) for item in items]
        return ItemsPublic(data=items_public, count=count)

    def get_item(
        self,
        *,
        current_user_id: uuid.UUID,
        is_superuser: bool,
        item_id: uuid.UUID,
    ) -> Item:
        item = self.items.get(item_id)
        if not item:
            raise NotFoundError("Item not found")
        if not self.can_access_item(
            current_user_id=current_user_id,
            is_superuser=is_superuser,
            item=item,
        ):
            raise ForbiddenError("Not enough permissions")
        return item

    def create_item(self, *, current_user_id: uuid.UUID, item_in: ItemCreate) -> Item:
        """Transaction: self-committing."""
        item = self.items.create(item_in=item_in, owner_id=current_user_id)
        self.session.commit()
        self.session.refresh(item)
        return item

    def update_item(
        self,
        *,
        current_user_id: uuid.UUID,
        is_superuser: bool,
        item_id: uuid.UUID,
        item_in: ItemUpdate,
    ) -> Item:
        """Transaction: self-committing."""
        item = self.get_item(
            current_user_id=current_user_id,
            is_superuser=is_superuser,
            item_id=item_id,
        )
        item = self.items.update(item=item, item_in=item_in)
        self.session.commit()
        self.session.refresh(item)
        return item

    def delete_item(
        self,
        *,
        current_user_id: uuid.UUID,
        is_superuser: bool,
        item_id: uuid.UUID,
    ) -> Message:
        """Transaction: self-committing."""
        item = self.get_item(
            current_user_id=current_user_id,
            is_superuser=is_superuser,
            item_id=item_id,
        )
        self.items.delete(item)
        self.session.commit()
        return Message(message="Item deleted successfully")

    def can_access_item(
        self,
        *,
        current_user_id: uuid.UUID,
        is_superuser: bool,
        item: Item,
    ) -> bool:
        return is_superuser or item.owner_id == current_user_id
