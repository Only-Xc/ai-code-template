from collections.abc import Awaitable, Callable

from fastapi import Request, Response

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
}

DEFAULT_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'"
DOCS_PATH_PREFIXES = ("/docs", "/redoc")


def should_skip_security_headers(path: str) -> bool:
    return path.startswith(DOCS_PATH_PREFIXES)


async def security_headers_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    response = await call_next(request)
    if should_skip_security_headers(request.url.path):
        return response

    for name, value in SECURITY_HEADERS.items():
        # setdefault 保留上游路由对特殊响应头的显式覆盖能力。
        response.headers.setdefault(name, value)
    response.headers.setdefault(
        "Content-Security-Policy",
        DEFAULT_CONTENT_SECURITY_POLICY,
    )
    return response
