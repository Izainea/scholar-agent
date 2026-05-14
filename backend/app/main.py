"""Scholar Agent FastAPI application."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
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

app.include_router(authors.router)
app.include_router(brauer.router)
app.include_router(agent.router)
app.include_router(scienti.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "anthropic_configured": bool(config.ANTHROPIC_API_KEY),
        "scienti_data_available": (config.SCIENTI_DATA_DIR / "cvlac").exists(),
        "data_dir": str(config.DATA_DIR),
    }
