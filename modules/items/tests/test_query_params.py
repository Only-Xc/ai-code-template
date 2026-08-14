import pytest
from fast_core.errors import BadRequestError
from fast_items.query_params import SortParam, parse_sort_param, validate_filter_field


def test_parse_sort_param_uses_default() -> None:
    default = SortParam(field="created_at", direction="desc")

    assert (
        parse_sort_param(None, allowed_fields={"created_at"}, default=default)
        == default
    )


def test_parse_sort_param_accepts_field_and_direction() -> None:
    result = parse_sort_param(
        "title:asc",
        allowed_fields={"title", "created_at"},
        default=SortParam(field="created_at", direction="desc"),
    )

    assert result == SortParam(field="title", direction="asc")


def test_parse_sort_param_rejects_unknown_field() -> None:
    with pytest.raises(BadRequestError, match="Unsupported sort field"):
        parse_sort_param(
            "owner_id:asc",
            allowed_fields={"title"},
            default=SortParam(field="title"),
        )


def test_parse_sort_param_rejects_unknown_direction() -> None:
    with pytest.raises(BadRequestError, match="Unsupported sort direction"):
        parse_sort_param(
            "title:sideways",
            allowed_fields={"title"},
            default=SortParam(field="title"),
        )


def test_validate_filter_field_rejects_unknown_field() -> None:
    with pytest.raises(BadRequestError, match="Unsupported filter field"):
        validate_filter_field("owner_id", allowed_fields={"title"})
