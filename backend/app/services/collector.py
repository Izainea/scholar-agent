"""OpenAlex collector + preprocessor for the Brauer pipeline.

Combines the original `collector.py` and `preprocessor.py` of the Streamlit
version, adapted to write into the new DATA_DIR.
"""

from __future__ import annotations

import json
import re
import time

import httpx
import pyalex
from pyalex import Authors

from .. import config
from . import registry

pyalex.config.email = config.OPENALEX_EMAIL


# ── OpenAlex search & fetch ──────────────────────────────

def search_authors(name: str, max_results: int = 15) -> list[dict]:
    """Top OpenAlex matches for an author name.

    Returns more results by default (15 instead of 5) because a query
    like "Ringel" matches dozens of homonyms and the mathematician of
    interest is rarely in the top 5 (OpenAlex ranks by citation
    volume, which favours medical authors).
    """
    results = Authors().search_filter(display_name=name).get(per_page=max(max_results, 25))
    out = []
    for r in (results or [])[:max_results]:
        institutions = r.get("last_known_institutions") or []
        last_inst = institutions[0].get("display_name", "") if institutions else ""
        # Top OpenAlex concept (when available) helps users disambiguate
        # mathematicians vs. medics vs. CS folk with the same surname.
        top_concept = ""
        for c in r.get("x_concepts") or r.get("topics") or []:
            top_concept = c.get("display_name") or c.get("name") or ""
            if top_concept:
                break
        out.append({
            "id": r["id"],
            "display_name": r["display_name"],
            "works_count": r.get("works_count", 0),
            "cited_by_count": r.get("cited_by_count", 0),
            "institution": last_inst,
            "top_concept": top_concept,
        })
    return out


