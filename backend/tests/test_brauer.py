"""Tests against the Brauer endpoints — require at least one preprocessed dataset.

If no dataset is present in the test DATA_DIR (because we couldn't seed),
the tests are skipped rather than failing.
"""

import pytest


def _first_available_key(client) -> str | None:
    r = client.get("/authors")
    authors = r.json()
    return authors[0]["key"] if authors else None


def test_summary_for_seeded_author(client):
    key = _first_available_key(client)
    if not key:
        pytest.skip("No preprocessed datasets available in test DATA_DIR")
    r = client.get(f"/brauer/{key}/summary")
    assert r.status_code == 200
    body = r.json()
    for field in ("delta_B", "entropy_H_B", "n_papers", "n_references"):
        assert field in body


def test_top_papers(client):
    key = _first_available_key(client)
    if not key:
        pytest.skip("No preprocessed datasets")
    r = client.get(f"/brauer/{key}/top-papers", params={"n": 3})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list) and len(body) <= 3


def test_summary_unknown_returns_404(client):
    r = client.get("/brauer/__nonexistent__/summary")
    assert r.status_code == 404


def test_compare_two_authors(client):
    r = client.get("/authors")
    keys = [a["key"] for a in r.json()]
    if len(keys) < 2:
        pytest.skip("Need ≥2 datasets to test /compare")
    r = client.get("/brauer/compare", params=[("keys", keys[0]), ("keys", keys[1])])
    assert r.status_code == 200
    body = r.json()
    assert "authors" in body and "shared_references" in body


def test_quiver_data(client):
    key = _first_available_key(client)
    if not key:
        pytest.skip("No preprocessed datasets")
    r = client.get(f"/brauer/{key}/quiver")
    assert r.status_code == 200
    body = r.json()
    for field in ("nodes", "edges", "loops", "n_total_polygons"):
        assert field in body
    assert isinstance(body["nodes"], list)
    assert isinstance(body["edges"], list)
    if body["nodes"]:
        n = body["nodes"][0]
        for field in ("id", "label", "size"):
            assert field in n


def test_valency_data(client):
    key = _first_available_key(client)
    if not key:
        pytest.skip("No preprocessed datasets")
    r = client.get(f"/brauer/{key}/valency")
    assert r.status_code == 200
    body = r.json()
    assert "histogram" in body and "n_total" in body and "n_univalent" in body


def test_polygon_contributions(client):
    key = _first_available_key(client)
    if not key:
        pytest.skip("No preprocessed datasets")
    r = client.get(f"/brauer/{key}/polygon-contributions")
    assert r.status_code == 200
    body = r.json()
    assert "rows" in body and "delta_B_total" in body


def test_weights(client):
    key = _first_available_key(client)
    if not key:
        pytest.skip("No preprocessed datasets")
    r = client.get(f"/brauer/{key}/weights", params={"top_n": 10})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "rest" in body and len(body["items"]) <= 10


def test_radar_two_authors(client):
    r = client.get("/authors")
    keys = [a["key"] for a in r.json()]
    if len(keys) < 2:
        pytest.skip("Need ≥2 datasets")
    r = client.get("/brauer/radar", params=[("keys", keys[0]), ("keys", keys[1])])
    assert r.status_code == 200
    body = r.json()
    assert "metrics" in body and "radar" in body and "authors" in body
