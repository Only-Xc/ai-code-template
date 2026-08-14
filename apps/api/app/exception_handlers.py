import logging

from fast_core.errors import AppError
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    # 业务错误只映射 AppError，保持 FastAPI 默认 validation / HTTPException 行为。
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)


async def app_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    # FastAPI handler 签名要求 Exception；这里收窄类型后再读取 AppError 字段。
    if not isinstance(exc, AppError):
        raise exc
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


async def unhandled_exception_handler(
    _request: Request, exc: Exception
) -> JSONResponse:
    # 未知异常记录完整堆栈，响应只暴露稳定的通用错误信息。
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )
