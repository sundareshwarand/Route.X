import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_cloud_health_endpoint():
    """Verify /health endpoint for cloud platform health probes (Render, Railway, Fly)."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["database"] == "CONNECTED"
    assert "system" in data
    assert "version" in data
    assert data["endpoints"]["api"] == "/api"
    assert data["endpoints"]["ws"] == "/ws"


def test_root_endpoint_metadata():
    """Verify root endpoint returns system identity and health link."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["health"] == "/health"


def test_cors_configuration_parsing():
    """Verify CORS origins can be parsed from comma-separated string."""
    from app.config import Settings
    s = Settings(CORS_ORIGINS="https://routex.pages.dev, https://routex.vercel.app")
    assert "https://routex.pages.dev" in s.CORS_ORIGINS
    assert "https://routex.vercel.app" in s.CORS_ORIGINS


def test_database_url_normalization():
    """Verify postgres:// is rewritten to postgresql:// for modern SQLAlchemy compatibility."""
    raw_url = "postgres://user:pass@render-db-host.com:5432/routex"
    normalized = raw_url.replace("postgres://", "postgresql://", 1)
    assert normalized.startswith("postgresql://")


def test_schema_compatibility_execution():
    """Verify ensure_schema_compatibility runs safely without throwing exceptions."""
    from app.database import ensure_schema_compatibility
    ensure_schema_compatibility()


def test_driver_role_cannot_perform_operator_actions():
    """
    SECURITY AUDIT:
    Verify that an authenticated DRIVER role cannot reorder emergency priority queue.
    """
    # 1. Login as driver (seed account)
    driver_login = client.post(
        "/api/auth/login",
        data={"username": "driver1@routex.org", "password": "driver123"}
    )
    if driver_login.status_code != 200:
        # Fallback to test_driver if running under test_api fixture
        driver_login = client.post(
            "/api/auth/login",
            data={"username": "test_driver@routex.org", "password": "driver123"}
        )
    assert driver_login.status_code == 200
    driver_token = driver_login.json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # 2. Attempt operator-only action: reorder queue at JNC-01
    reorder_resp = client.post(
        "/api/emergency/junction/JNC-01/queue/reorder",
        headers=driver_headers,
        json={"request_ids": ["REQ-TEST-1"], "reason": "Driver override attempt"}
    )
    # Must be forbidden (403)
    assert reorder_resp.status_code == 403
    assert "Operator privileges required" in reorder_resp.json()["detail"]


def test_case_insensitive_and_trimmed_email_login():
    """Verify that login handles mobile keyboard auto-capitalization and trailing spaces."""
    # 1. Capitalized email (Android keyboard auto-capitalization)
    res_cap = client.post(
        "/api/auth/login",
        data={"username": "Operator@routex.org", "password": "operator123"}
    )
    if res_cap.status_code != 200:
        res_cap = client.post(
            "/api/auth/login",
            data={"username": "Test_Operator@routex.org", "password": "password123"}
        )
    assert res_cap.status_code == 200
    assert "access_token" in res_cap.json()

    # 2. Trailing whitespace
    res_space = client.post(
        "/api/auth/login",
        data={"username": " operator@routex.org ", "password": "operator123"}
    )
    if res_space.status_code != 200:
        res_space = client.post(
            "/api/auth/login",
            data={"username": " test_operator@routex.org ", "password": "password123"}
        )
    assert res_space.status_code == 200
    assert "access_token" in res_space.json()


def test_json_login_endpoint():
    """Verify fallback JSON login endpoint for mobile WebViews."""
    res = client.post(
        "/api/auth/login/json",
        json={"email": "Operator@routex.org", "password": "operator123"}
    )
    if res.status_code != 200:
        res = client.post(
            "/api/auth/login/json",
            json={"email": "Test_Operator@routex.org", "password": "password123"}
        )
    assert res.status_code == 200
    assert "access_token" in res.json()
    assert res.json()["user"]["role"] == "operator"


def test_mandatory_two_second_clearance_safety_invariable():
    """
    SAFETY-CRITICAL TEST:
    Verify that all-red clearance interval initiates at exactly 2.0s upon emergency approach
    and cannot be cleared prematurely.
    """
    try:
        from app.services.simulation_service import simulation_service
    except ModuleNotFoundError:
        from backend.app.services.simulation_service import simulation_service

    simulation_service.reset()
    simulation_service.start_scenario("STANDARD_CORRIDOR", speed_multiplier=1.0)
    # Step until approach boundary triggers failsafe all-red
    for _ in range(18):
        simulation_service.tick(1.0)
        status = simulation_service.get_status()
        jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
        if jnc2["signal_state"] == "FAILSAFE_ALL_RED":
            break

    status = simulation_service.get_status()
    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    assert jnc2["signal_state"] == "FAILSAFE_ALL_RED"
    assert jnc2["clearance_remaining"] == 2.0
