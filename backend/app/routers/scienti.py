"""Scienti (Minciencias) endpoints — coauthorship, groups, Brauer-from-Scienti."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..services import scienti as svc

router = APIRouter(prefix="/scienti", tags=["scienti"])


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, str(e))


@router.get("/overview")
def overview(cvlac_limit: int = 200, gruplac_limit: int = 100):
    return _safe(svc.overview, cvlac_limit, gruplac_limit)


@router.get("/coauthorship/summary")
def coauthorship_summary(limit: int = Query(200, ge=1, le=2000), min_articles: int = 1):
    return _safe(svc.coauthorship_summary, limit, min_articles)


@router.get("/coauthorship/graph")
def coauthorship_graph(
    limit: int = Query(80, ge=1, le=1000),
    min_articles: int = 2,
    max_nodes: int = Query(60, ge=5, le=500),
):
    return _safe(svc.coauthorship_graph, limit, min_articles, max_nodes)


@router.get("/groups/summary")
def groups_summary(limit: int = Query(100, ge=1, le=2000)):
    return _safe(svc.groups_summary, limit)


@router.get("/brauer")
def brauer_view(limit: int = Query(80, ge=1, le=1000), min_authors: int = 2):
    return _safe(svc.brauer_from_scienti, limit, min_authors)
