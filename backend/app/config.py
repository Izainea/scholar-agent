"""Configuration: paths, API keys, author registry."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# ── Paths ────────────────────────────────────────────────
BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent.parent

# In-container defaults (overridable by env). The repo-relative paths are
# kept as fallbacks so the backend also runs straight from a checkout.
DATA_DIR = Path(os.getenv("SCHOLAR_DATA_DIR", BACKEND_ROOT / "data")).resolve()

# Scienti data is huge (4+ GB for the full Minciencias scrape) so it is
# NOT shipped in the repo. We default to the small sample bundled in
# `scholar_agent_app/scienti_sample/` (100 CvLAC + 50 GrupLAC) so the
# /scienti endpoints work out of the box. Set SCIENTI_DATA_DIR to point
# at the full scrape locally or via a mounted volume in production.
_SAMPLE_SCIENTI = PROJECT_ROOT / "scholar_agent_app" / "scienti_sample"
_FULL_SCIENTI = PROJECT_ROOT / "scraper_scienti" / "data"

if os.getenv("SCIENTI_DATA_DIR"):
    SCIENTI_DATA_DIR = Path(os.environ["SCIENTI_DATA_DIR"]).resolve()
elif _FULL_SCIENTI.exists():
    SCIENTI_DATA_DIR = _FULL_SCIENTI.resolve()
else:
    SCIENTI_DATA_DIR = _SAMPLE_SCIENTI.resolve()

DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Load .env from project root if present ───────────────
load_dotenv(PROJECT_ROOT / ".env")

ANTHROPIC_API_KEY = (
    os.getenv("ANTHROPIC_API_KEY")
    or os.getenv("claude_api")
    or ""
)

# ── Anthropic ────────────────────────────────────────────
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5")

# ── App auth (HTTP Basic) ────────────────────────────────
# A single shared credential gates the API. Leave both empty to
# disable auth (useful in local dev). In Railway, set APP_USER and
# APP_PASSWORD as service variables.
APP_USER = os.getenv("APP_USER", "")
APP_PASSWORD = os.getenv("APP_PASSWORD", "")
AUTH_ENABLED = bool(APP_USER and APP_PASSWORD)

# ── OpenAlex polite pool ─────────────────────────────────
OPENALEX_EMAIL = os.getenv("OPENALEX_EMAIL", "scholar-agent@example.org")

# ── CORS ─────────────────────────────────────────────────
def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173,http://localhost:8080")
    return [o.strip() for o in raw.split(",") if o.strip()]


CORS_ORIGINS = _cors_origins()


# ── Author registry: persisted to JSON so it survives restarts ──
REGISTRY_PATH = DATA_DIR / "registry.json"


_DEFAULT_REGISTRY: dict[str, dict] = {
    "ringel": {
        "openalex_id": "https://openalex.org/A5070631310",
        "display_name": "Claus Michael Ringel",
        "area": "Representation theory of algebras, tilting theory, tame/wild dichotomy",
    },
    "grothendieck": {
        "openalex_id": "https://openalex.org/A5110598678",
        "display_name": "Alexander Grothendieck",
        "area": "Algebraic geometry, homological algebra, topos theory, schemes",
    },
    "schroll": {
        "openalex_id": "https://openalex.org/A5028168552",
        "display_name": "Sibylle Schroll",
        "area": "Brauer graph/configuration algebras, gentle algebras, string algebras",
    },
    "green": {
        "openalex_id": "https://openalex.org/A5039389549",
        "display_name": "Edward L. Green",
        "area": "Path algebras, Gröbner bases, bound quiver algebras, Brauer algebras",
    },
    "todorov": {
        "openalex_id": "https://openalex.org/A5049818882",
        "display_name": "Gordana Todorov",
        "area": "Auslander-Reiten theory, cluster algebras, tilting theory",
    },
    "auslander": {
        "openalex_id": "https://openalex.org/A5062401066",
        "display_name": "Maurice Auslander",
        "area": "Representation theory, almost split sequences, Auslander algebras",
    },
    "reiten": {
        "openalex_id": "https://openalex.org/A5014286771",
        "display_name": "Idun Reiten",
        "area": "Auslander-Reiten theory, cluster categories, tilting theory",
    },
    "gutman": {
        "openalex_id": "https://openalex.org/A5012870440",
        "display_name": "Ivan Gutman",
        "area": "Graph energy, chemical graph theory, spectral graph theory",
    },
    "keller": {
        "openalex_id": "https://openalex.org/A5070207567",
        "display_name": "Bernhard Keller",
        "area": "Cluster algebras, derived categories, dg-categories",
    },
}


def dataset_path(author_key: str) -> Path:
    return DATA_DIR / f"{author_key}.json"


def raw_data_path(author_key: str) -> Path:
    return DATA_DIR / f"{author_key}_raw.json"
