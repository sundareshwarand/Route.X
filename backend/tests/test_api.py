import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app, seed_initial_data
from app.services.ai_service import ai_service
from app.models import (
    User,
    UserRole,
    Ambulance,
    Junction,
    EmergencyRequest,
    RequestStatus,
    RequestSource,
    SignalState,
    Direction,
    Hospital,
    HospitalReadiness,
    utc_now
)

# Test in-memory SQLite database with StaticPool to persist schema across test sessions
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    # Seed data
    db = TestingSessionLocal()
    from app.auth import hash_password
    user = User(
        email="test_operator@routex.org",
        hashed_password=hash_password("password123"),
        full_name="Test Operator",
        role=UserRole.OPERATOR,
        is_active=True
    )
    driver = User(
        email="test_driver@routex.org",
        hashed_password=hash_password("driver123"),
        full_name="Test Driver",
        role=UserRole.DRIVER,
        is_active=True
    )
    amb1 = Ambulance(id="AMB-01", call_sign="MEDIC-101", plate_number="DL-01-EM-4021")
    amb2 = Ambulance(id="AMB-02", call_sign="RESCUE-202", plate_number="DL-01-EM-7890")
    amb3 = Ambulance(id="AMB-03", call_sign="PARAMEDIC-303", plate_number="DL-02-EM-1122")
    jnc1 = Junction(id="JNC-01", name="Central Cross", code="CA-1", latitude=28.61, longitude=77.20, zone="ZONE-CENTRAL", current_signal_state=SignalState.NORMAL_CYCLE)
    jnc2 = Junction(id="JNC-02", name="Hospital Cross", code="HC-2", latitude=28.62, longitude=77.21, zone="ZONE-HOSPITAL", current_signal_state=SignalState.NORMAL_CYCLE)
    jnc3 = Junction(id="JNC-03", name="North Cross", code="NC-3", latitude=28.63, longitude=77.22, zone="ZONE-NORTH", current_signal_state=SignalState.NORMAL_CYCLE)
    jnc4 = Junction(id="JNC-04", name="Tech Crossing", code="TC-4", latitude=28.64, longitude=77.23, zone="ZONE-TECH", current_signal_state=SignalState.NORMAL_CYCLE)
    jnc5 = Junction(id="JNC-05", name="Emergency Trauma Corridor Exit", code="ETC-EX", latitude=28.65, longitude=77.24, zone="ZONE-HOSPITAL", current_signal_state=SignalState.NORMAL_CYCLE)

    hosp1 = Hospital(
        id="HOSP-01",
        name="City Emergency Trauma Center",
        junction_id="JNC-05",
        latitude=28.65,
        longitude=77.24,
        readiness_status=HospitalReadiness.TRAUMA_READY,
        available_icu_beds=12,
        total_icu_beds=16,
        specialties="Trauma Level 1, Neuro Surgery, Severe Resuscitation",
        is_accepting_emergencies=True
    )
    hosp2 = Hospital(
        id="HOSP-02",
        name="Metro General Hospital",
        junction_id="JNC-02",
        latitude=28.62,
        longitude=77.21,
        readiness_status=HospitalReadiness.CAPACITY_NOMINAL,
        available_icu_beds=6,
        total_icu_beds=10,
        specialties="Cardiology, Stroke Unit, Urgent Care",
        is_accepting_emergencies=True
    )
    
    db.add_all([user, driver, amb1, amb2, amb3, jnc1, jnc2, jnc3, jnc4, jnc5, hosp1, hosp2])

    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def get_token(client: TestClient, email: str = "test_operator@routex.org", password: str = "password123") -> str:
    res = client.post("/api/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


# 1. Test Auth & Token
def test_login_and_auth(client: TestClient):
    token = get_token(client)
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "test_operator@routex.org"
    assert res.json()["role"] == "operator"


# 2. Test Invalid Login
def test_invalid_login(client: TestClient):
    res = client.post("/api/auth/login", data={"username": "wrong@routex.org", "password": "bad"})
    assert res.status_code == 401


# 3. Test Dijkstra Shortest Path
def test_dijkstra_shortest_path(client: TestClient):
    payload = {"start_junction_id": "JNC-01", "destination_junction_id": "JNC-03"}
    res = client.post("/api/junctions/route/shortest-path", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["start_junction"] == "JNC-01"
    assert data["destination_junction"] == "JNC-03"
    assert len(data["path"]) >= 2
    assert data["total_distance_meters"] > 0
    assert data["estimated_travel_time_seconds"] > 0


# 4. Test Mobile App Origin Request Flow
def test_mobile_emergency_request_flow(client: TestClient):
    token = get_token(client, email="test_driver@routex.org", password="driver123")
    
    # 4a. Driver posts request
    req_payload = {
        "ambulance_id": "AMB-01",
        "junction_id": "JNC-01",
        "direction": "STRAIGHT",
        "duration_seconds": 25,
        "source": "MOBILE_APP"
    }
    create_res = client.post(
        "/api/emergency/request",
        json=req_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert create_res.status_code == 201
    req_data = create_res.json()
    req_id = req_data["id"]
    assert req_data["status"] == "PENDING"
    assert req_data["direction"] == "STRAIGHT"

    # 4b. NodeMCU Polls Pending Command
    poll_res = client.get(f"/api/hardware/pending-commands/JNC-01")
    assert poll_res.status_code == 200
    poll_data = poll_res.json()
    assert poll_data["has_command"] is True
    assert poll_data["request_id"] == req_id
    assert poll_data["direction"] == "STRAIGHT"

    # Status must now be RECEIVED as the junction gateway retrieved it
    get_res = client.get(f"/api/emergency/requests/{req_id}")
    assert get_res.json()["status"] == "RECEIVED"

    # 4c. NodeMCU acknowledges activation (Signal switched to PRIORITY_ACTIVE)
    ack_payload = {
        "request_id": req_id,
        "junction_id": "JNC-01",
        "status": "PRIORITY_ACTIVE",
        "signal_state": "PRIORITY_ACTIVE",
        "active_direction": "STRAIGHT",
        "is_hardware_verified": True
    }
    ack_res = client.post("/api/hardware/acknowledge", json=ack_payload)
    assert ack_res.status_code == 200
    assert ack_res.json()["current_status"] == "PRIORITY_ACTIVE"
    assert ack_res.json()["junction_signal"] == "PRIORITY_ACTIVE"

    # 4d. NodeMCU finishes priority interval and reverts safely to NORMAL_CYCLE
    complete_payload = {
        "request_id": req_id,
        "junction_id": "JNC-01",
        "status": "COMPLETED",
        "signal_state": "NORMAL_CYCLE",
        "is_hardware_verified": True
    }
    comp_res = client.post("/api/hardware/acknowledge", json=complete_payload)
    assert comp_res.status_code == 200
    assert comp_res.json()["current_status"] == "COMPLETED"
    assert comp_res.json()["junction_signal"] == "NORMAL_CYCLE"


# 5. Test Physical LoRa Packet Event Handling (LEFT, STRAIGHT, RIGHT)
@pytest.mark.parametrize("direction", ["LEFT", "STRAIGHT", "RIGHT"])
def test_physical_lora_event(client: TestClient, direction: str):
    import uuid
    pkt_id = str(uuid.uuid4())
    payload = {
        "ver": 1,
        "id": pkt_id,
        "amb": "AMB-02",
        "dir": direction,
        "seq": 101,
        "ts": 120500,
        "junction_id": "JNC-02",
        "rssi": -65,
        "snr": 9.5,
        "crc_valid": True,
        "is_hardware_verified": True
    }
    res = client.post("/api/hardware/event", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "PROCESSED"
    assert data["state"] == "RECEIVED"
    assert data["direction"] == direction


# 6. Test Malformed LoRa Packet Rejection (CRC failure)
def test_malformed_lora_packet_rejected(client: TestClient):
    payload = {
        "ver": 1,
        "id": "bad-pkt-01",
        "amb": "AMB-01",
        "dir": "LEFT",
        "seq": 999,
        "ts": 12000,
        "junction_id": "JNC-01",
        "crc_valid": False,
        "is_hardware_verified": True
    }
    res = client.post("/api/hardware/event", json=payload)
    assert res.status_code == 422
    assert "CRC" in res.json()["detail"]


# 7. Test Duplicate LoRa Packet Handling
def test_duplicate_lora_packet_detection(client: TestClient):
    import uuid
    common_seq = 555
    pkt_id = str(uuid.uuid4())
    payload = {
        "ver": 1,
        "id": pkt_id,
        "amb": "AMB-01",
        "dir": "RIGHT",
        "seq": common_seq,
        "ts": 13000,
        "junction_id": "JNC-03",
        "crc_valid": True,
        "is_hardware_verified": True
    }
    res1 = client.post("/api/hardware/event", json=payload)
    assert res1.status_code == 201

    # Send exact duplicate packet again
    res2 = client.post("/api/hardware/event", json=payload)
    assert res2.status_code == 200
    assert res2.json()["status"] == "DUPLICATE_IGNORED"


# 8. Test Conflicting Requests and Multi-Ambulance Queue
def test_conflicting_emergency_requests(client: TestClient):
    token = get_token(client, email="test_driver@routex.org", password="driver123")
    
    # First ambulance requests priority at JNC-02
    req1 = {
        "ambulance_id": "AMB-01",
        "junction_id": "JNC-02",
        "direction": "STRAIGHT",
        "duration_seconds": 30
    }
    res1 = client.post("/api/emergency/request", json=req1, headers={"Authorization": f"Bearer {token}"})
    assert res1.status_code == 201
    req1_id = res1.json()["id"]

    # Gateway polls and activates priority for first request
    client.get(f"/api/hardware/pending-commands/JNC-02")
    client.post("/api/hardware/acknowledge", json={
        "request_id": req1_id,
        "junction_id": "JNC-02",
        "status": "PRIORITY_ACTIVE",
        "signal_state": "PRIORITY_ACTIVE",
        "active_direction": "STRAIGHT",
        "is_hardware_verified": True
    })

    # Second ambulance arrives simultaneously at JNC-02 from LEFT
    req2 = {
        "ambulance_id": "AMB-02",
        "junction_id": "JNC-02",
        "direction": "LEFT",
        "duration_seconds": 20
    }
    res2 = client.post("/api/emergency/request", json=req2, headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 201
    assert res2.json()["status"] == "PENDING"  # Remains queued while req1 holds priority


# 9. Test Request Cancellation
def test_request_cancellation(client: TestClient):
    token = get_token(client, email="test_driver@routex.org", password="driver123")
    create_res = client.post(
        "/api/emergency/request",
        json={"ambulance_id": "AMB-01", "junction_id": "JNC-03", "direction": "LEFT", "duration_seconds": 30},
        headers={"Authorization": f"Bearer {token}"}
    )
    req_id = create_res.json()["id"]

    cancel_res = client.post(
        f"/api/emergency/requests/{req_id}/cancel",
        json={"cancellation_reason": "Emergency stood down by dispatch"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"
    assert cancel_res.json()["cancellation_reason"] == "Emergency stood down by dispatch"


# 10. Test Heartbeat and Device Health
def test_device_heartbeat(client: TestClient):
    hb = {
        "hardware_id": "ESP8266-JNC-01",
        "junction_id": "JNC-01",
        "ip_address": "192.168.1.150",
        "free_heap": 28450,
        "uptime_seconds": 3600,
        "wifi_rssi": -55
    }
    res = client.post("/api/hardware/heartbeat", json=hb)
    assert res.status_code == 200
    assert res.json()["status"] == "HEARTBEAT_ACK"

    jnc_res = client.get("/api/junctions/JNC-01")
    assert jnc_res.json()["is_online"] is True


# 11. Test Nearby-Vehicle Alert Generation & Test Broadcast
def test_nearby_vehicle_alerts(client: TestClient):
    # Test broadcast trigger
    res = client.post("/api/alerts/test-broadcast?junction_id=JNC-01&zone=ZONE-CENTRAL&direction=STRAIGHT")
    assert res.status_code == 200
    data = res.json()
    assert data["is_test_simulation"] is True
    assert "give way" in data["message"].lower()

    # List active alerts
    active_res = client.get("/api/alerts/active?zone=ZONE-CENTRAL")
    assert active_res.status_code == 200
    assert len(active_res.json()) >= 1


# 12. Test Analytics Summary and Export
def test_analytics_and_export(client: TestClient):
    summary_res = client.get("/api/analytics/summary")
    assert summary_res.status_code == 200
    data = summary_res.json()
    assert "total_requests" in data
    assert "online_junctions_count" in data

    export_res = client.get("/api/analytics/export")
    assert export_res.status_code == 200
    export_data = export_res.json()
    assert export_data["system"] == "RouteX - Intelligent Emergency Traffic Management System"
    assert len(export_data["junctions"]) >= 3


# 13. Test Invalid Direction Input Rejection (Validation Failure)
def test_invalid_direction_rejected(client: TestClient):
    token = get_token(client, email="test_driver@routex.org", password="driver123")
    bad_req = {
        "ambulance_id": "AMB-01",
        "junction_id": "JNC-01",
        "direction": "DIAGONAL_FLY",  # Invalid enum value
        "duration_seconds": 20
    }
    res = client.post("/api/emergency/request", json=bad_req, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 422


# 14. Test Nonexistent Ambulance and Junction Rejection
def test_nonexistent_entities_rejected(client: TestClient):
    token = get_token(client, email="test_driver@routex.org", password="driver123")
    
    # Bad ambulance
    res1 = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-DOESNT-EXIST",
        "junction_id": "JNC-01",
        "direction": "STRAIGHT",
        "duration_seconds": 20
    }, headers={"Authorization": f"Bearer {token}"})
    assert res1.status_code == 404
    assert "Ambulance" in res1.json()["detail"]

    # Bad junction
    res2 = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-01",
        "junction_id": "JNC-999-NOT-FOUND",
        "direction": "STRAIGHT",
        "duration_seconds": 20
    }, headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 404
    assert "Junction" in res2.json()["detail"]


# 15. Test Unauthorized Access Denied
def test_unauthorized_access_denied(client: TestClient):
    # Try creating junction without operator/admin token
    res = client.post("/api/junctions", json={
        "id": "JNC-TEST",
        "name": "Unauthorized Test",
        "code": "UT-1",
        "latitude": 28.0,
        "longitude": 77.0,
        "zone": "ZONE-TEST"
    })
    assert res.status_code == 401


# 16. Test Command Expiry and Safe Automatic Signal Reversion
def test_expired_request_auto_reversion(client: TestClient):
    token = get_token(client, email="test_driver@routex.org", password="driver123")
    
    # Create request at JNC-03
    create_res = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-01",
        "junction_id": "JNC-03",
        "direction": "STRAIGHT",
        "duration_seconds": 5
    }, headers={"Authorization": f"Bearer {token}"})
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]

    # Poll and acknowledge PRIORITY_ACTIVE
    client.get("/api/hardware/pending-commands/JNC-03")
    client.post("/api/hardware/acknowledge", json={
        "request_id": req_id,
        "junction_id": "JNC-03",
        "status": "PRIORITY_ACTIVE",
        "signal_state": "PRIORITY_ACTIVE",
        "active_direction": "STRAIGHT",
        "is_hardware_verified": True
    })

    # Verify junction is PRIORITY_ACTIVE
    jnc_res = client.get("/api/junctions/JNC-03")
    assert jnc_res.json()["current_signal_state"] == "PRIORITY_ACTIVE"

    # Fast-forward expiry in database directly to simulate timeout
    db = TestingSessionLocal()
    req = db.query(EmergencyRequest).filter(EmergencyRequest.id == req_id).first()
    req.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    db.commit()
    db.close()

    # Query request (triggers check_and_expire_requests)
    get_res = client.get(f"/api/emergency/requests/{req_id}")
    assert get_res.json()["status"] == "EXPIRED"

    # Verify junction has safely reverted to NORMAL_CYCLE
    jnc_res2 = client.get("/api/junctions/JNC-03")
    assert jnc_res2.json()["current_signal_state"] == "NORMAL_CYCLE"


# 17. Test Client Subscription and Advisory Delivery Acknowledgment
def test_client_subscription_and_delivery_ack(client: TestClient):
    import uuid
    client_uuid = f"test-client-{uuid.uuid4().hex[:6]}"
    
    # Subscribe client to ZONE-CENTRAL
    sub_res = client.post("/api/alerts/subscribe", json={
        "client_uuid": client_uuid,
        "zone": "ZONE-CENTRAL",
        "latitude": 28.6105,
        "longitude": 77.2005,
        "is_simulation": True
    })
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["client_uuid"] == client_uuid
    assert sub_data["zone"] == "ZONE-CENTRAL"

    # Trigger emergency request at JNC-01
    token = get_token(client, email="test_driver@routex.org", password="driver123")
    req_res = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-01",
        "junction_id": "JNC-01",
        "direction": "STRAIGHT",
        "duration_seconds": 25
    }, headers={"Authorization": f"Bearer {token}"})
    assert req_res.status_code == 201
    req_id = req_res.json()["id"]

    # Active alert should now exist for ZONE-CENTRAL
    alerts_res = client.get("/api/alerts/active?zone=ZONE-CENTRAL")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    matching_alert = next((a for a in alerts if a["request_id"] == req_id), None)
    assert matching_alert is not None
    alert_id = matching_alert["id"]

    # Check delivery records for the alert
    deliv_res = client.get(f"/api/alerts/{alert_id}/deliveries")
    assert deliv_res.status_code == 200
    deliveries = deliv_res.json()
    assert len(deliveries) >= 1

    # Client acknowledges delivery
    ack_res = client.post(f"/api/alerts/{alert_id}/acknowledge", json={
        "client_identifier": client_uuid
    })
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["status"] == "ACKNOWLEDGED"
    assert ack_data["acknowledged_at"] is not None


