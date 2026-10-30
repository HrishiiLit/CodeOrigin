def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data
    assert "services" in data
    assert data["services"]["api"] == "up"


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "CodeOrigin AI API"
    assert data["docs_url"] == "/docs"
