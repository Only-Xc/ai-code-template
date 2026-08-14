#!/usr/bin/env python3
import argparse
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_ENV_FILE = Path(".env.production")
COMPOSE_FILES = ["-f", "deploy/compose/compose.yml"]
COMPOSE_ENV_FILE = ["--env-file", str(PRODUCTION_ENV_FILE)]
MIGRATION_COMMAND = [
    "run",
    "--rm",
    "--no-deps",
    "backend",
    "alembic",
    "upgrade",
    "head",
]


def run(command: Sequence[str], *, cwd: Path = REPO_ROOT) -> int:
    sys.stdout.write("+ " + " ".join(command) + "\n")
    try:
        return subprocess.run(command, cwd=cwd, check=False).returncode
    except KeyboardInterrupt:
        raise SystemExit(130)


def run_or_exit(command: Sequence[str], *, cwd: Path = REPO_ROOT) -> None:
    raise SystemExit(run(command, cwd=cwd))


def compose_command(*args: str) -> list[str]:
    # 所有生产命令固定 project-directory 和 env-file，避免在子目录执行时路径漂移。
    return [
        "docker",
        "compose",
        "--project-directory",
        ".",
        *COMPOSE_ENV_FILE,
        *COMPOSE_FILES,
        *args,
    ]


def ensure_file_exists(path: Path) -> None:
    if not (REPO_ROOT / path).is_file():
        # 生产部署依赖显式 env 文件，缺失时停止，避免 Docker Compose 用空变量启动。
        sys.stderr.write(f"Missing required file: {path}\n")
        raise SystemExit(1)


def ensure_docker_available() -> None:
    result = subprocess.run(
        ["docker", "--version"],
        cwd=REPO_ROOT,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if result.returncode != 0:
        sys.stderr.write("Docker is unavailable. Install Docker Engine first.\n")
        raise SystemExit(result.returncode)


def run_deploy() -> None:
    # 部署顺序固定为 build -> migrate -> up，避免新镜像启动在旧 schema 上。
    build_exit_code = run(compose_command("build"))
    if build_exit_code != 0:
        raise SystemExit(build_exit_code)
    migrate_exit_code = run(compose_command(*MIGRATION_COMMAND))
    if migrate_exit_code != 0:
        raise SystemExit(migrate_exit_code)
    raise SystemExit(run(compose_command("up", "-d")))


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Production deployment task runner.")
    subcommands = parser.add_subparsers(dest="command", required=True)

    subcommands.add_parser("build", help="Build production Docker images.")
    subcommands.add_parser("up", help="Start or update the production stack.")
    subcommands.add_parser(
        "deploy", help="Build images and start the production stack."
    )
    subcommands.add_parser("down", help="Stop the production stack.")
    subcommands.add_parser("restart", help="Restart the backend service.")
    subcommands.add_parser("logs", help="Follow backend logs.")
    subcommands.add_parser("status", help="Show production stack status.")
    subcommands.add_parser(
        "pull", help="Update the server checkout with git pull --fast-only."
    )
    subcommands.add_parser("migrate", help="Run database migrations.")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)

    if args.command == "pull":
        run_or_exit(["git", "pull", "--fast-only"])

    ensure_file_exists(PRODUCTION_ENV_FILE)
    ensure_docker_available()

    if args.command == "build":
        run_or_exit(compose_command("build"))
    if args.command == "up":
        run_or_exit(compose_command("up", "-d"))
    if args.command == "deploy":
        run_deploy()
    if args.command == "down":
        run_or_exit(compose_command("down", "--remove-orphans"))
    if args.command == "restart":
        run_or_exit(compose_command("restart", "backend"))
    if args.command == "logs":
        run_or_exit(compose_command("logs", "-f", "backend"))
    if args.command == "status":
        run_or_exit(compose_command("ps"))
    if args.command == "migrate":
        run_or_exit(compose_command(*MIGRATION_COMMAND))


if __name__ == "__main__":
    main()
