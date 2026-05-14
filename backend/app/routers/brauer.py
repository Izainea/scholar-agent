"""Brauer analysis endpoints — summary, top papers, comparisons, raw data."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..services import brauer as svc

router = APIRouter(prefix="/brauer", tags=["brauer"])


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, str(e))


@router.get("/{key}/summary")
def get_summary(key: str):
    return _safe(svc.summary, key)


@router.get("/{key}/top-papers")
def top_papers(key: str, n: int = Query(5, ge=1, le=50)):
    return _safe(svc.top_papers_by_delta, key, n)


@router.get("/{key}/top-references")
def top_references(key: str, n: int = Query(10, ge=1, le=50)):
    return _safe(svc.top_references_by_valency, key, n)


@router.get("/{key}/entropy")
def entropy(key: str):
    return _safe(svc.entropy_decomposition, key)


@router.get("/{key}/search")
def search_refs(key: str, q: str = Query(..., min_length=2)):
    return _safe(svc.search_references, key, q)


@router.get("/compare")
def compare(keys: list[str] = Query(..., min_length=2)):
    return _safe(svc.compare, keys)


# ── Raw data for client-side rendering (Cytoscape + Recharts) ──

@router.get("/{key}/quiver")
def quiver(key: str, max_nodes: int = Query(200, ge=10, le=2000)):
    return _safe(svc.quiver_data, key, max_nodes)


@router.get("/{key}/valency")
def valency(key: str):
    return _safe(svc.valency_data, key)


@router.get("/{key}/polygon-contributions")
def polygon_contributions(key: str):
    return _safe(svc.polygon_contribution_data, key)


@router.get("/{key}/weights")
def weights(key: str, top_n: int = Query(40, ge=5, le=200)):
    return _safe(svc.weight_data, key, top_n)


@router.get("/radar")
def radar(keys: list[str] = Query(..., min_length=2)):
    return _safe(svc.comparison_radar_data, keys)
