from typing import Annotated

from fast_core.deps import SessionDep
from fastapi import Depends

from fast_items.service import ItemService


def get_item_service(session: SessionDep) -> ItemService:
    return ItemService(session=session)


ItemServiceDep = Annotated[ItemService, Depends(get_item_service)]
