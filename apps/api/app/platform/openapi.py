from fast_auth.openapi import AUTH_OPENAPI_TAGS
from fast_items.openapi import ITEMS_OPENAPI_TAGS

HEALTH_OPENAPI_TAGS = [
    {"name": "health", "description": "Liveness and readiness probes."},
]

# tags 是外部 API 文档导航结构，按平台路由挂载顺序汇总各模块声明。
OPENAPI_TAGS = [
    *AUTH_OPENAPI_TAGS,
    *ITEMS_OPENAPI_TAGS,
    *HEALTH_OPENAPI_TAGS,
]
