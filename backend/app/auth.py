"""HTTP Basic authentication for the Scholar Agent API.

A single shared credential (APP_USER / APP_PASSWORD) gates the whole
API. /health and the OpenAPI docs stay open so deploy platforms can
probe liveness and contributors can browse the schema.

Auth is disabled (no-op) when either env var is empty — handy in local
development.
"""

from __future__ import annotations

import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from . import config

_security = HTTPBasic(auto_error=False)

# Endpoints that must remain reachable without credentials.
_PUBLIC_PATHS: frozenset[str] = frozenset({
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/docs/oauth2-redirect",
})


def _is_public(path: str) -> bool:
    if path in _PUBLIC_PATHS:
        return True
    # OpenAPI ships its assets under /docs/, accept that too.
    return path.startswith("/docs/")


async def require_basic_auth(
    request: Request,
    credentials: HTTPBasicCredentials | None = Depends(_security),
) -> None:
    """FastAPI dependency that enforces HTTP Basic on protected paths."""
    if not config.AUTH_ENABLED:
        return  # auth disabled (local dev / no credentials configured)

    if _is_public(request.url.path):
        return

    # CORS preflight requests carry no Authorization header; let them pass.
    if request.method == "OPTIONS":
        return

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Basic"},
        )

    user_ok = secrets.compare_digest(credentials.username, config.APP_USER)
    pass_ok = secrets.compare_digest(credentials.password, config.APP_PASSWORD)
    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
