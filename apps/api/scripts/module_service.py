#!/usr/bin/env python3
import runpy
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

if __name__ == "__main__":
    sys.path.insert(0, str(REPO_ROOT))
    runpy.run_path(str(REPO_ROOT / "scripts/module_service.py"), run_name="__main__")