# 18. Test Haversine Proximity Evaluation
def test_haversine_proximity_check(client: TestClient):
    # JNC-01 is at (28.61, 77.20)
    # Coordinate near JNC-01 (~100m away)
    near_res = client.post("/api/alerts/proximity-check", json={
        "client_latitude": 28.6108,
        "client_longitude": 77.2008,
        "max_radius_meters": 1000.0
    })
    assert near_res.status_code == 200
    near_data = near_res.json()
    assert near_data["is_simulated_proximity"] is True
    assert "advisory" in near_data["disclaimer"].lower()

    # Coordinate far away (~50km away)
    far_res = client.post("/api/alerts/proximity-check", json={
        "client_latitude": 29.1000,
        "client_longitude": 78.0000,
        "max_radius_meters": 500.0
    })
    assert far_res.status_code == 200
    far_data = far_res.json()
    assert far_data["has_nearby_emergency"] is False
    assert far_data["distance_meters"] is None


# 19. Test Multi-Ambulance Triage and Safe Clearance Scheduling
def test_multi_ambulance_triage_and_queue_scheduling(client: TestClient):
    token = get_token(client, email="test_driver@routex.org", password="driver123")

    # Step 1: Create request 1 for AMB-01 at JNC-04 (STANDARD priority, LEFT lane)
    req1_res = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-01",
        "junction_id": "JNC-04",
        "direction": "LEFT",
        "triage_priority": "STANDARD",
        "duration_seconds": 30
    }, headers={"Authorization": f"Bearer {token}"})
    assert req1_res.status_code == 201
    req1_id = req1_res.json()["id"]

    # Gateway polls and activates priority for AMB-01
    poll1 = client.get("/api/hardware/pending-commands/JNC-04")
    assert poll1.status_code == 200
    assert poll1.json()["has_command"] is True
    assert poll1.json()["request_id"] == req1_id

    client.post("/api/hardware/acknowledge", json={
        "request_id": req1_id,
        "junction_id": "JNC-04",
        "status": "PRIORITY_ACTIVE",
        "signal_state": "PRIORITY_ACTIVE",
        "active_direction": "LEFT",
        "is_hardware_verified": True
    })

    # Step 2: AMB-02 arrives with CRITICAL priority approaching from STRAIGHT
    req2_res = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-02",
        "junction_id": "JNC-04",
        "direction": "STRAIGHT",
        "triage_priority": "CRITICAL",
        "duration_seconds": 25
    }, headers={"Authorization": f"Bearer {token}"})
    assert req2_res.status_code == 201
    req2_id = req2_res.json()["id"]

    # Step 3: Inspect real-time junction queue
    queue_res = client.get("/api/emergency/junction/JNC-04/queue")
    assert queue_res.status_code == 200
    q_data = queue_res.json()
    assert q_data["queue_length"] >= 2
    assert q_data["active_request"]["request_id"] == req1_id
    assert q_data["active_request"]["is_active_priority"] is True

    # Confirm CRITICAL request is queued next with documented clearance reason (non-preemption verified)
    queued = q_data["queued_requests"]
    assert len(queued) >= 1
    critical_item = next((item for item in queued if item["request_id"] == req2_id), None)
    assert critical_item is not None
    assert critical_item["triage_priority"] == "CRITICAL"
    assert "clearance" in critical_item["scheduling_reason"].lower()

    # Step 4: Complete active request AMB-01
    client.post("/api/hardware/acknowledge", json={
        "request_id": req1_id,
        "junction_id": "JNC-04",
        "status": "COMPLETED",
        "signal_state": "NORMAL_CYCLE",
        "is_hardware_verified": True
    })

    # Gateway polls next command: must now be the CRITICAL AMB-02 request
    poll_next = client.get("/api/hardware/pending-commands/JNC-04")
    assert poll_next.status_code == 200
    assert poll_next.json()["has_command"] is True
    assert poll_next.json()["request_id"] == req2_id



