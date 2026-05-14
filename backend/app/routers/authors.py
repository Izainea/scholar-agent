"""Author registry + OpenAlex search/collect endpoints."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from ..services import brauer, collector, registry

router = APIRouter(prefix="/authors", tags=["authors"])

# Background pipeline runner — single worker, FIFO so we don't hammer OpenAlex.
_executor = ThreadPoolExecutor(max_workers=1)
_jobs: dict[str, dict] = {}  # author_key -> {"status": ..., "error": ...}


class AuthorOut(BaseModel):
    key: str
    openalex_id: str = ""
    display_name: str
    area: str = ""
    n_papers: int
    n_references: int


class RegisterIn(BaseModel):
    key: str = Field(..., description="Short identifier (lowercase, no spaces)")
    openalex_id: str
    display_name: str
    area: str = ""


class JobStatus(BaseModel):
    author_key: str
    status: str
    error: str | None = None


@router.get("", response_model=list[AuthorOut])
def list_authors():
    return brauer.list_available()


@router.get("/registry")
def get_registry():
    return registry.all()


@router.post("/registry", response_model=JobStatus, status_code=201)
def register_and_collect(payload: RegisterIn, background: BackgroundTasks):
    """Register an author and kick off the OpenAlex collection in the background."""
    info = registry.upsert(
        payload.key, payload.openalex_id, payload.display_name, payload.area
    )
    _jobs[payload.key] = {"status": "queued", "error": None}

    def _run():
        _jobs[payload.key]["status"] = "collecting"
        try:
            collector.collect_and_preprocess(payload.key, force=True, author_info=info)
            brauer.invalidate_cache(payload.key)
            _jobs[payload.key]["status"] = "done"
        except Exception as e:
            _jobs[payload.key] = {"status": "error", "error": str(e)}

    background.add_task(_executor.submit, _run)
    return JobStatus(author_key=payload.key, status="queued")


@router.delete("/registry/{key}")
def remove_author(key: str):
    if not registry.remove(key):
        raise HTTPException(404, f"Author '{key}' not in registry")
    brauer.invalidate_cache(key)
    return {"removed": key}


@router.get("/jobs/{key}", response_model=JobStatus)
def job_status(key: str):
    job = _jobs.get(key, {"status": "unknown", "error": None})
    return JobStatus(author_key=key, status=job["status"], error=job.get("error"))


@router.get("/openalex/search")
def openalex_search(q: str = Query(..., min_length=2), limit: int = 15):
    try:
        return collector.search_authors(q, max_results=limit)
    except Exception as e:
        raise HTTPException(502, f"OpenAlex search failed: {e}")
