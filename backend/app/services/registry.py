"""Persistent author registry — backed by registry.json in DATA_DIR."""

from __future__ import annotations

import json
from threading import Lock

from .. import config

_LOCK = Lock()


def _load_from_disk() -> dict[str, dict]:
    if config.REGISTRY_PATH.exists():
        try:
            with open(config.REGISTRY_PATH, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    # Seed with defaults on first launch
    save(dict(config._DEFAULT_REGISTRY))
    return dict(config._DEFAULT_REGISTRY)


def all() -> dict[str, dict]:  # noqa: A001 — clear name in this module
    return _load_from_disk()


def get(key: str) -> dict | None:
    return _load_from_disk().get(key)


def keys() -> list[str]:
    return sorted(_load_from_disk().keys())


def save(registry: dict[str, dict]) -> None:
    with _LOCK:
        config.REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(config.REGISTRY_PATH, "w", encoding="utf-8") as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)


def upsert(key: str, openalex_id: str, display_name: str, area: str = "") -> dict:
    reg = _load_from_disk()
    reg[key] = {
        "openalex_id": openalex_id,
        "display_name": display_name,
        "area": area,
    }
    save(reg)
    return reg[key]


def remove(key: str) -> bool:
    reg = _load_from_disk()
    if key in reg:
        del reg[key]
        save(reg)
        return True
    return False
