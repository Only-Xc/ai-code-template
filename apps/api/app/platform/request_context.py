from contextvars import ContextVar
from uuid import uuid4

REQUEST_ID_HEADER = "X-Request-ID"
_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    # ContextVar 保证并发请求之间的 request_id 互相隔离。
    return _request_id.get()


def set_request_id(request_id: str) -> None:
    _request_id.set(request_id)


def generate_request_id() -> str:
    return str(uuid4())


def normalize_request_id(value: str | None) -> str:
    # 外部传入的 request id 只保留有限长度，避免日志字段被超长 header 污染。
    if value and value.strip():
        return value.strip()[:128]
    return generate_request_id()
