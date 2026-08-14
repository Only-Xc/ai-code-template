from pathlib import Path

import pytest

APP_API_TESTS = ("apps", "api", "tests")
APP_API_ROUTE_TESTS = ("apps", "api", "tests", "api")


def path_starts_with(parts: tuple[str, ...], prefix: tuple[str, ...]) -> bool:
    return parts[: len(prefix)] == prefix


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    root = Path(str(config.rootpath))
    for item in items:
        relative = Path(str(item.fspath)).relative_to(root)
        parts = relative.parts
        if path_starts_with(parts, APP_API_TESTS):
            item.add_marker(pytest.mark.integration)
            if path_starts_with(parts, APP_API_ROUTE_TESTS):
                item.add_marker(pytest.mark.api)
        elif "tests" in parts:
            item.add_marker(pytest.mark.unit)
