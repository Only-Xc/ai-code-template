from typing import Generic, TypeVar

from pydantic import BaseModel, Field

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

T = TypeVar("T")


class PaginationParams(BaseModel):
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @classmethod
    def from_skip_limit(
        cls, *, skip: int = 0, limit: int = DEFAULT_PAGE_SIZE
    ) -> "PaginationParams":
        return cls(offset=skip, limit=limit)


class Page(BaseModel, Generic[T]):
    data: list[T]
    count: int
