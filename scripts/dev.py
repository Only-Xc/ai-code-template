#!/usr/bin/env python3
import argparse
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COMPOSE_FILES = [
    "-f",
    "deploy/compose/compose.yml",
    "-f",
    "deploy/compose/compose.override.yml",
]
COMPOSE_ENV_FILE = ["--env-file", ".env.development"]
LOCAL_DEPENDENCY_SERVICES = ["db", "redis", "minio", "mailcatcher"]


def run(command: Sequence[str], *, cwd: Path = REPO_ROOT) -> None:
    sys.stdout.write("+ " + " ".join(command) + "\n")
    try:
        raise SystemExit(subprocess.run(command, cwd=cwd, check=False).returncode)
    except KeyboardInterrupt:
        raise SystemExit(130)


def run_step(command: Sequence[str], *, cwd: Path = REPO_ROOT) -> int:
    sys.stdout.write("+ " + " ".join(command) + "\n")
    try:
        return subprocess.run(command, cwd=cwd, check=False).returncode
    except KeyboardInterrupt:
        raise SystemExit(130)


def compose_command(*args: str) -> list[str]:
    return [
        "docker",
        "compose",
        "--project-directory",
        ".",
        *COMPOSE_ENV_FILE,
        *COMPOSE_FILES,
        *args,
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Developer task runner.")
    subcommands = parser.add_subparsers(dest="command", required=True)

    subcommands.add_parser("api", help="Run the FastAPI app locally with reload.")
    subcommands.add_parser(
        "compose-up", help="Start local dependency services with Docker Compose."
    )
    subcommands.add_parser("compose-down", help="Stop the local Docker Compose stack.")
    subcommands.add_parser(
        "compose-logs", help="Follow local dependency service logs from Docker Compose."
    )
    subcommands.add_parser("migrate", help="Run Alembic migrations for the API app.")
    subcommands.add_parser(
        "migration-current", help="Show the current Alembic revision."
    )
    subcommands.add_parser("create-superuser", help="Create or update the superuser.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "api":
        run(["uv", "run", "fastapi", "dev", "apps/api/app/main.py"])
    if args.command == "compose-up":
        run(compose_command("up", "-d", "--remove-orphans", *LOCAL_DEPENDENCY_SERVICES))
    if args.command == "compose-down":
        run(compose_command("down", "--remove-orphans"))
    if args.command == "compose-logs":
        run(compose_command("logs", "-f", *LOCAL_DEPENDENCY_SERVICES))
    if args.command == "migrate":
        run(["uv", "run", "alembic", "upgrade", "head"], cwd=REPO_ROOT / "apps/api")
    if args.command == "migration-current":
        run(["uv", "run", "alembic", "current"], cwd=REPO_ROOT / "apps/api")
    if args.command == "create-superuser":
        run(
            ["uv", "run", "python", "scripts/create_superuser.py"],
            cwd=REPO_ROOT / "apps/api",
        )


if __name__ == "__main__":
    main()
