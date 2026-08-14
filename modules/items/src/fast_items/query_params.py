from typing import Literal

from fast_core.errors import BadRequestError
from pydantic import BaseModel

SortDirection = Literal["asc", "desc"]


class SortParam(BaseModel):
    field: str
    direction: SortDirection = "asc"


def parse_sort_param(
    sort: str | None,
    *,
    allowed_fields: set[str],
    default: SortParam,
) -> SortParam:
    if not sort:
        return default

    field, separator, direction = sort.partition(":")
    if not field or field not in allowed_fields:
        raise BadRequestError(f"Unsupported sort field: {field}")
    if not separator:
        return SortParam(field=field, direction="asc")
    if direction not in ("asc", "desc"):
        raise BadRequestError(f"Unsupported sort direction: {direction}")
    return SortParam(field=field, direction=direction)


def validate_filter_field(field: str, *, allowed_fields: set[str]) -> str:
    if field not in allowed_fields:
        raise BadRequestError(f"Unsupported filter field: {field}")
    return field
