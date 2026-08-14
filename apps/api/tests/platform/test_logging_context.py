import json
import logging
import sys
from contextvars import copy_context

from app.platform.logging import JsonLogFormatter, redact_value
from app.platform.request_context import (
    get_request_id,
    normalize_request_id,
    set_request_id,
)


def test_request_id_context_roundtrip() -> None:
    set_request_id("req-1")
    assert get_request_id() == "req-1"


def test_normalize_request_id_generates_when_missing() -> None:
    assert normalize_request_id(None)


def test_redact_sensitive_value() -> None:
    assert redact_value("authorization", "secret") == "***"
    assert redact_value("message", "ok") == "ok"


def test_json_log_formatter_includes_request_id() -> None:
    set_request_id("req-2")
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello",
        args=(),
        exc_info=None,
    )

    payload = json.loads(JsonLogFormatter().format(record))

    assert payload["message"] == "hello"
    assert payload["request_id"] == "req-2"


def test_json_log_formatter_includes_and_redacts_extra_fields() -> None:
    record = logging.getLogger("test").makeRecord(
        name="test",
        level=logging.WARNING,
        fn=__file__,
        lno=1,
        msg="cache failed",
        args=(),
        exc_info=None,
        extra={
            "operation": "get",
            "namespace": "auth",
            "refresh_token": "secret-token",
        },
    )

    payload = json.loads(JsonLogFormatter().format(record))

    assert payload["operation"] == "get"
    assert payload["namespace"] == "auth"
    assert payload["refresh_token"] == "***"


def test_request_id_context_does_not_leak_between_contexts() -> None:
    first = copy_context()
    second = copy_context()

    first.run(set_request_id, "request-a")
    second.run(set_request_id, "request-b")

    assert first.run(get_request_id) == "request-a"
    assert second.run(get_request_id) == "request-b"


def test_json_log_formatter_includes_exception_stack() -> None:
    formatter = JsonLogFormatter()
    try:
        raise RuntimeError("boom")
    except RuntimeError:
        record = logging.getLogger("test").makeRecord(
            name="test",
            level=logging.ERROR,
            fn=__file__,
            lno=1,
            msg="failed",
            args=(),
            exc_info=sys.exc_info(),
        )

    payload = json.loads(formatter.format(record))

    assert "RuntimeError: boom" in payload["exc_info"]
