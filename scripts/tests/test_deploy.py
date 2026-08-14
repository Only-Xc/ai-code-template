from pathlib import Path

import pytest

from scripts import deploy


def test_compose_command_uses_production_env_file() -> None:
    assert deploy.compose_command("up", "-d") == [
        "docker",
        "compose",
        "--project-directory",
        ".",
        "--env-file",
        ".env.production",
        "-f",
        "deploy/compose/compose.yml",
        "up",
        "-d",
    ]


def test_parse_args_accepts_deploy_command() -> None:
    args = deploy.parse_args(["deploy"])

    assert args.command == "deploy"


def test_migration_command_runs_backend_image() -> None:
    assert deploy.compose_command(*deploy.MIGRATION_COMMAND) == [
        "docker",
        "compose",
        "--project-directory",
        ".",
        "--env-file",
        ".env.production",
        "-f",
        "deploy/compose/compose.yml",
        "run",
        "--rm",
        "--no-deps",
        "backend",
        "alembic",
        "upgrade",
        "head",
    ]


def test_ensure_file_exists_fails_for_missing_file() -> None:
    with pytest.raises(SystemExit) as exc_info:
        deploy.ensure_file_exists(Path(".missing-production-env"))

    assert exc_info.value.code == 1
