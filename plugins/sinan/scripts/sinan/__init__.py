"""Python-first Sinan core."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VENDOR = Path(__file__).resolve().parent / "_vendor"

if VENDOR.exists():
    vendor_text = str(VENDOR)
    if vendor_text not in sys.path:
        sys.path.insert(0, vendor_text)

__all__ = ["ROOT", "VENDOR"]
