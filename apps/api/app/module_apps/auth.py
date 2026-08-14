from fast_auth.module import auth_module
from fast_auth.openapi import AUTH_OPENAPI_TAGS

from app.bootstrap import create_app

app = create_app(
    router=auth_module.router,
    title="fast-auth-api",
    openapi_tags=AUTH_OPENAPI_TAGS,
)
