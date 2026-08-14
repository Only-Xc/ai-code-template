from dataclasses import dataclass

from fastapi import APIRouter

from fast_items import routers


@dataclass(frozen=True)
class ItemsModule:
    router: APIRouter


def create_items_module() -> ItemsModule:
    router = APIRouter(prefix="/v1")
    router.include_router(routers.router)
    return ItemsModule(router=router)


items_module = create_items_module()
