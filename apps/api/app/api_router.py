from fast_auth.module import auth_module
from fast_items.module import items_module
from fastapi import APIRouter

from app.api.routes import health

api_router = APIRouter()
api_router.include_router(auth_module.router)
api_router.include_router(items_module.router)
api_router.include_router(health.router)
