#!/usr/bin/env python3
"""Install this skill into local AI coding agents.

The script is intentionally dependency-free so it can run on macOS, Linux, and
Windows with a stock Python 3 installation.
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


SKILL_NAME = "req-maker"
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}
SKIP_FILES = {".DS_Store"}


@dataclass(frozen=True)
class Target:
    key: str
    label: str
    skills_dir: Path
    command_names: tuple[str, ...]
    marker_paths: tuple[Path, ...]

    @property
    def destination(self) -> Path:
        return self.skills_dir / SKILL_NAME


def home_dir() -> Path:
    return Path.home()


def windows_env_path(name: str, *parts: str) -> Path | None:
    value = os.environ.get(name)
    if not value:
        return None
    return Path(value, *parts)


def existing_paths(paths: tuple[Path | None, ...]) -> tuple[Path, ...]:
    return tuple(path for path in paths if path is not None)


def build_targets() -> list[Target]:
    home = home_dir()
    system = platform.system().lower()

    cursor_markers: list[Path | None] = [
        home / ".cursor",
        Path("/Applications/Cursor.app"),
        Path("/usr/share/applications/cursor.desktop"),
        Path("/opt/Cursor"),
        Path("/opt/cursor"),
        windows_env_path("LOCALAPPDATA", "Programs", "Cursor", "Cursor.exe"),
        windows_env_path("LOCALAPPDATA", "Cursor"),
    ]
    claude_markers: list[Path | None] = [
        home / ".claude",
        Path("/Applications/Claude.app"),
        windows_env_path("LOCALAPPDATA", "AnthropicClaude"),
        windows_env_path("APPDATA", "Claude"),
    ]
    codex_markers: list[Path | None] = [
        home / ".codex",
        windows_env_path("APPDATA", "Codex"),
        windows_env_path("LOCALAPPDATA", "Codex"),
    ]

    command_suffix = ".cmd" if system == "windows" else ""

    return [
        Target(
            key="cursor",
            label="Cursor",
            skills_dir=home / ".cursor" / "skills",
            command_names=(f"cursor{command_suffix}", "cursor"),
            marker_paths=existing_paths(tuple(cursor_markers)),
        ),
        Target(
            key="codex",
            label="Codex",
            skills_dir=home / ".codex" / "skills",
            command_names=(f"codex{command_suffix}", "codex"),
            marker_paths=existing_paths(tuple(codex_markers)),
        ),
        Target(
            key="claude",
            label="Claude Code",
            skills_dir=home / ".claude" / "skills",
            command_names=(f"claude{command_suffix}", "claude"),
            marker_paths=existing_paths(tuple(claude_markers)),
        ),
    ]


def command_exists(names: tuple[str, ...]) -> bool:
    return any(shutil.which(name) for name in names)


def command_runs(names: tuple[str, ...]) -> bool:
    for name in names:
        exe = shutil.which(name)
        if not exe:
            continue
        try:
            result = subprocess.run(
                [exe, "--version"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=3,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            continue
        if result.returncode == 0:
            return True
    return False


def detect_target(target: Target) -> tuple[bool, list[str]]:
    reasons: list[str] = []

    if command_exists(target.command_names):
        reasons.append("command found")
        if command_runs(target.command_names):
            reasons[-1] = "command found and responds to --version"

    existing_markers = [path for path in target.marker_paths if path.exists()]
    if existing_markers:
        reasons.append("marker exists: " + str(existing_markers[0]))

    return bool(reasons), reasons


def source_root() -> Path:
    root = Path(__file__).resolve().parent
    skill_file = root / "SKILL.md"
    if not skill_file.is_file():
        raise SystemExit(f"Cannot find SKILL.md next to installer: {skill_file}")
    return root


def should_skip(path: Path) -> bool:
    name = path.name
    return name in SKIP_DIRS or name in SKIP_FILES


def replace_existing_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.exists():
        shutil.rmtree(path)


def link_skill(src: Path, dst: Path, dry_run: bool) -> None:
    if src == dst or src in dst.parents:
        raise SystemExit(f"Refusing to install into the source tree: {dst}")

    if dst.is_symlink():
        try:
            if dst.resolve(strict=True) == src:
                return
        except FileNotFoundError:
            pass

    if dry_run:
        return

    dst.parent.mkdir(parents=True, exist_ok=True)
    replace_existing_path(dst)
    dst.symlink_to(src, target_is_directory=True)


def copy_skill(src: Path, dst: Path, dry_run: bool) -> None:
    if src == dst or src in dst.parents:
        raise SystemExit(f"Refusing to install into the source tree: {dst}")

    if dry_run:
        return

    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.parent / f".{SKILL_NAME}.tmp"

    if tmp.exists():
        shutil.rmtree(tmp)

    def ignore(directory: str, names: list[str]) -> set[str]:
        base = Path(directory)
        return {name for name in names if should_skip(base / name)}

    shutil.copytree(src, tmp, ignore=ignore)
    if dst.exists():
        shutil.rmtree(dst)
    tmp.rename(dst)


def install_skill(src: Path, dst: Path, mode: str, dry_run: bool) -> None:
    if mode == "copy":
        copy_skill(src, dst, dry_run)
        return
    link_skill(src, dst, dry_run)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Install req-maker into detected Cursor, Codex, and Claude Code skill directories.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="install to all known skill directories, even if the tool is not detected",
    )
    parser.add_argument(
        "--only",
        choices=("cursor", "codex", "claude"),
        action="append",
        help="install only to the selected tool; may be provided multiple times",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print what would be installed without writing files",
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="copy files instead of creating symlinks",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    src = source_root()
    targets = build_targets()
    mode = "copy" if args.copy else "link"

    selected = set(args.only or [])
    installed = 0
    skipped = 0

    print(f"Source skill: {src}")

    for target in targets:
        if selected and target.key not in selected:
            continue

        detected, reasons = detect_target(target)
        if not detected and not args.all:
            print(f"SKIP {target.label}: not detected")
            skipped += 1
            continue

        reason_text = ", ".join(reasons) if reasons else "--all"
        action = "WOULD INSTALL" if args.dry_run else "INSTALL"
        print(f"{action} {target.label}: {target.destination} ({mode}; {reason_text})")
        install_skill(src, target.destination, mode, args.dry_run)
        installed += 1

    if installed == 0:
        print("No targets installed. Use --all to create all known skill directories.")
        return 1 if skipped else 0

    if args.dry_run:
        print(f"Dry run complete: {installed} target(s) matched.")
    else:
        print(f"Done: installed {SKILL_NAME} to {installed} target(s) using {mode}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
