"""Scienti endpoints — skipped if scraper data is not present."""

from pathlib import Path


def _scienti_available() -> bool:
    from app import config

    return (config.SCIENTI_DATA_DIR / "cvlac").exists()


def test_overview(client):
    r = client.get("/scienti/overview", params={"cvlac_limit": 5, "gruplac_limit": 5})
    assert r.status_code == 200
    body = r.json()
    assert "available" in body
    if _scienti_available():
        assert body["available"] is True
        assert body["n_cvlac"] >= 0


def test_coauthorship_summary(client):
    if not _scienti_available():
        return
    r = client.get(
        "/scienti/coauthorship/summary",
        params={"limit": 10, "min_articles": 1},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert "n_authors" in body and "top_authors" in body


def test_coauthorship_graph(client):
    if not _scienti_available():
        return
    r = client.get(
        "/scienti/coauthorship/graph",
        params={"limit": 10, "min_articles": 1, "max_nodes": 20},
    )
    assert r.status_code == 200
    body = r.json()
    assert "nodes" in body and "edges" in body
    assert len(body["nodes"]) <= 20


def test_groups_summary(client):
    if not _scienti_available():
        return
    r = client.get("/scienti/groups/summary", params={"limit": 10})
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert "top_groups" in body
