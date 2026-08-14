#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HOST = "127.0.0.1"
DEFAULT_CONTAINER_PORT = 8000
LOCAL_DEPENDENCY_SERVICES = ["db", "redis", "minio", "mailcatcher"]
COMPOSE_FILES = [
    "-f",
    "deploy/compose/compose.yml",
    "-f",
    "deploy/compose/compose.override.yml",
]
COMPOSE_ENV_FILE = ["--env-file", ".env.development"]


@dataclass(frozen=True)
class ModuleService:
    key: str
    aliases: tuple[str, ...]
    app_file: str
    dockerfile: str
    image: str
    default_port: int


MODULE_SERVICES: dict[str, ModuleService] = {
    "auth": ModuleService(
        key="auth",
        aliases=("auth",),
        app_file="apps/api/app/module_apps/auth.py",
        dockerfile="modules/auth/Dockerfile",
        image="fast-auth-api",
        default_port=8012,
    ),
    "items": ModuleService(
        key="items",
        aliases=("items",),
        app_file="apps/api/app/module_apps/items.py",
        dockerfile="modules/items/Dockerfile",
        image="fast-items-api",
        default_port=8014,
    ),
}


def run(command: Sequence[str], *, cwd: Path = REPO_ROOT) -> int:
    sys.stdout.write("+ " + " ".join(command) + "\n")
    try:
        return subprocess.run(command, cwd=cwd, check=False).returncode
    except KeyboardInterrupt:
        raise SystemExit(130)


def run_or_exit(command: Sequence[str], *, cwd: Path = REPO_ROOT) -> None:
    raise SystemExit(run(command, cwd=cwd))


def module_choices() -> list[str]:
    choices: list[str] = []
    for service in MODULE_SERVICES.values():
        choices.extend(service.aliases)
    return sorted(choices)


def resolve_module(module_name: str) -> ModuleService:
    for service in MODULE_SERVICES.values():
        if module_name in service.aliases:
            return service
    sys.stderr.write(
        f"Unknown module: {module_name}. Available modules: "
        f"{', '.join(module_choices())}\n"
    )
    raise SystemExit(2)


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


def image_reference(
    service: ModuleService,
    *,
    tag: str,
    registry: str | None,
    image: str | None,
) -> str:
    repository = image or service.image
    if registry and image is None:
        repository = f"{registry.rstrip('/')}/{repository}"
    return f"{repository}:{tag}"


def dev_command(service: ModuleService, *, host: str, port: int | None) -> list[str]:
    return [
        "uv",
        "run",
        "fastapi",
        "dev",
        service.app_file,
        "--host",
        host,
        "--port",
        str(port or service.default_port),
    ]


def build_command(
    service: ModuleService,
    *,
    image_ref: str,
    no_cache: bool,
) -> list[str]:
    command = [
        "docker",
        "build",
        "-f",
        service.dockerfile,
        "-t",
        image_ref,
    ]
    if no_cache:
        command.append("--no-cache")
    command.append(".")
    return command


def push_command(*, image_ref: str) -> list[str]:
    return ["docker", "push", image_ref]


