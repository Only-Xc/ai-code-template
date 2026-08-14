class AppError(Exception):
    """应用业务错误基类，由应用层 exception handler 映射为 HTTP 响应。"""

    status_code = 500
    default_detail = "Internal Server Error"

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


class BadRequestError(AppError):
    status_code = 400
    default_detail = "Bad Request"


class UnauthorizedError(AppError):
    status_code = 401
    default_detail = "Unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    default_detail = "Forbidden"


class NotFoundError(AppError):
    status_code = 404
    default_detail = "Not Found"


class ConflictError(AppError):
    status_code = 409
    default_detail = "Conflict"
