"""Scholar Agent FastAPI application."""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .auth import require_basic_auth
from .routers import agent, authors, brauer, scienti

app = FastAPI(
    title="Scholar Agent API",
    description="Brauer configuration analysis + Scienti citation network insights",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routers below sit behind HTTP Basic auth. /health and the docs
# stay open (see auth._is_public).
_auth = [Depends(require_basic_auth)]

app.include_router(authors.router, dependencies=_auth)
app.include_router(brauer.router, dependencies=_auth)
app.include_router(agent.router, dependencies=_auth)
app.include_router(scienti.router, dependencies=_auth)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "anthropic_configured": bool(config.ANTHROPIC_API_KEY),
        "scienti_data_available": (config.SCIENTI_DATA_DIR / "cvlac").exists(),
        "data_dir": str(config.DATA_DIR),
        "auth_enabled": config.AUTH_ENABLED,
    }
