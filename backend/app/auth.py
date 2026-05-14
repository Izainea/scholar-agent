"""HTTP Basic authentication for the Scholar Agent API.

A small dictionary of shared users (APP_USERS) gates the whole API.
/health and the OpenAPI docs stay open so deploy platforms can probe
liveness and contributors can browse the schema.

Auth is disabled (no-op) when APP_USERS is empty — handy in local
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

    expected_password = config.APP_USERS.get(credentials.username)
    if expected_password is None or not secrets.compare_digest(
        credentials.password, expected_password
    ):
        # Always do a constant-time comparison so an attacker can't tell
        # "unknown user" from "wrong password" via timing.
        secrets.compare_digest(credentials.password, "")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