# 20. Test Operator Manual Queue Reorder
def test_queue_reorder_by_operator(client: TestClient):
    token = get_token(client, email="test_operator@routex.org", password="password123")

    # Queue reorder
    reorder_res = client.post("/api/emergency/junction/JNC-01/queue/reorder", json={
        "request_ids": ["test-id-1", "test-id-2"],
        "reason": "Mass casualty protocol activation"
    }, headers={"Authorization": f"Bearer {token}"})
    assert reorder_res.status_code == 200
    assert reorder_res.json()["junction_id"] == "JNC-01"


# 21. Test Communication Reliability Monitor Endpoints
def test_communication_reliability_monitor(client: TestClient):
    # System summary
    summary_res = client.get("/api/reliability/summary")
    assert summary_res.status_code == 200
    data = summary_res.json()
    assert "packet_delivery_rate" in data
    assert "crc_failures" in data
    assert "status_label" in data
    assert "notes" in data

    # Junction-specific telemetry
    jnc_res = client.get("/api/reliability/junction/JNC-01")
    assert jnc_res.status_code == 200
    assert jnc_res.json()["junction_id"] == "JNC-01"


# 22. Test CSV Export and Tamper-Evident Cryptographic Audit Ledger
def test_csv_export_and_cryptographic_audit_ledger(client: TestClient):
    # 22a. CSV Export
    csv_res = client.get("/api/analytics/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "attachment" in csv_res.headers["content-disposition"]
    csv_lines = csv_res.text.strip().split("\r\n") if "\r\n" in csv_res.text else csv_res.text.strip().split("\n")
    assert len(csv_lines) >= 1
    headers = csv_lines[0]
    assert "request_id" in headers
    assert "triage_priority" in headers
    assert "clearance_seconds" in headers

    # 22b. Audit Ledger Inspection
    db = TestingSessionLocal()
    from app.models import AuditLedgerEntry
    from app.routers.analytics import append_audit_ledger_entry
    if db.query(AuditLedgerEntry).count() == 0:
        append_audit_ledger_entry(db, "INITIAL_PROTOTYPE_SEEDED", "SYSTEM_TEST", "REQ-SEED-01", {"action": "seed"})
    db.close()

    ledger_res = client.get("/api/analytics/audit-ledger")
    assert ledger_res.status_code == 200
    entries = ledger_res.json()
    assert len(entries) >= 1
    first_entry = entries[0]
    assert first_entry["sequence_number"] == 1
    assert len(first_entry["entry_hash"]) == 64

    # 22c. Cryptographic Chain Verification
    verify_res = client.get("/api/analytics/audit-ledger/verify")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["is_ledger_intact"] is True
    assert verify_data["broken_sequence_index"] is None
    assert "verified" in verify_data["message"].lower()


# 23. Test Alert Delivery Retries, Retry Increment, and Failure Handling
def test_alert_delivery_retries_and_failure_handling(client: TestClient):
    import uuid
    # Subscribe an unacknowledged client
    client_uuid = f"retry-test-client-{uuid.uuid4().hex[:6]}"
    client.post("/api/alerts/subscribe", json={
        "client_uuid": client_uuid,
        "zone": "ZONE-HOSPITAL",
        "latitude": 28.62,
        "longitude": 77.21,
        "is_simulation": True
    })

    token = get_token(client, email="test_driver@routex.org", password="driver123")
    req_res = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-01",
        "junction_id": "JNC-02",
        "direction": "RIGHT",
        "duration_seconds": 60
    }, headers={"Authorization": f"Bearer {token}"})
    assert req_res.status_code == 201

    alerts_res = client.get("/api/alerts/active?zone=ZONE-HOSPITAL")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1
    alert_id = alerts[0]["id"]

    # Initial deliveries
    deliv_res = client.get(f"/api/alerts/{alert_id}/deliveries")
    assert deliv_res.status_code == 200
    delivs = deliv_res.json()
    test_d = next((d for d in delivs if d["recipient_identifier"] == client_uuid), None)
    assert test_d is not None
    assert test_d["status"] == "SENT"
    assert test_d["retry_count"] == 0

    # Retry pass 1
    p1 = client.post("/api/alerts/process-retries?max_retries=2")
    assert p1.status_code == 200
    d1 = client.get(f"/api/alerts/{alert_id}/deliveries").json()
    td1 = next(d for d in d1 if d["recipient_identifier"] == client_uuid)
    assert td1["retry_count"] == 1
    assert td1["status"] == "SENT"

    # Retry pass 2
    p2 = client.post("/api/alerts/process-retries?max_retries=2")
    assert p2.status_code == 200
    d2 = client.get(f"/api/alerts/{alert_id}/deliveries").json()
    td2 = next(d for d in d2 if d["recipient_identifier"] == client_uuid)
    assert td2["retry_count"] == 2
    assert td2["status"] == "SENT"

    # Retry pass 3 (exceeds max_retries=2 -> transitions to FAILED)
    p3 = client.post("/api/alerts/process-retries?max_retries=2")
    assert p3.status_code == 200
    d3 = client.get(f"/api/alerts/{alert_id}/deliveries").json()
    td3 = next(d for d in d3 if d["recipient_identifier"] == client_uuid)
    assert td3["status"] == "FAILED"
    assert "exceeded" in td3["failure_reason"].lower()


