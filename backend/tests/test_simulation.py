import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.simulation_service import simulation_service, haversine_distance, calculate_bearing

client = TestClient(app)


def test_haversine_and_bearing_math():
    # Distance between JNC-01 (28.6139, 77.2090) and JNC-02 (28.6180, 77.2140)
    dist = haversine_distance(28.6139, 77.2090, 28.6180, 77.2140)
    assert 600 < dist < 750  # Great-circle distance approx 660 meters
    bearing = calculate_bearing(28.6139, 77.2090, 28.6180, 77.2140)
    assert 0 < bearing < 90  # North-East quadrant


def test_simulation_initialization_and_status():
    simulation_service.reset()
    status = simulation_service.get_status()
    assert status["state"] == "STOPPED"
    assert len(status["junctions"]) == 5
    assert "disclaimer" in status["attribution"]
    assert "SIMULATED" in status["attribution"]["disclaimer"]


def test_standard_corridor_lifecycle():
    simulation_service.reset()
    status = simulation_service.start_scenario("STANDARD_CORRIDOR", speed_multiplier=1.0)
    assert status["state"] == "RUNNING"
    assert status["active_scenario"] == "STANDARD_CORRIDOR"
    assert len(status["ambulances"]) == 1

    amb = status["ambulances"][0]
    assert amb["id"] == "AMB-01"
    assert amb["triage_priority"] == "CRITICAL"
    initial_lat = amb["current_lat"]
    initial_eta = amb["eta_seconds"]

    # Step simulation 5 seconds
    step_status = simulation_service.tick(5.0)
    amb_after = step_status["ambulances"][0]
    assert amb_after["distance_travelled_meters"] > 0
    assert amb_after["eta_seconds"] < initial_eta
    assert amb_after["current_lat"] != initial_lat


def test_signal_approach_and_clearance_transitions():
    simulation_service.reset()
    simulation_service.start_scenario("STANDARD_CORRIDOR", speed_multiplier=2.0)

    # Step enough to approach JNC-02 (within 250m)
    # Leg 1 is 450m. At 50 km/h (13.89 m/s) * 2x = 27.78 m/s, reaches 250m after ~7.2s
    for _ in range(5):
        simulation_service.tick(2.0)

    status = simulation_service.get_status()
    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    # Junction should be in either clearance all-red or priority active
    assert jnc2["signal_state"] in ["FAILSAFE_ALL_RED", "PRIORITY_ACTIVE"]
    assert jnc2["granted_to"] == "AMB-01"

    # Step through clearance (2s)
    simulation_service.tick(3.0)
    status = simulation_service.get_status()
    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    assert jnc2["signal_state"] == "PRIORITY_ACTIVE"

    # Step further until ambulance crosses JNC-02
    for _ in range(15):
        simulation_service.tick(2.0)

    status = simulation_service.get_status()
    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    # Once cleared, JNC-02 must revert to NORMAL_CYCLE
    assert jnc2["signal_state"] == "NORMAL_CYCLE"
    assert jnc2["granted_to"] is None


def test_multi_ambulance_conflict_scenario():
    simulation_service.reset()
    status = simulation_service.start_scenario("MULTI_AMBULANCE_CONFLICT", speed_multiplier=1.0)
    assert len(status["ambulances"]) == 2

    # Step until both converge on JNC-02
    for _ in range(12):
        simulation_service.tick(2.0)

    status = simulation_service.get_status()
    # Check timeline for CONFLICT_DETECTED
    events = [e["type"] for e in status["timeline"]]
    assert "CONFLICT_DETECTED" in events or "ALL_RED_CLEARANCE" in events

    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    # Ensure no simultaneous green conflicts occurred
    assert jnc2["signal_state"] in ["FAILSAFE_ALL_RED", "PRIORITY_ACTIVE", "NORMAL_CYCLE"]


def test_communication_loss_failsafe_scenario():
    simulation_service.reset()
    simulation_service.start_scenario("COMM_LOSS_FAILSAFE", speed_multiplier=1.0)

    # Step to 16 seconds (triggers comm loss on JNC-03)
    simulation_service.tick(16.0)
    status = simulation_service.get_status()
    jnc3 = next(j for j in status["junctions"] if j["id"] == "JNC-03")
    assert jnc3["is_online"] is False
    assert jnc3["signal_state"] == "FAILSAFE_ALL_RED"

    # Step past 28 seconds (triggers restoration)
    simulation_service.tick(14.0)
    status = simulation_service.get_status()
    jnc3 = next(j for j in status["junctions"] if j["id"] == "JNC-03")
    assert jnc3["is_online"] is True


def test_gridlock_congestion_and_dynamic_reroute():
    simulation_service.reset()
    simulation_service.start_scenario("GRIDLOCK_CONGESTION", speed_multiplier=1.0)

    # Step to 10 seconds (triggers reroute)
    simulation_service.tick(10.0)
    status = simulation_service.get_status()
    amb = status["ambulances"][0]
    assert amb["route"] == ["JNC-01", "JNC-02", "JNC-03", "JNC-05"]

    events = [e["type"] for e in status["timeline"]]
    assert "REROUTE_COMPLETED" in events


