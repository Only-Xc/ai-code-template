from fast_items.module import items_module
from fast_items.openapi import ITEMS_OPENAPI_TAGS

from app.bootstrap import create_app

app = create_app(
    router=items_module.router,
    title="fast-items-api",
    openapi_tags=ITEMS_OPENAPI_TAGS,
)
