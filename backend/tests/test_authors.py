def test_list_authors_returns_array(client):
    r = client.get("/authors")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)


def test_get_registry(client):
    r = client.get("/authors/registry")
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


def test_register_author_persists(client):
    payload = {
        "key": "test_user",
        "openalex_id": "https://openalex.org/A0",
        "display_name": "Test User",
        "area": "Testing",
    }
    r = client.post("/authors/registry", json=payload)
    # 201 on accept; the background job will fail to fetch (no real OpenAlex call here)
    # but the registration itself must succeed.
    assert r.status_code == 201

    r2 = client.get("/authors/registry")
    assert "test_user" in r2.json()

    r3 = client.delete("/authors/registry/test_user")
    assert r3.status_code == 200


def test_delete_unknown_returns_404(client):
    r = client.delete("/authors/registry/nonexistent_xyz")
    assert r.status_code == 404
