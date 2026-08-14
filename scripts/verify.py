#!/usr/bin/env python3
import argparse
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCOPE = "apps modules packages"
COMPOSE_FILES = [
    "-f",
    "deploy/compose/compose.yml",
    "-f",
    "deploy/compose/compose.override.yml",
]
COMPOSE_ENV_FILE = ["--env-file", ".env.development"]


def run_step(name: str, command: Sequence[str]) -> None:
    # 所有检查走同一个执行包装，失败时立即保留原始退出码返回给 CI。
    sys.stdout.write(f"\n==> {name}\n")
    sys.stdout.write("+ " + " ".join(command) + "\n")
    try:
        result = subprocess.run(command, cwd=REPO_ROOT, check=False)
    except KeyboardInterrupt:
        raise SystemExit(130)
    if result.returncode != 0:
        sys.stderr.write(f"FAILED: {name} exited with {result.returncode}\n")
        raise SystemExit(result.returncode)


def uv_command(*args: str) -> list[str]:
    return ["uv", "run", *args]


def split_scope(scope: str) -> list[str]:
    return [part for part in scope.split() if part]


def related_test_paths(paths: Sequence[str]) -> list[str]:
    # fast 模式只跑与 scope 相关的测试，保持本地反馈速度。
    tests: list[str] = []
    for path in paths:
        if path == "modules":
            tests.extend(
                [
                    "modules/auth/tests",
                    "modules/items/tests",
                    "apps/api/tests/api/routes/test_login.py",
                    "apps/api/tests/api/routes/test_users.py",
                    "apps/api/tests/api/routes/test_items.py",
                ]
            )
        elif path == "packages":
            tests.append("packages/core/tests")
        elif path == "apps":
            tests.append("apps/api/tests")
        elif path.startswith("modules/auth"):
            tests.extend(
                [
                    "modules/auth/tests",
                    "apps/api/tests/api/routes/test_login.py",
                    "apps/api/tests/api/routes/test_users.py",
                ]
            )
        elif path.startswith("modules/items"):
            tests.append("apps/api/tests/api/routes/test_items.py")
        elif path.startswith("packages/core"):
            tests.append("packages/core/tests")
        elif path.startswith("apps/api"):
            tests.append("apps/api/tests")
    return sorted(set(tests))


def run_fast(scope: str) -> None:
    paths = split_scope(scope)
    run_step("ruff format check", uv_command("ruff", "format", "--check", *paths))
    run_step("ruff lint", uv_command("ruff", "check", *paths))
    run_step("import-linter", uv_command("lint-imports"))
    test_paths = related_test_paths(paths)
    if test_paths:
        run_step(
            "pytest",
            uv_command("pytest", *test_paths, "-m", "not slow", "-q"),
        )


def run_migration_check() -> None:
    # 用 SQLite 生成 metadata diff，快速发现 model registry 或 migration 漏同步。
    script = """
import app.model_registry
from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from sqlalchemy import create_engine
from sqlmodel import SQLModel
engine = create_engine('sqlite://')
SQLModel.metadata.create_all(engine)
with engine.connect() as connection:
    diff = compare_metadata(MigrationContext.configure(connection), SQLModel.metadata)
print(diff)
raise SystemExit(0 if diff == [] else 1)
""".strip()
    run_step("migration metadata check", uv_command("python", "-c", script))


def run_docker_build() -> None:
    run_step(
        "docker build backend",
        [
            "docker",
            "compose",
            "--project-directory",
            ".",
            *COMPOSE_ENV_FILE,
            *COMPOSE_FILES,
            "build",
            "backend",
        ],
    )


def run_full(scope: str) -> None:
    run_fast(scope)
    paths = split_scope(scope)
    run_step("pyright", uv_command("pyright", *paths))
    run_step("import-linter", uv_command("lint-imports"))
    run_migration_check()
    run_docker_build()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run repository verification checks.")
    parser.add_argument(
        "--scope", default=DEFAULT_SCOPE, help="Space separated paths to check."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--fast", action="store_true", help="Run fast local checks.")
    mode.add_argument(
        "--full", action="store_true", help="Run full checks including Docker build."
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.full:
        run_full(args.scope)
    else:
        run_fast(args.scope)


if __name__ == "__main__":
    main()
