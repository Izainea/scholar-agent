"""Test configuration: isolated DATA_DIR for the duration of the suite."""

from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

import pytest

# Make sure the backend package is importable
HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
sys.path.insert(0, str(BACKEND))


@pytest.fixture(scope="session", autouse=True)
def isolated_data_dir(tmp_path_factory):
    """Point SCHOLAR_DATA_DIR at a temp dir, seeded with the smallest dataset.

    We use the existing `green.json` and `green_raw.json` if available because
    Green's dataset is small and gives a meaningful Brauer config to test against.
    """
    tmp = tmp_path_factory.mktemp("scholar_data")
    real_data = BACKEND / "data"
    if real_data.exists():
        for fname in ("green.json", "green_raw.json", "schroll.json", "schroll_raw.json"):
            src = real_data / fname
            if src.exists():
                shutil.copy(src, tmp / fname)
    os.environ["SCHOLAR_DATA_DIR"] = str(tmp)

    # Force reload of config now that env var is set
    if "app.config" in sys.modules:
        import importlib

        from app import config as cfg_mod

        importlib.reload(cfg_mod)
        for mod in list(sys.modules):
            if mod.startswith("app.") and mod != "app.config":
                importlib.reload(sys.modules[mod])

    yield tmp


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)
