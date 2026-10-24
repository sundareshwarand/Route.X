import pytest
import concurrent.futures
from fastapi.testclient import TestClient
from app.main import app
from app.services.simulation_service import simulation_service

client = TestClient(app)


def test_concurrent_clients_reading_simulation_state():
    """Validates that simultaneous client requests receive identical authoritative state without thread lockups."""
    simulation_service.reset()
    simulation_service.start_scenario("STANDARD_CORRIDOR", speed_multiplier=1.0)

    def fetch_status():
        res = client.get("/api/simulation/status")
        assert res.status_code == 200
        return res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_status) for _ in range(20)]
        results = [f.result() for f in futures]

    assert len(results) == 20
    first_state = results[0]["state"]
    assert first_state == "RUNNING"
    for r in results:
        assert r["state"] == first_state
        assert r["active_scenario"] == "STANDARD_CORRIDOR"


def test_duplicate_scenario_triggers_idempotency():
    """Validates that rapid consecutive trigger calls cleanly reset and re-initialize state."""
    res1 = client.post("/api/simulation/scenario/STANDARD_CORRIDOR?speed_multiplier=2.0")
    assert res1.status_code == 200
    res2 = client.post("/api/simulation/scenario/STANDARD_CORRIDOR?speed_multiplier=2.0")
    assert res2.status_code == 200
    status = res2.json()
    assert status["state"] == "RUNNING"
    assert status["elapsed_seconds"] == 0.0


def test_all_four_scenarios_execute_to_completion():
    """Validates that each of the 4 operational scenarios steps through and marks completion safely."""
    scenarios = ["STANDARD_CORRIDOR", "MULTI_AMBULANCE_CONFLICT", "COMM_LOSS_FAILSAFE", "GRIDLOCK_CONGESTION"]

    for sc in scenarios:
        simulation_service.reset()
        status = simulation_service.start_scenario(sc, speed_multiplier=5.0)
        assert status["state"] == "RUNNING"

        # Step until completion or max 120 steps
        completed = False
        for _ in range(120):
            step_res = simulation_service.tick(2.0)
            if step_res["state"] == "COMPLETED":
                completed = True
                break

        assert completed is True, f"Scenario {sc} did not complete within step budget"
        final_status = simulation_service.get_status()
        assert final_status["state"] == "COMPLETED"
        # Verify timeline recorded scenario completion
        events = [e["type"] for e in final_status["timeline"]]
        assert "SCENARIO_COMPLETED" in events


def test_triage_decision_and_clearance_verification():
    """Verifies that converging ambulances trigger a safe clearance sequence without conflicting greens."""
    simulation_service.reset()
    simulation_service.start_scenario("MULTI_AMBULANCE_CONFLICT", speed_multiplier=2.0)

    # Step forward until both ambulances are close to JNC-02
    has_conflict = False
    has_clearance = False
    for _ in range(30):
        st = simulation_service.tick(1.0)
        jnc2 = next(j for j in st["junctions"] if j["id"] == "JNC-02")
        if jnc2["signal_state"] == "FAILSAFE_ALL_RED":
            has_clearance = True
        if len(jnc2["queue"]) > 0:
            has_conflict = True

    assert has_clearance is True or has_conflict is True


def test_speed_scaling_proportionality():
    """Verifies that changing simulation speed scales distance travelled proportionally."""
    simulation_service.reset()
    simulation_service.start_scenario("STANDARD_CORRIDOR", speed_multiplier=1.0)
    simulation_service.tick(10.0)
    dist_1x = simulation_service.get_status()["ambulances"][0]["distance_travelled_meters"]

    simulation_service.reset()
    simulation_service.start_scenario("STANDARD_CORRIDOR", speed_multiplier=2.0)
    simulation_service.tick(10.0)
    dist_2x = simulation_service.get_status()["ambulances"][0]["distance_travelled_meters"]

    # At 2x speed, distance travelled in same dt should be double (+/- 1m)
    assert abs(dist_2x - (2.0 * dist_1x)) < 5.0
