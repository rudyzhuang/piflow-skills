#!/usr/bin/env python3
"""Compatibility wrapper for the repository-level Node.js installer."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    skill_dir = Path(__file__).resolve().parent
    installer = skill_dir.parent.parent / "install.mjs"
    result = subprocess.run(
        ["node", str(installer), skill_dir.name, *sys.argv[1:]],
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