# 24. Test Analytics CSV Filters and Missing Data Resilience
def test_analytics_csv_filters_and_missing_data(client: TestClient):
    # Filter by specific ambulance
    res_amb = client.get("/api/analytics/export/csv?ambulance_id=AMB-01")
    assert res_amb.status_code == 200
    lines_amb = res_amb.text.strip().split("\n")
    assert len(lines_amb) >= 2  # Header + at least 1 record
    for line in lines_amb[1:]:
        cols = line.split(",")
        if len(cols) > 1 and cols[1]:
            assert cols[1] == "AMB-01"

    # Filter by junction
    res_jnc = client.get("/api/analytics/export/csv?junction_id=JNC-01")
    assert res_jnc.status_code == 200

    # Malformed date filter should be gracefully ignored without 500 error
    res_malformed = client.get("/api/analytics/export/csv?start_date=not-a-date&end_date=also-bad")
    assert res_malformed.status_code == 200


# 25. Test Tamper-Evident Audit Ledger Corruption Detection
def test_audit_ledger_tamper_detection(client: TestClient):
    db = TestingSessionLocal()
    from app.models import AuditLedgerEntry
    from app.routers.analytics import append_audit_ledger_entry
    if db.query(AuditLedgerEntry).count() == 0:
        append_audit_ledger_entry(db, "INITIAL_PROTOTYPE_SEEDED", "SYSTEM_TEST", "REQ-SEED-02", {"action": "seed"})
    
    # Verify initial intact state
    v1 = client.get("/api/analytics/audit-ledger/verify")
    assert v1.status_code == 200
    assert v1.json()["is_ledger_intact"] is True

    # Tamper with an existing ledger entry in the database directly
    entry = db.query(AuditLedgerEntry).order_by(AuditLedgerEntry.sequence_number.desc()).first()
    original_hash = entry.entry_hash
    tampered_seq = entry.sequence_number
    entry.entry_hash = "f" * 64  # Tampered malicious hash
    db.commit()

    # Re-verify: must catch the tampering!
    v2 = client.get("/api/analytics/audit-ledger/verify")
    assert v2.status_code == 200
    v2_data = v2.json()
    assert v2_data["is_ledger_intact"] is False
    assert v2_data["broken_sequence_index"] == tampered_seq

    # Restore the ledger entry so subsequent tests remain unaffected
    entry.entry_hash = original_hash
    db.commit()
    db.close()

    # Confirm restored integrity
    v3 = client.get("/api/analytics/audit-ledger/verify")
    assert v3.status_code == 200
    assert v3.json()["is_ledger_intact"] is True