def docker_run_command(
    service: ModuleService,
    *,
    image_ref: str,
    env_file: str,
    host_port: int | None,
    container_port: int,
    name: str | None,
) -> list[str]:
    command = [
        "docker",
        "run",
        "--rm",
        "--env-file",
        env_file,
        "-p",
        f"{host_port or service.default_port}:{container_port}",
    ]
    if name:
        command.extend(["--name", name])
    command.append(image_ref)
    return command


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Module API service task runner.")
    subcommands = parser.add_subparsers(dest="command", required=True)

    subcommands.add_parser("list", help="List module services.")

    dev_parser = subcommands.add_parser(
        "dev", help="Run one module service locally with reload."
    )
    dev_parser.add_argument("module", choices=module_choices())
    dev_parser.add_argument("--host", default=DEFAULT_HOST)
    dev_parser.add_argument("--port", type=int, default=None)

    build_parser = subcommands.add_parser(
        "build", help="Build one module service Docker image."
    )
    add_image_args(build_parser)
    build_parser.add_argument("--no-cache", action="store_true")

    push_parser = subcommands.add_parser(
        "push", help="Push one module service Docker image."
    )
    add_image_args(push_parser)

    deploy_parser = subcommands.add_parser(
        "deploy", help="Build and push one module service Docker image."
    )
    add_image_args(deploy_parser)
    deploy_parser.add_argument("--no-cache", action="store_true")

    run_image_parser = subcommands.add_parser(
        "run-image", help="Run one built module service image locally."
    )
    add_image_args(run_image_parser)
    run_image_parser.add_argument("--env-file", default=".env.development")
    run_image_parser.add_argument("--host-port", type=int, default=None)
    run_image_parser.add_argument(
        "--container-port", type=int, default=DEFAULT_CONTAINER_PORT
    )
    run_image_parser.add_argument("--name", default=None)

    subcommands.add_parser(
        "compose-up", help="Start local dependency services with Docker Compose."
    )
    subcommands.add_parser("compose-down", help="Stop the local Docker Compose stack.")
    subcommands.add_parser("compose-logs", help="Follow local dependency service logs.")
    subcommands.add_parser("migrate-app", help="Run app-wide Alembic migrations.")
    return parser.parse_args(argv)


def add_image_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("module", choices=module_choices())
    parser.add_argument("--tag", default=os.environ.get("TAG", "latest"))
    parser.add_argument("--registry", default=None)
    parser.add_argument(
        "--image",
        default=None,
        help="Override image repository. Example: ghcr.io/acme/fast-items-api",
    )


def print_modules() -> None:
    for service in MODULE_SERVICES.values():
        sys.stdout.write(
            f"{service.key}\t{service.app_file}\t{service.dockerfile}\t"
            f"{service.image}:{os.environ.get('TAG', 'latest')}\t"
            f"port={service.default_port}\n"
        )


def image_ref_from_args(args: argparse.Namespace, service: ModuleService) -> str:
    return image_reference(
        service,
        tag=args.tag,
        registry=args.registry,
        image=args.image,
    )


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)

    if args.command == "list":
        print_modules()
        return
    if args.command == "compose-up":
        run_or_exit(
            compose_command("up", "-d", "--remove-orphans", *LOCAL_DEPENDENCY_SERVICES)
        )
    if args.command == "compose-down":
        run_or_exit(compose_command("down", "--remove-orphans"))
    if args.command == "compose-logs":
        run_or_exit(compose_command("logs", "-f", *LOCAL_DEPENDENCY_SERVICES))
    if args.command == "migrate-app":
        run_or_exit(
            ["uv", "run", "alembic", "upgrade", "head"], cwd=REPO_ROOT / "apps/api"
        )
        return

    service = resolve_module(args.module)

    if args.command == "dev":
        run_or_exit(dev_command(service, host=args.host, port=args.port))

    image_ref = image_ref_from_args(args, service)

    if args.command == "build":
        run_or_exit(build_command(service, image_ref=image_ref, no_cache=args.no_cache))
    if args.command == "push":
        run_or_exit(push_command(image_ref=image_ref))
    if args.command == "deploy":
        build_exit_code = run(
            build_command(service, image_ref=image_ref, no_cache=args.no_cache)
        )
        if build_exit_code != 0:
            raise SystemExit(build_exit_code)
        run_or_exit(push_command(image_ref=image_ref))
    if args.command == "run-image":
        run_or_exit(
            docker_run_command(
                service,
                image_ref=image_ref,
                env_file=args.env_file,
                host_port=args.host_port,
                container_port=args.container_port,
                name=args.name,
            )
        )


if __name__ == "__main__":
    main()
