"""Scienti service — wraps `aiq.scienti` to expose summaries and graphs.

Reads from `scraper_scienti/data/` (configured in `config.SCIENTI_DATA_DIR`).
"""

from __future__ import annotations

import json
from collections import Counter
from functools import lru_cache

from aiq import scienti as aiq_scienti
from aiq.brauer import BrauerConfiguration

from .. import config


def _root() -> str:
    return str(config.SCIENTI_DATA_DIR)


def is_available() -> bool:
    return (config.SCIENTI_DATA_DIR / "cvlac").exists()


@lru_cache(maxsize=8)
def _coauthor_quiver(limit: int | None, min_articles: int):
    return aiq_scienti.load_coauthorship_quiver(
        root=_root(), limit=limit, min_articles=min_articles
    )


@lru_cache(maxsize=8)
def _group_quiver(limit: int | None):
    return aiq_scienti.load_group_member_quiver(root=_root(), limit=limit)


def overview(cvlac_limit: int = 200, gruplac_limit: int = 100) -> dict:
    """High-level counts for the Scienti dashboard."""
    if not is_available():
        return {"available": False, "reason": "scraper_scienti/data no encontrado"}

    cvlacs = aiq_scienti.load_cvlac_records(root=_root(), limit=cvlac_limit)
    groups = aiq_scienti.load_gruplac_records(root=_root(), limit=gruplac_limit)
    return {
        "available": True,
        "n_cvlac": len(cvlacs),
        "n_gruplac": len(groups),
        "data_dir": _root(),
        "sample_cvlac_keys": list(cvlacs.keys())[:5],
        "sample_gruplac_keys": list(groups.keys())[:5],
    }


def coauthorship_summary(limit: int = 200, min_articles: int = 1) -> dict:
    if not is_available():
        return {"available": False}
    quiver, meta = _coauthor_quiver(limit, min_articles)
    top = sorted(meta.items(), key=lambda kv: -kv[1]["articulos"])[:15]
    return {
        "available": True,
        "n_authors": len(quiver.Q0),
        "n_edges": len(quiver.Q1),
        "limit": limit,
        "min_articles": min_articles,
        "top_authors": [
            {"name": name, "articulos": info["articulos"], "cod_rh": info.get("cod_rh")}
            for name, info in top
        ],
    }


def groups_summary(limit: int = 100) -> dict:
    if not is_available():
        return {"available": False}
    quiver, meta = _group_quiver(limit)
    n_groups = sum(1 for v in quiver.Q0 if str(v).startswith("grp:"))
    n_researchers = sum(1 for v in quiver.Q0 if str(v).startswith("rh:"))

    # Top groups by membership (out-degree on grp: vertices)
    out_deg: Counter = Counter()
    for _, src, tgt in quiver.Q1:
        if str(src).startswith("grp:"):
            out_deg[src] += 1

    top_groups = []
    for gv, n in out_deg.most_common(15):
        info = meta.get(gv, {})
        top_groups.append({
            "id": gv.replace("grp:", ""),
            "nombre": info.get("nombre", ""),
            "lider": info.get("lider", ""),
            "clasificacion": info.get("clasificacion", ""),
            "departamento": info.get("departamento", ""),
            "n_integrantes": n,
        })
    return {
        "available": True,
        "n_groups": n_groups,
        "n_researchers": n_researchers,
        "n_memberships": len(quiver.Q1),
        "top_groups": top_groups,
    }


def coauthorship_graph(limit: int = 80, min_articles: int = 2, max_nodes: int = 60) -> dict:
    """Lightweight graph payload (nodes/edges) for the frontend visualization."""
    if not is_available():
        return {"available": False, "nodes": [], "edges": []}
    quiver, meta = _coauthor_quiver(limit, min_articles)
    # Keep top-N nodes by article count
    sorted_authors = sorted(meta.items(), key=lambda kv: -kv[1]["articulos"])
    keep = {name for name, _ in sorted_authors[:max_nodes]}

    nodes = [
        {"id": name, "label": name, "size": meta[name]["articulos"]}
        for name in keep
    ]
    edges = []
    seen_pairs = set()
    for arrow_name, src, tgt in quiver.Q1:
        if src not in keep or tgt not in keep:
            continue
        # De-duplicate undirected pairs
        key = tuple(sorted((src, tgt)))
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        edges.append({"source": src, "target": tgt})
    return {
        "available": True,
        "n_total_authors": len(quiver.Q0),
        "n_total_edges": len(quiver.Q1),
        "nodes": nodes,
        "edges": edges,
    }


def brauer_from_scienti(limit: int = 80, min_authors: int = 2) -> dict:
    """Build a Brauer configuration from Scienti data and return a summary."""
    if not is_available():
        return {"available": False}
    bc, polygon_meta = aiq_scienti.load_scienti_brauer_config(
        root=_root(), limit=limit, min_authors=min_authors
    )
    analysis = bc.brauer_analysis()
    return {
        "available": True,
        "n_polygons": analysis["n_polygons"],
        "n_vertices": analysis["n_vertices"],
        "delta_B": analysis["impact_factor_delta_B"],
        "entropy_H_B": round(analysis["entropy_H_B"], 4),
        "n_loops": analysis["n_loops"],
        "dimension": analysis["dimension"],
    }
