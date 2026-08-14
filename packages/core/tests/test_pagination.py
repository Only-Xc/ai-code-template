import pytest
from fast_core.pagination import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    Page,
    PaginationParams,
)
from pydantic import ValidationError


def test_pagination_params_defaults() -> None:
    params = PaginationParams()

    assert params.offset == 0
    assert params.limit == DEFAULT_PAGE_SIZE


def test_pagination_params_from_skip_limit() -> None:
    params = PaginationParams.from_skip_limit(skip=20, limit=10)

    assert params.offset == 20
    assert params.limit == 10


def test_pagination_params_rejects_negative_offset() -> None:
    with pytest.raises(ValidationError):
        PaginationParams(offset=-1)


def test_pagination_params_rejects_too_large_limit() -> None:
    with pytest.raises(ValidationError):
        PaginationParams(limit=MAX_PAGE_SIZE + 1)


def test_page_schema() -> None:
    page = Page[str](data=["a"], count=1)

    assert page.data == ["a"]
    assert page.count == 1