# 26. Test Hospital Registry Endpoints
def test_hospital_registry_endpoints(client: TestClient):
    res = client.get("/api/hospitals")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    hosp_ids = [h["id"] for h in data]
    assert "HOSP-01" in hosp_ids
    assert "HOSP-02" in hosp_ids

    # Detail check
    h1 = client.get("/api/hospitals/HOSP-01")
    assert h1.status_code == 200
    h1_data = h1.json()
    assert h1_data["name"] == "City Emergency Trauma Center"
    assert h1_data["readiness_status"] == "TRAUMA_READY"
    assert h1_data["available_icu_beds"] == 12
    assert "Trauma Level 1" in h1_data["specialties"]

    # Not found
    h_none = client.get("/api/hospitals/NONEXISTENT")
    assert h_none.status_code == 404


# 27. Test Route Comparison Under Normal Conditions
def test_route_comparison_normal_conditions(client: TestClient):
    payload = {
        "start_junction_id": "JNC-01",
        "destination_junction_id": "JNC-05"
    }
    res = client.post("/api/hospitals/route/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["start_junction"] == "JNC-01"
    assert data["destination_junction"] == "JNC-05"
    assert data["time_saved_seconds"] == 0.0
    assert data["recommendation"] == "STANDARD_DISTANCE"
    assert data["algorithm_type"] == "Dijkstra Graph Shortest-Path / Weighted Edge Transit Model"
    assert data["is_simulated"] is True


# 28. Test Route Comparison with Congestion Bottleneck Diversion
def test_route_comparison_with_congestion_diversion(client: TestClient):
    payload = {
        "start_junction_id": "JNC-01",
        "destination_junction_id": "JNC-05",
        "congested_edges": [
            {
                "from_junction": "JNC-02",
                "to_junction": "JNC-04",
                "congestion_multiplier": 5.0
            }
        ]
    }
    res = client.post("/api/hospitals/route/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "standard_distance_route" in data
    assert "traffic_optimized_route" in data
    assert "decision_rationale" in data
    assert len(data["decision_rationale"]) > 10

    # Also test via junctions router alias
    alias_res = client.post("/api/junctions/route/compare", json=payload)
    assert alias_res.status_code == 200
    assert alias_res.json()["destination_junction"] == "JNC-05"


# 29. Test Route Comparison With Destination Hospital ID and Error Handling
def test_route_comparison_hospital_dest_and_errors(client: TestClient):
    # Valid destination hospital
    res = client.post("/api/hospitals/route/compare", json={
        "start_junction_id": "JNC-01",
        "destination_hospital_id": "HOSP-01"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["destination_junction"] == "JNC-05"
    assert data["destination_hospital"]["name"] == "City Emergency Trauma Center"

    # Nonexistent hospital
    res_err = client.post("/api/hospitals/route/compare", json={
        "start_junction_id": "JNC-01",
        "destination_hospital_id": "HOSP-999"
    })
    assert res_err.status_code == 404

    # Missing destination
    res_miss = client.post("/api/hospitals/route/compare", json={
        "start_junction_id": "JNC-01"
    })
    assert res_miss.status_code == 400


# 30. Test Ambulance Status Lifecycle & Trip Completion
def test_ambulance_status_lifecycle_and_trip_completion(client: TestClient):
    token = get_token(client, email="test_driver@routex.org", password="driver123")
    
    # 1. Check initial ambulance state
    amb_res = client.get("/api/ambulances/AMB-03")
    assert amb_res.status_code == 200
    assert amb_res.json()["status"] in ["IDLE", "EN_ROUTE"]

    # 2. Submit emergency request
    req_res = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-03",
        "junction_id": "JNC-05",
        "direction": "STRAIGHT",
        "triage_priority": "URGENT",
        "duration_seconds": 30
    }, headers={"Authorization": f"Bearer {token}"})
    assert req_res.status_code == 201
    req_data = req_res.json()
    req_id = req_data["id"]

    # 3. Verify ambulance transitioned to EN_ROUTE
    amb_res2 = client.get("/api/ambulances/AMB-03")
    assert amb_res2.status_code == 200
    assert amb_res2.json()["status"] == "EN_ROUTE"

    # 4. Safely complete trip upon hospital arrival
    comp_res = client.post(
        f"/api/emergency/requests/{req_id}/complete",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["status"] == "COMPLETED"
    assert comp_data["completed_at"] is not None

    # 5. Verify ambulance reverted to IDLE
    amb_res3 = client.get("/api/ambulances/AMB-03")
    assert amb_res3.status_code == 200
    assert amb_res3.json()["status"] == "IDLE"


# 31. Test Ambulance Maintenance Mode & Status Update
def test_ambulance_maintenance_mode(client: TestClient):
    op_token = get_token(client, email="test_operator@routex.org", password="password123")
    driver_token = get_token(client, email="test_driver@routex.org", password="driver123")

    # 1. Operator sets AMB-03 to MAINTENANCE
    patch_res = client.patch(
        "/api/ambulances/AMB-03/status",
        json={"status": "MAINTENANCE"},
        headers={"Authorization": f"Bearer {op_token}"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "MAINTENANCE"

    # 2. Driver attempts emergency dispatch - must be rejected
    dispatch_res = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-03",
        "junction_id": "JNC-04",
        "direction": "RIGHT",
        "duration_seconds": 20
    }, headers={"Authorization": f"Bearer {driver_token}"})
    assert dispatch_res.status_code == 400
    assert "MAINTENANCE" in dispatch_res.json()["detail"]

    # 3. Operator clears maintenance back to IDLE
    restore_res = client.patch(
        "/api/ambulances/AMB-03/status",
        json={"status": "IDLE"},
        headers={"Authorization": f"Bearer {op_token}"}
    )
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "IDLE"

    # 4. Dispatch now succeeds
    dispatch_ok = client.post("/api/emergency/request", json={
        "ambulance_id": "AMB-03",
        "junction_id": "JNC-04",
        "direction": "RIGHT",
        "duration_seconds": 20
    }, headers={"Authorization": f"Bearer {driver_token}"})
    assert dispatch_ok.status_code == 201
    active_req_id = dispatch_ok.json()["id"]

    # 5. Cancel request reverts back to IDLE
    cancel_res = client.post(
        f"/api/emergency/requests/{active_req_id}/cancel",
        json={"cancellation_reason": "Test unit release"},
        headers={"Authorization": f"Bearer {driver_token}"}
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    amb_final = client.get("/api/ambulances/AMB-03")
    assert amb_final.json()["status"] == "IDLE"


# 34. Test Google Gemini AI Advisory Integration
def test_ai_status_public_endpoint(client: TestClient):
    resp = client.get("/api/ai/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "is_configured" in data
    assert data["provider"] == "Google Gemini"
    assert "gemini" in data["model"].lower()
    assert "disclaimer" in data
    assert "api_key" not in data
    assert "key" not in data
    assert "secret" not in data


def test_ai_explain_route_unauthorized(client: TestClient):
    payload = {
        "origin": "JNC-01",
        "destination": "JNC-05",
        "calculated_distance_meters": 1600.0,
        "estimated_transit_seconds": 115.0,
        "route_junctions": ["JNC-01", "JNC-02", "JNC-03", "JNC-05"]
    }
    resp = client.post("/api/ai/explain-route", json=payload)
    assert resp.status_code == 401


def test_ai_explain_route_unconfigured_fallback(client: TestClient):
    token = get_token(client)
    with patch.object(ai_service, "_get_api_key", return_value=""):
        payload = {
            "origin": "JNC-01",
            "destination": "JNC-05",
            "calculated_distance_meters": 1600.0,
            "estimated_transit_seconds": 115.0,
            "route_junctions": ["JNC-01", "JNC-02", "JNC-03", "JNC-05"],
            "congestion_detected": True,
            "bottleneck_link": "JNC-02 -> JNC-04",
            "diversion_taken": True,
            "priority_level": "CRITICAL"
        }
        resp = client.post(
            "/api/ai/explain-route",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "UNCONFIGURED"
        assert data["is_advisory"] is True
        assert data["is_configured"] is False
        assert len(data["key_observations"]) > 0
        assert len(data["safety_recommendations"]) > 0
        assert "Dijkstra" in data["summary"] or "DETERMINISTIC" in data["summary"]


def test_ai_explain_route_with_mocked_gemini(client: TestClient):
    token = get_token(client)
    mock_response = MagicMock()
    mock_response.text = (
        "The selected corridor JNC-01 -> JNC-05 via Ring Road Flyover bypasses severe gridlock on the direct avenue. "
        "Estimated clearance will save approximately 48 seconds for critical patient delivery. "
        "Maintain preemption hold until vehicle clears JNC-03 stop line."
    )
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(ai_service, "is_configured", return_value=True), \
         patch.object(ai_service, "_get_client", return_value=mock_client):
        payload = {
            "origin": "JNC-01",
            "destination": "JNC-05",
            "calculated_distance_meters": 1600.0,
            "estimated_transit_seconds": 115.0,
            "route_junctions": ["JNC-01", "JNC-02", "JNC-03", "JNC-05"],
            "congestion_detected": False,
            "priority_level": "URGENT"
        }
        resp = client.post(
            "/api/ai/explain-route",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUCCESS"
        assert data["is_advisory"] is True
        assert data["is_configured"] is True
        assert "bypasses severe gridlock" in data["summary"]
        assert len(data["key_observations"]) > 0
        assert len(data["safety_recommendations"]) > 0


def test_ai_incident_summary_unconfigured_fallback(client: TestClient):
    token = get_token(client)
    with patch.object(ai_service, "_get_api_key", return_value=""):
        payload = {
            "request_id": "REQ-TEST-001",
            "ambulance_call_sign": "MEDIC-101",
            "triage_priority": "CRITICAL",
            "start_junction": "JNC-01",
            "target_junction": "JNC-05",
            "total_duration_seconds": 94.2,
            "status": "COMPLETED",
            "scheduling_reason": "Direct priority granted",
            "contending_vehicles_count": 0
        }
        resp = client.post(
            "/api/ai/incident-summary",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "UNCONFIGURED"
        assert data["is_advisory"] is True
        assert "MEDIC-101" in data["summary"]


def test_ai_explain_route_validation_error(client: TestClient):
    token = get_token(client)
    payload = {
        "origin": "J",
        "destination": "J",
        "calculated_distance_meters": -50.0,
        "estimated_transit_seconds": 10.0,
        "route_junctions": []
    }
    resp = client.post(
        "/api/ai/explain-route",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 422


def test_ai_service_key_validation_and_placeholder_rejection():
    from app.services.ai_service import ai_service

    # 1. Empty key should be unconfigured
    with patch.object(ai_service, "_get_api_key", return_value=""):
        assert ai_service.is_configured() is False
        status = ai_service.get_status()
        assert status.is_configured is False
        assert "UNCONFIGURED" in status.status_label

    # 2. Obvious placeholders should be unconfigured
    for placeholder in ["replace-with-key", "YOUR_REAL_KEY_ENTERED_LOCALLY", "placeholder_key", "dummy-123456", "short"]:
        with patch.object(ai_service, "_get_api_key", return_value=placeholder):
            assert ai_service.is_configured() is False

    # 3. Valid non-placeholder keys (including AIzaSy and AQ prefixes) should be recognized as configured
    for valid_key in ["AIzaSyValidDummyKeyForTestingOnly456", "AQ.A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z"]:
        with patch.object(ai_service, "_get_api_key", return_value=valid_key):
            assert ai_service.is_configured() is True
            status = ai_service.get_status()
            assert status.is_configured is True
            assert "ACTIVE" in status.status_label