def fetch_author_works(openalex_author_id: str, max_works: int = 1000) -> list[dict]:
    works: list[dict] = []
    cursor = "*"
    per_page = 200
    while True:
        url = (
            f"https://api.openalex.org/works"
            f"?filter=author.id:{openalex_author_id}"
            f"&select=id,title,publication_year,authorships,referenced_works,doi,primary_location,type"
            f"&per-page={per_page}&cursor={cursor}&mailto={config.OPENALEX_EMAIL}"
        )
        resp = httpx.get(url, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if not results:
            break
        works.extend(results)
        if len(works) >= max_works:
            return works[:max_works]
        cursor = data.get("meta", {}).get("next_cursor")
        if not cursor:
            break
        time.sleep(0.1)
    return works


def fetch_reference_metadata(work_ids: list[str], batch_size: int = 50) -> dict[str, dict]:
    metadata: dict[str, dict] = {}
    unique = list(set(work_ids))
    for i in range(0, len(unique), batch_size):
        batch = unique[i:i + batch_size]
        url = (
            f"https://api.openalex.org/works"
            f"?filter=openalex:{'|'.join(batch)}"
            f"&select=id,title,publication_year,authorships,doi,primary_location"
            f"&per-page={batch_size}&mailto={config.OPENALEX_EMAIL}"
        )
        resp = httpx.get(url, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        for work in data.get("results", []):
            wid = work["id"]
            authors_list = [
                (a.get("author") or {}).get("display_name", "Unknown")
                for a in (work.get("authorships") or [])[:5]
            ]
            loc = work.get("primary_location") or {}
            source = loc.get("source") or {}
            metadata[wid] = {
                "title": work.get("title", ""),
                "authors": authors_list,
                "year": work.get("publication_year"),
                "journal": source.get("display_name", ""),
                "doi": work.get("doi", ""),
            }
        time.sleep(0.1)
    return metadata


# ── Pipeline ─────────────────────────────────────────────

def collect(author_key: str, force: bool = False, author_info: dict | None = None) -> dict:
    """Download raw OpenAlex data for one author. Caches to <key>_raw.json."""
    cache = config.raw_data_path(author_key)
    if cache.exists() and not force:
        with open(cache, encoding="utf-8") as f:
            return json.load(f)

    info = author_info or registry.get(author_key)
    if not info:
        raise KeyError(f"Author '{author_key}' is not in the registry")

    works = fetch_author_works(info["openalex_id"])
    all_refs = [r for w in works for r in (w.get("referenced_works") or [])]
    ref_meta = fetch_reference_metadata(all_refs)

    raw = {
        "author_key": author_key,
        "author_info": info,
        "works": works,
        "reference_metadata": ref_meta,
    }
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=2, default=str)
    return raw


# ── Preprocessing (raw OpenAlex → aiq-compatible citation JSON) ──

def _short_id(url: str) -> str:
    return (url or "").rsplit("/", 1)[-1]


def _extract_authors(authorships: list[dict], max_authors: int = 5) -> list[str]:
    return [
        (a.get("author") or {}).get("display_name", "Unknown")
        for a in (authorships or [])[:max_authors]
    ]


_SKIP_WORDS = {"a", "an", "the", "on", "of", "for", "in", "to", "and", "with", "some", "new"}


def _slug(work: dict) -> str:
    authors = _extract_authors(work.get("authorships") or [], max_authors=1)
    last = (authors[0] if authors else "unknown").split()[-1].lower()
    last = re.sub(r"[^a-z]", "", last)
    year = work.get("publication_year") or 0
    title_words = re.findall(r"[a-z]+", (work.get("title") or "untitled").lower())
    first = next((w for w in title_words if w not in _SKIP_WORDS and len(w) > 2), "untitled")
    return f"{last}_{year}_{first}_{_short_id(work.get('id', ''))}"


def preprocess(author_key: str, force: bool = False, author_info: dict | None = None) -> dict:
    """Transform raw OpenAlex JSON into aiq citation-network format."""
    out_path = config.dataset_path(author_key)
    if out_path.exists() and not force:
        with open(out_path, encoding="utf-8") as f:
            return json.load(f)

    raw_path = config.raw_data_path(author_key)
    if not raw_path.exists():
        raise FileNotFoundError(f"Raw data missing for '{author_key}' — run collect() first")

    with open(raw_path, encoding="utf-8") as f:
        raw = json.load(f)

    info = author_info or registry.get(author_key) or {"display_name": author_key, "area": ""}
    works = raw["works"]
    ref_meta = raw.get("reference_metadata", {})

    reference_pool: dict[str, dict] = {}
    papers: list[dict] = []
    stats = {"total_works": len(works), "dropped_no_refs": 0, "dropped_few_refs": 0}

    for work in works:
        raw_refs = work.get("referenced_works") or []
        if not raw_refs:
            stats["dropped_no_refs"] += 1
            continue
        ref_ids = [_short_id(r) for r in raw_refs]
        if len(set(ref_ids)) < 2:
            stats["dropped_few_refs"] += 1
            continue
        loc = work.get("primary_location") or {}
        source = loc.get("source") or {}
        papers.append({
            "id": _slug(work),
            "openalex_id": _short_id(work.get("id", "")),
            "title": work.get("title", ""),
            "authors": _extract_authors(work.get("authorships") or []),
            "year": work.get("publication_year"),
            "journal": source.get("display_name", ""),
            "doi": work.get("doi", ""),
            "references": ref_ids,
        })
        for ref_url in raw_refs:
            sid = _short_id(ref_url)
            if sid not in reference_pool:
                m = ref_meta.get(ref_url, {})
                reference_pool[sid] = {
                    "title": m.get("title", ""),
                    "authors": m.get("authors", []),
                    "year": m.get("year") or 0,
                    "journal": m.get("journal", ""),
                    "doi": m.get("doi", ""),
                }

    papers.sort(key=lambda p: (p.get("year") or 0, p["id"]))

    dataset = {
        "metadata": {
            "description": f"Citation network of {info['display_name']} from OpenAlex",
            "author_focus": info["display_name"],
            "author_key": author_key,
            "source": "OpenAlex API",
            "stats": {
                **stats,
                "papers_included": len(papers),
                "unique_references": len(reference_pool),
            },
        },
        "papers": papers,
        "reference_pool": reference_pool,
    }

    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    return dataset


def collect_and_preprocess(author_key: str, force: bool = False, author_info: dict | None = None) -> dict:
    """End-to-end pipeline used by the API when a new author is added."""
    collect(author_key, force=force, author_info=author_info)
    return preprocess(author_key, force=force, author_info=author_info)
