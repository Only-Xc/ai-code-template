from typing import Any

COMMON_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: {"description": "Bad Request"},
    401: {"description": "Unauthorized"},
    403: {"description": "Forbidden"},
    404: {"description": "Not Found"},
    409: {"description": "Conflict"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}


def merge_common_error_responses(
    responses: dict[int | str, dict[str, Any]] | None = None,
) -> dict[int | str, dict[str, Any]]:
    merged = dict(COMMON_ERROR_RESPONSES)
    if responses:
        merged.update(responses)
    return merged
