from collections.abc import Awaitable, Callable

from fastapi import Request, Response

from app.platform.request_context import (
    REQUEST_ID_HEADER,
    normalize_request_id,
    set_request_id,
)


async def request_context_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request_id = normalize_request_id(request.headers.get(REQUEST_ID_HEADER))
    # 先写入 context，再调用后续 middleware / route，保证所有日志都能关联请求。
    set_request_id(request_id)
    response = await call_next(request)
    # 响应头回传 request id，方便客户端和服务端日志互相对齐。
    response.headers[REQUEST_ID_HEADER] = request_id
    return response
