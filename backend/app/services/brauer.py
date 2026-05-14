"""Brauer analysis service — wraps aiq.brauer for the API.

Ported from the original scholar_agent.analyzer; reads preprocessed
JSONs from DATA_DIR and uses aiq-quivers for the math.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from functools import lru_cache
from pathlib import Path

from aiq.brauer import BrauerConfiguration, brauer_from_citation_json

from .. import config
from . import registry


# ── IO helpers ───────────────────────────────────────────

def _load_dataset(author_key: str) -> dict:
    path = config.dataset_path(author_key)
    if not path.exists():
        raise FileNotFoundError(f"Dataset for '{author_key}' not found")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=32)
def _load_config(author_key: str) -> BrauerConfiguration:
    return brauer_from_citation_json(str(config.dataset_path(author_key)))


def invalidate_cache(author_key: str | None = None) -> None:
    """Clear cached BrauerConfigurations (call after re-preprocessing)."""
    _load_config.cache_clear()


# ── Public service functions ─────────────────────────────

def list_available() -> list[dict]:
    """Authors with preprocessed datasets available."""
    out = []
    seen = set()
    reg = registry.all()
    for key, info in reg.items():
        path = config.dataset_path(key)
        if not path.exists():
            continue
        data = _load_dataset(key)
        out.append({
            "key": key,
            "openalex_id": info.get("openalex_id", ""),
            "display_name": info.get("display_name", key),
            "area": info.get("area", ""),
            "n_papers": len(data.get("papers", [])),
            "n_references": len(data.get("reference_pool", {})),
        })
        seen.add(key)

    # Dynamic: any *.json in DATA_DIR not _raw.json and not in registry/registry.json
    for json_file in config.DATA_DIR.glob("*.json"):
        if json_file.name.endswith("_raw.json") or json_file.name == "registry.json":
            continue
        key = json_file.stem
        if key in seen:
            continue
        try:
            data = _load_dataset(key)
        except (json.JSONDecodeError, OSError):
            continue
        meta = data.get("metadata", {})
        out.append({
            "key": key,
            "openalex_id": "",
            "display_name": meta.get("author_focus", key),
            "area": "",
            "n_papers": len(data.get("papers", [])),
            "n_references": len(data.get("reference_pool", {})),
        })
    out.sort(key=lambda a: a["display_name"].lower())
    return out


def summary(author_key: str) -> dict:
    bc = _load_config(author_key)
    analysis = bc.brauer_analysis()
    data = _load_dataset(author_key)
    info = registry.get(author_key) or {}

    valencies = analysis.get("valencies", {})
    ref_pool = data.get("reference_pool", {})

    top_refs = sorted(valencies.items(), key=lambda x: x[1], reverse=True)[:10]
    top_refs_enriched = []
    for ref_id, val in top_refs:
        meta = ref_pool.get(ref_id, {})
        top_refs_enriched.append({
            "ref_id": ref_id,
            "title": meta.get("title", ""),
            "authors": meta.get("authors", []),
            "year": meta.get("year"),
            "valency": val,
            "weight": val if val >= 2 else 2,
        })

    n = analysis["n_vertices"]
    h_max = math.log2(n) if n > 1 else 1
    entropy_ratio = analysis["entropy_H_B"] / h_max if h_max > 0 else 0

    univalent = analysis.get("univalent_vertices", [])
    delta_univ = 2 * len(univalent)
    delta_core = analysis["impact_factor_delta_B"] - delta_univ

    return {
        "author_key": author_key,
        "display_name": info.get("display_name", author_key),
        "area": info.get("area", ""),
        "n_papers": analysis["n_polygons"],
        "n_references": analysis["n_vertices"],
        "dimension": analysis["dimension"],
        "center_dimension": analysis["center_dimension"],
        "n_loops": analysis["n_loops"],
        "delta_B": analysis["impact_factor_delta_B"],
        "delta_B_univ": delta_univ,
        "delta_B_core": delta_core,
        "entropy_H_B": round(analysis["entropy_H_B"], 4),
        "entropy_max": round(h_max, 4),
        "entropy_ratio": round(entropy_ratio, 4),
        "n_univalent": len(univalent),
        "n_multivalent": len(analysis.get("multivalent_vertices", [])),
        "top_references": top_refs_enriched,
    }


def top_papers_by_delta(author_key: str, n: int = 5) -> list[dict]:
    bc = _load_config(author_key)
    data = _load_dataset(author_key)
    analysis = bc.brauer_analysis()
    valencies = analysis["valencies"]
    multiplicities = analysis["multiplicities"]

    papers_data = {p["id"]: p for p in data.get("papers", [])}
    out = []
    for pid, refs in bc._polygons.items():
        contribution = sum(
            multiplicities.get(r, 1) * valencies.get(r, 1) for r in refs
        )
        info = papers_data.get(pid, {})
        out.append({
            "paper_id": pid,
            "title": info.get("title", ""),
            "year": info.get("year"),
            "n_references": len(refs),
            "delta_contribution": contribution,
        })
    out.sort(key=lambda x: x["delta_contribution"], reverse=True)
    return out[:n]


def top_references_by_valency(author_key: str, n: int = 10) -> list[dict]:
    bc = _load_config(author_key)
    data = _load_dataset(author_key)
    analysis = bc.brauer_analysis()
    valencies = analysis["valencies"]
    multiplicities = analysis["multiplicities"]
    ref_pool = data.get("reference_pool", {})

    refs = []
    for ref_id, val in sorted(valencies.items(), key=lambda x: x[1], reverse=True)[:n]:
        meta = ref_pool.get(ref_id, {})
        mu = multiplicities.get(ref_id, 1)
        refs.append({
            "ref_id": ref_id,
            "title": meta.get("title", ""),
            "authors": meta.get("authors", []),
            "year": meta.get("year"),
            "valency": val,
            "mu": mu,
            "omega": mu * val,
            "weight_pct": round(100 * mu * val / analysis["impact_factor_delta_B"], 2),
        })
    return refs


def compare(author_keys: list[str]) -> dict:
    summaries: dict[str, dict] = {}
    for key in author_keys:
        try:
            summaries[key] = summary(key)
        except FileNotFoundError as e:
            summaries[key] = {"error": str(e)}

    ref_sets: dict[str, set] = {}
    for key in author_keys:
        if "error" in summaries.get(key, {}):
            continue
        data = _load_dataset(key)
        ref_sets[key] = set(data.get("reference_pool", {}).keys())

    shared: set = set()
    if len(ref_sets) >= 2:
        keys_with = list(ref_sets)
        shared = set.intersection(*(ref_sets[k] for k in keys_with))

    shared_refs: list[dict] = []
    if shared:
        first_key = next(k for k in author_keys if k in ref_sets)
        first_data = _load_dataset(first_key)
        for ref_id in sorted(shared):
            meta = first_data.get("reference_pool", {}).get(ref_id, {})
            entry = {
                "ref_id": ref_id,
                "title": meta.get("title", ""),
                "authors": meta.get("authors", []),
                "year": meta.get("year"),
            }
            for key in author_keys:
                if key in ref_sets:
                    try:
                        bc = _load_config(key)
                        entry[f"valency_{key}"] = bc.brauer_analysis()["valencies"].get(ref_id, 0)
                    except Exception:
                        entry[f"valency_{key}"] = 0
            shared_refs.append(entry)
        shared_refs.sort(
            key=lambda x: sum(x.get(f"valency_{k}", 0) for k in author_keys),
            reverse=True,
        )

    return {
        "authors": summaries,
        "shared_references": shared_refs[:50],
        "n_shared": len(shared),
    }


def shared_references(author_keys: list[str]) -> list[dict]:
    return compare(author_keys)["shared_references"]


def entropy_decomposition(author_key: str) -> dict:
    bc = _load_config(author_key)
    analysis = bc.brauer_analysis()
    data = _load_dataset(author_key)
    valencies = analysis["valencies"]
    multiplicities = analysis["multiplicities"]
    delta_B = analysis["impact_factor_delta_B"]
    ref_pool = data.get("reference_pool", {})

    contributions = []
    for ref_id, v in valencies.items():
        mu = multiplicities.get(ref_id, 1)
        omega = mu * v
        p = omega / delta_B if delta_B else 0
        h = -p * math.log2(p) if p > 0 else 0
        meta = ref_pool.get(ref_id, {})
        contributions.append({
            "ref_id": ref_id,
            "title": meta.get("title", ""),
            "valency": v,
            "omega": omega,
            "p_m": round(p, 6),
            "entropy_contribution": round(h, 6),
        })
    contributions.sort(key=lambda x: x["entropy_contribution"], reverse=True)

    return {
        "author_key": author_key,
        "total_entropy": round(analysis["entropy_H_B"], 4),
        "top_contributors": contributions[:15],
        "bottom_contributors": contributions[-5:],
    }


def search_references(author_key: str, query: str) -> list[dict]:
    data = _load_dataset(author_key)
    bc = _load_config(author_key)
    valencies = bc.brauer_analysis()["valencies"]
    q = query.lower().strip()
    if not q:
        return []
    out = []
    for ref_id, meta in data.get("reference_pool", {}).items():
        title = (meta.get("title") or "").lower()
        authors = " ".join(meta.get("authors", [])).lower()
        if q in title or q in authors:
            out.append({
                "ref_id": ref_id,
                "title": meta.get("title", ""),
                "authors": meta.get("authors", []),
                "year": meta.get("year"),
                "valency": valencies.get(ref_id, 0),
            })
    out.sort(key=lambda x: x["valency"], reverse=True)
    return out[:50]


# ── Raw data for client-side rendering (Cytoscape / Recharts) ──

def quiver_data(author_key: str, max_nodes: int = 200) -> dict:
    """Cytoscape-compatible nodes/edges for the Brauer quiver Q_M.

    Each polygon (paper) is a node sized by # references. Edges come from
    the successor sequences of the Brauer quiver. Loops and parallel
    arrows are preserved (Cytoscape handles them natively).

    For very large quivers (>max_nodes polygons) only the most-incident
    nodes are kept to keep the client-side layout tractable.
    """
    bc = _load_config(author_key)
    quiver = bc.brauer_quiver()
    polygon_data = bc._polygon_data or {}
    polygon_sizes = {pid: len(refs) for pid, refs in bc._polygons.items()}

    # Pre-compute incident degree per polygon vertex.
    deg: dict = {}
    for _, src, tgt in quiver.Q1:
        deg[src] = deg.get(src, 0) + 1
        if src != tgt:
            deg[tgt] = deg.get(tgt, 0) + 1

    polygons = list(quiver.Q0)
    polygons.sort(key=lambda p: -deg.get(p, 0))
    if len(polygons) > max_nodes:
        keep = set(polygons[:max_nodes])
    else:
        keep = set(polygons)

    nodes = []
    for pid in polygons:
        if pid not in keep:
            continue
        meta = polygon_data.get(pid, {}) or {}
        nodes.append({
            "id": str(pid),
            "label": (meta.get("title") or str(pid))[:40],
            "year": meta.get("year"),
            "size": polygon_sizes.get(pid, 0),
            "n_refs": polygon_sizes.get(pid, 0),
            "authors": meta.get("authors") or [],
            "journal": meta.get("journal", ""),
        })

    # Aggregate parallel arrows so the client draws one curved edge per
    # (src, tgt) with `weight` = parallel count. Loops kept separate.
    edge_counts: dict = {}
    loop_counts: dict = {}
    for _, src, tgt in quiver.Q1:
        s, t = str(src), str(tgt)
        if s not in {str(x) for x in keep} or t not in {str(x) for x in keep}:
            continue
        if s == t:
            loop_counts[s] = loop_counts.get(s, 0) + 1
        else:
            key = (s, t)
            edge_counts[key] = edge_counts.get(key, 0) + 1

    edges = [
        {"id": f"e_{i}", "source": s, "target": t, "weight": w}
        for i, ((s, t), w) in enumerate(edge_counts.items())
    ]
    loops = [{"id": v, "count": c} for v, c in loop_counts.items()]

    return {
        "nodes": nodes,
        "edges": edges,
        "loops": loops,
        "n_total_polygons": len(polygons),
        "n_shown": len(nodes),
        "n_total_edges": len(quiver.Q1),
    }


def valency_data(author_key: str) -> dict:
    """Histogram bins + univalent vs multivalent split for charts."""
    bc = _load_config(author_key)
    analysis = bc.brauer_analysis()
    valencies = analysis["valencies"]
    vertex_data = bc._vertex_data or {}

    # Bin counts
    bins: dict[int, int] = {}
    examples: dict[int, list[str]] = {}
    for vid, v in valencies.items():
        bins[v] = bins.get(v, 0) + 1
        examples.setdefault(v, [])
        if len(examples[v]) < 3:
            t = (vertex_data.get(vid, {}) or {}).get("title") or str(vid)
            examples[v].append(t[:60])

    histogram = [
        {"valency": v, "count": bins[v], "examples": examples[v]}
        for v in sorted(bins)
    ]
    return {
        "histogram": histogram,
        "n_total": analysis["n_vertices"],
        "n_univalent": len(analysis.get("univalent_vertices", [])),
        "max_valency": max(bins) if bins else 0,
    }


def polygon_contribution_data(author_key: str) -> dict:
    """Per-polygon δ_B contribution for the bar chart."""
    bc = _load_config(author_key)
    analysis = bc.brauer_analysis()
    valencies = analysis["valencies"]
    multiplicities = analysis["multiplicities"]
    polygon_data = bc._polygon_data or {}

    rows = []
    for pid, refs in bc._polygons.items():
        n_univ = 0
        contribution = 0
        for r in refs:
            v = valencies.get(r, 1)
            mu = multiplicities.get(r, 1)
            contribution += mu * v
            if v == 1:
                n_univ += 1
        meta = polygon_data.get(pid, {}) or {}
        rows.append({
            "polygon_id": str(pid),
            "title": (meta.get("title") or str(pid))[:60],
            "year": meta.get("year"),
            "n_refs": len(refs),
            "n_univalent_refs": n_univ,
            "delta_contribution": contribution,
        })
    rows.sort(key=lambda r: -r["delta_contribution"])
    return {
        "rows": rows,
        "delta_B_total": analysis["impact_factor_delta_B"],
    }


def weight_data(author_key: str, top_n: int = 40) -> dict:
    """Treemap-friendly: each reference with its weight ω(m) = μ·val,
    grouped by univalent vs multivalent."""
    bc = _load_config(author_key)
    analysis = bc.brauer_analysis()
    valencies = analysis["valencies"]
    multiplicities = analysis["multiplicities"]
    delta_B = analysis["impact_factor_delta_B"]
    vertex_data = bc._vertex_data or {}

    items = []
    for vid, v in valencies.items():
        mu = multiplicities.get(vid, 1)
        omega = mu * v
        meta = vertex_data.get(vid, {}) or {}
        items.append({
            "ref_id": str(vid),
            "title": (meta.get("title") or str(vid))[:60],
            "year": meta.get("year"),
            "valency": v,
            "mu": mu,
            "omega": omega,
            "p_m": omega / delta_B if delta_B else 0,
            "class": "univalent" if v == 1 else "multivalent",
        })
    items.sort(key=lambda x: -x["omega"])
    top = items[:top_n]
    rest = items[top_n:]
    rest_sum_omega = sum(x["omega"] for x in rest)

    return {
        "delta_B": delta_B,
        "entropy_H_B": round(analysis["entropy_H_B"], 4),
        "items": top,
        "rest": {"count": len(rest), "omega_sum": rest_sum_omega},
    }


def comparison_radar_data(author_keys: list[str]) -> dict:
    """Normalised metrics per author for a Recharts radar chart."""
    raw_summaries = {k: summary(k) for k in author_keys}
    metrics = [
        ("entropy_ratio", "ρ(B)"),
        ("n_papers", "Papers"),
        ("n_references", "Refs"),
        ("delta_B", "δ_B"),
        ("n_univalent_pct", "% Univ"),
        ("dimension_per_paper", "dim/paper"),
    ]
    enriched: dict[str, dict] = {}
    for k, s in raw_summaries.items():
        enriched[k] = {
            **s,
            "n_univalent_pct": (
                s["n_univalent"] / s["n_references"] if s.get("n_references") else 0
            ),
            "dimension_per_paper": (
                s["dimension"] / s["n_papers"] if s.get("n_papers") else 0
            ),
        }

    # Normalise each metric to [0, 1] across the selected authors.
    maxes = {
        m: max((enriched[k].get(m, 0) or 0) for k in author_keys) or 1.0
        for m, _ in metrics
    }

    radar = []
    for m, label in metrics:
        row: dict = {"metric": label}
        for k in author_keys:
            row[k] = round((enriched[k].get(m, 0) or 0) / maxes[m], 4)
        radar.append(row)

    return {
        "metrics": [{"key": m, "label": label} for m, label in metrics],
        "authors": [
            {"key": k, "display_name": enriched[k].get("display_name", k)}
            for k in author_keys
        ],
        "radar": radar,
    }