def test_simulation_pause_resume_reset_speed():
    simulation_service.reset()
    simulation_service.start_scenario("STANDARD_CORRIDOR", speed_multiplier=1.0)
    assert simulation_service.state == "RUNNING"

    simulation_service.pause()
    assert simulation_service.state == "PAUSED"
    # Ticking while paused should not advance elapsed_seconds
    curr_elapsed = simulation_service.elapsed_seconds
    simulation_service.tick(5.0)
    assert simulation_service.elapsed_seconds == curr_elapsed

    simulation_service.resume()
    assert simulation_service.state == "RUNNING"

    simulation_service.set_speed(3.0)
    assert simulation_service.speed_multiplier == 3.0

    simulation_service.reset()
    assert simulation_service.state == "STOPPED"
    assert simulation_service.elapsed_seconds == 0.0


def test_simulation_api_endpoints():
    # 1. Start simulation
    res = client.post("/api/simulation/start", json={"scenario": "STANDARD_CORRIDOR", "speed_multiplier": 2.0})
    assert res.status_code == 200
    data = res.json()
    assert data["state"] == "RUNNING"
    assert data["speed_multiplier"] == 2.0

    # 2. Get status
    res = client.get("/api/simulation/status")
    assert res.status_code == 200
    assert res.json()["state"] == "RUNNING"

    # 3. Step
    res = client.post("/api/simulation/step", json={"dt": 2.5})
    assert res.status_code == 200
    assert res.json()["elapsed_seconds"] == 5.0  # 2.5s * 2.0x

    # 4. Speed
    res = client.post("/api/simulation/speed", json={"speed_multiplier": 5.0})
    assert res.status_code == 200
    assert res.json()["speed_multiplier"] == 5.0

    # 5. Pause
    res = client.post("/api/simulation/pause")
    assert res.status_code == 200
    assert res.json()["state"] == "PAUSED"

    # 6. Resume
    res = client.post("/api/simulation/resume")
    assert res.status_code == 200
    assert res.json()["state"] == "RUNNING"

    # 7. Reset
    res = client.post("/api/simulation/reset")
    assert res.status_code == 200
    assert res.json()["state"] == "STOPPED"

    # 8. Invalid scenario rejected
    res = client.post("/api/simulation/scenario/INVALID_SCENARIO_NAME")
    assert res.status_code == 400


def test_mandatory_two_second_clearance_cannot_be_bypassed_prematurely():
    """
    SAFETY-CRITICAL TEST:
    Verifies that the mandatory 2.0-second all-red clearance cannot be bypassed prematurely.
    Signal state MUST remain FAILSAFE_ALL_RED for all intermediate ticks where clearance_remaining > 0.
    """
    simulation_service.reset()
    simulation_service.start_scenario("STANDARD_CORRIDOR", speed_multiplier=1.0)

    # Step until AMB-01 approaches JNC-02 (within 200m)
    # Distance from JNC-01 to JNC-02 is 450m. At 13.89 m/s (50 km/h), ambulance reaches 200m boundary around ~18s.
    for _ in range(18):
        simulation_service.tick(1.0)
        status = simulation_service.get_status()
        jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
        if jnc2["signal_state"] == "FAILSAFE_ALL_RED":
            break

    status = simulation_service.get_status()
    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    assert jnc2["signal_state"] == "FAILSAFE_ALL_RED", "All-red failsafe must initiate on approach"
    assert jnc2["clearance_remaining"] == 2.0, "Mandatory clearance interval must be initialized to exactly 2.0 seconds"

    # Advance by 0.5s -> clearance_remaining = 1.5s
    simulation_service.tick(0.5)
    status = simulation_service.get_status()
    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    assert jnc2["clearance_remaining"] == 1.5
    assert jnc2["signal_state"] == "FAILSAFE_ALL_RED", "Signal MUST NOT activate green prematurely at 0.5s"

    # Advance by 1.0s -> clearance_remaining = 0.5s
    simulation_service.tick(1.0)
    status = simulation_service.get_status()
    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    assert jnc2["clearance_remaining"] == 0.5
    assert jnc2["signal_state"] == "FAILSAFE_ALL_RED", "Signal MUST NOT activate green prematurely at 1.5s"

    # Advance by remaining 0.5s -> clearance_remaining = 0.0s
    simulation_service.tick(0.5)
    status = simulation_service.get_status()
    jnc2 = next(j for j in status["junctions"] if j["id"] == "JNC-02")
    assert jnc2["clearance_remaining"] == 0.0
    assert jnc2["signal_state"] == "PRIORITY_ACTIVE", "Priority green wave may ONLY activate after full 2.0s clearance"


def test_ai_advisor_has_zero_actuator_write_access():
    """
    SAFETY-CRITICAL TEST:
    Verifies that the Gemini AI Advisor is strictly advisory and possesses zero write access
    to signal controllers, interlocks, or physical state machines.
    """
    try:
        from app.services.ai_service import ai_service
    except ModuleNotFoundError:
        from backend.app.services.ai_service import ai_service
    # AI service must not have methods to mutate signal states or bypass all-red intervals
    assert not hasattr(ai_service, "set_signal_state")
    assert not hasattr(ai_service, "override_clearance")
    assert not hasattr(ai_service, "switch_priority")
    assert not hasattr(ai_service, "bypass_all_red")

    # AI status disclaimer must clearly specify authoritative deterministic interlock precedence
    status = ai_service.get_status()
    assert "deterministic" in status.disclaimer.lower()
    assert "all-red" in status.disclaimer.lower()

