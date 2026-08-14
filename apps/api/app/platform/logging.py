import json
import logging
from datetime import UTC, datetime
from typing import Any

from app.platform.request_context import get_request_id

SENSITIVE_KEYS = ("authorization", "password", "secret", "token")
BUILTIN_LOG_RECORD_FIELDS = {
    "args",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "taskName",
    "thread",
    "threadName",
}


def redact_value(key: str, value: Any) -> Any:
    # 按字段名脱敏，避免配置、token 或密码通过 extra 日志泄露。
    if any(sensitive in key.lower() for sensitive in SENSITIVE_KEYS):
        return "***"
    return value


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": get_request_id(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        # logging 的 extra 字段会落到 LogRecord.__dict__，需要排除内置字段后合并。
        for key, value in record.__dict__.items():
            if key in BUILTIN_LOG_RECORD_FIELDS or key.startswith("_"):
                continue
            payload[key] = value
        return json.dumps(
            {key: redact_value(key, value) for key, value in payload.items()},
            default=str,
        )


def configure_json_logging(level: int = logging.INFO) -> None:
    # 统一替换 root handler，保证应用日志和依赖库日志都输出同一 JSON 结构。
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(level)
