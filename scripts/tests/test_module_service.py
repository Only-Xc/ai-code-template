from pathlib import Path

import pytest

from scripts import module_service


def test_resolve_module_resolves_known_modules() -> None:
    auth = module_service.resolve_module("auth")
    items = module_service.resolve_module("items")

    assert auth.key == "auth"
    assert auth.app_file == "apps/api/app/module_apps/auth.py"
    assert items.key == "items"
    assert items.app_file == "apps/api/app/module_apps/items.py"


def test_parse_args_accepts_dev_module() -> None:
    args = module_service.parse_args(["dev", "items", "--port", "8020"])

    assert args.command == "dev"
    assert args.module == "items"
    assert args.port == 8020


def test_dev_command_uses_module_entrypoint_and_default_port() -> None:
    service = module_service.resolve_module("items")

    assert module_service.dev_command(service, host="127.0.0.1", port=None) == [
        "uv",
        "run",
        "fastapi",
        "dev",
        "apps/api/app/module_apps/items.py",
        "--host",
        "127.0.0.1",
        "--port",
        "8014",
    ]


def test_build_command_uses_module_dockerfile() -> None:
    service = module_service.resolve_module("items")

    assert module_service.build_command(
        service,
        image_ref="fast-items-api:test",
        no_cache=True,
    ) == [
        "docker",
        "build",
        "-f",
        "modules/items/Dockerfile",
        "-t",
        "fast-items-api:test",
        "--no-cache",
        ".",
    ]


def test_image_reference_supports_registry() -> None:
    service = module_service.resolve_module("auth")

    assert (
        module_service.image_reference(
            service,
            tag="v1",
            registry="registry.example.com/platform",
            image=None,
        )
        == "registry.example.com/platform/fast-auth-api:v1"
    )


def test_image_override_takes_precedence_over_registry() -> None:
    service = module_service.resolve_module("items")

    assert (
        module_service.image_reference(
            service,
            tag="v1",
            registry="registry.example.com/platform",
            image="custom/fast-items",
        )
        == "custom/fast-items:v1"
    )


def test_docker_run_command_uses_default_module_port() -> None:
    service = module_service.resolve_module("auth")

    assert module_service.docker_run_command(
        service,
        image_ref="fast-auth-api:test",
        env_file=".env.development",
        host_port=None,
        container_port=8000,
        name="auth-api",
    ) == [
        "docker",
        "run",
        "--rm",
        "--env-file",
        ".env.development",
        "-p",
        "8012:8000",
        "--name",
        "auth-api",
        "fast-auth-api:test",
    ]


def test_compose_command_matches_development_stack() -> None:
    assert module_service.compose_command("up", "-d", "db") == [
        "docker",
        "compose",
        "--project-directory",
        ".",
        "--env-file",
        ".env.development",
        "-f",
        "deploy/compose/compose.yml",
        "-f",
        "deploy/compose/compose.override.yml",
        "up",
        "-d",
        "db",
    ]


def test_resolve_module_fails_for_unknown_module() -> None:
    with pytest.raises(SystemExit) as exc_info:
        module_service.resolve_module("missing")

    assert exc_info.value.code == 2


def test_migrate_app_command_runs_in_api_app(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[list[str], Path]] = []

    def fake_run_or_exit(
        command: list[str], *, cwd: Path = module_service.REPO_ROOT
    ) -> None:
        calls.append((command, cwd))

    monkeypatch.setattr(module_service, "run_or_exit", fake_run_or_exit)

    module_service.main(["migrate-app"])

    assert calls == [
        (
            ["uv", "run", "alembic", "upgrade", "head"],
            module_service.REPO_ROOT / "apps/api",
        )
    ]
