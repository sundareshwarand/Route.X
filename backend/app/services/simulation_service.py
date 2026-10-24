import asyncio
import math
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

logger = logging.getLogger("routex.simulation")

# Real coordinates for the municipal emergency corridor testbed
JUNCTION_COORDINATES: Dict[str, Dict[str, Any]] = {
    "JNC-01": {"name": "Central Avenue - 5th Cross", "lat": 28.6139, "lon": 77.2090, "zone": "ZONE-CENTRAL"},
    "JNC-02": {"name": "Metro Hospital Intersection", "lat": 28.6180, "lon": 77.2140, "zone": "ZONE-HOSPITAL"},
    "JNC-03": {"name": "Ring Road Flyover Junction", "lat": 28.6220, "lon": 77.2190, "zone": "ZONE-NORTH"},
    "JNC-04": {"name": "Tech Boulevard Crossing", "lat": 28.6250, "lon": 77.2250, "zone": "ZONE-TECH"},
    "JNC-05": {"name": "Emergency Trauma Corridor Exit", "lat": 28.6300, "lon": 77.2300, "zone": "ZONE-HOSPITAL"},
}

JUNCTION_EDGES: Dict[str, Dict[str, float]] = {
    "JNC-01": {"JNC-02": 450.0, "JNC-03": 800.0},
    "JNC-02": {"JNC-01": 450.0, "JNC-03": 550.0, "JNC-04": 700.0},
    "JNC-03": {"JNC-01": 800.0, "JNC-02": 550.0, "JNC-05": 600.0},
    "JNC-04": {"JNC-02": 700.0, "JNC-05": 400.0},
    "JNC-05": {"JNC-03": 600.0, "JNC-04": 400.0},
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance in meters between two lat/lon coordinates."""
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates directional bearing in degrees [0, 360) from point 1 to point 2."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    initial_bearing = math.degrees(math.atan2(y, x))
    return (initial_bearing + 360.0) % 360.0


Tuple_Float = tuple[float, float]


def interpolate_position(lat1: float, lon1: float, lat2: float, lon2: float, fraction: float) -> Tuple_Float:
    """Interpolates coordinates between two points given fraction in [0.0, 1.0]."""
    f = max(0.0, min(1.0, fraction))
    return (lat1 + f * (lat2 - lat1), lon1 + f * (lon2 - lon1))


class SimulationService:
    """
    Authoritative In-Memory Simulation Engine for RouteX.
    Manages deterministic vehicle physics, automatic distance-based signal preemption,
    all-red clearance intervals, multi-ambulance conflict triage, and scenario execution.
    """

    def __init__(self):
        self.state = "STOPPED"  # STOPPED, RUNNING, PAUSED, COMPLETED
        self.active_scenario = "STANDARD_CORRIDOR"
        self.speed_multiplier = 1.0  # 1x, 2x, 5x
        self.elapsed_seconds = 0.0
        self.ambulances: Dict[str, Dict[str, Any]] = {}
        self.junctions: Dict[str, Dict[str, Any]] = {}
        self.timeline: List[Dict[str, Any]] = []
        self._bg_task: Optional[asyncio.Task] = None

        self._init_junctions()

    def _init_junctions(self):
        self.junctions = {}
        for j_id, meta in JUNCTION_COORDINATES.items():
            self.junctions[j_id] = {
                "id": j_id,
                "name": meta["name"],
                "lat": meta["lat"],
                "lon": meta["lon"],
                "zone": meta["zone"],
                "signal_state": "NORMAL_CYCLE",  # NORMAL_CYCLE, FAILSAFE_ALL_RED, PRIORITY_ACTIVE
                "active_direction": None,
                "granted_to": None,
                "clearance_remaining": 0.0,
                "is_online": True,
                "queue": [],
                "phase_seconds_remaining": 20.0
            }

    def _add_timeline_event(self, event_type: str, description: str, junction_id: Optional[str] = None, ambulance_id: Optional[str] = None, extra: Optional[Dict[str, Any]] = None):
        event = {
            "id": f"evt-{uuid.uuid4().hex[:8]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sim_time": round(self.elapsed_seconds, 2),
            "type": event_type,
            "description": description,
            "junction_id": junction_id,
            "ambulance_id": ambulance_id,
            "source": "SIMULATED",
            "metadata": extra or {}
        }
        self.timeline.append(event)
        if len(self.timeline) > 100:
            self.timeline.pop(0)

    def start_scenario(self, scenario_name: str = "STANDARD_CORRIDOR", speed_multiplier: float = 1.0) -> Dict[str, Any]:
        """Initializes and starts one of the 4 operational test scenarios."""
        self.reset()
        self.active_scenario = scenario_name
        self.speed_multiplier = max(0.5, min(10.0, speed_multiplier))
        self.state = "RUNNING"
        self.elapsed_seconds = 0.0

        if scenario_name == "STANDARD_CORRIDOR":
            self._setup_standard_corridor()
        elif scenario_name == "MULTI_AMBULANCE_CONFLICT":
            self._setup_multi_ambulance_conflict()
        elif scenario_name == "COMM_LOSS_FAILSAFE":
            self._setup_comm_loss_scenario()
        elif scenario_name == "GRIDLOCK_CONGESTION":
            self._setup_gridlock_scenario()
        else:
            self._setup_standard_corridor()

        self._add_timeline_event("SCENARIO_STARTED", f"Scenario '{self.active_scenario}' initialized at {self.speed_multiplier}x simulation speed.")
        self._ensure_ticker_running()
        return self.get_status()

    async def _run_ticker(self):
        try:
            while self.state == "RUNNING":
                interval = max(0.2, 1.0 / self.speed_multiplier)
                await asyncio.sleep(interval)
                if self.state == "RUNNING":
                    status_data = self.tick(1.0)
                    try:
                        from .ws_manager import ws_manager
                        await ws_manager.broadcast("SIMULATION_TICK", status_data)
                    except Exception:
                        pass
        except asyncio.CancelledError:
            pass

    def _ensure_ticker_running(self):
        self._stop_ticker()
        try:
            loop = asyncio.get_running_loop()
            self._bg_task = loop.create_task(self._run_ticker())
        except RuntimeError:
            self._bg_task = None

    def _stop_ticker(self):
        if self._bg_task and not self._bg_task.done():
            self._bg_task.cancel()
            self._bg_task = None

    def _setup_standard_corridor(self):
        # AMB-01 travels JNC-01 -> JNC-02 -> JNC-03 -> JNC-05 (Trauma corridor)
        route = ["JNC-01", "JNC-02", "JNC-03", "JNC-05"]
        total_dist = 450.0 + 550.0 + 600.0  # 1600m
        self.ambulances["AMB-01"] = {
            "id": "AMB-01",
            "call_sign": "MEDIC-101",
            "vehicle_type": "Advanced Life Support",
            "current_lat": JUNCTION_COORDINATES["JNC-01"]["lat"],
            "current_lon": JUNCTION_COORDINATES["JNC-01"]["lon"],
            "heading": calculate_bearing(
                JUNCTION_COORDINATES["JNC-01"]["lat"], JUNCTION_COORDINATES["JNC-01"]["lon"],
                JUNCTION_COORDINATES["JNC-02"]["lat"], JUNCTION_COORDINATES["JNC-02"]["lon"]
            ),
            "speed_kmh": 50.0,
            "route": route,
            "current_leg_index": 0,
            "leg_progress": 0.0,
            "distance_travelled_meters": 0.0,
            "total_distance_meters": total_dist,
            "remaining_distance_meters": total_dist,
            "eta_seconds": int(total_dist / (50.0 * 1000.0 / 3600.0)),
            "approaching_junction": "JNC-02",
            "distance_to_junction": 450.0,
            "triage_priority": "CRITICAL",
            "status": "EN_ROUTE",
            "is_simulated": True
        }
        self._add_timeline_event("DISPATCH", "AMB-01 dispatched on Emergency Route (JNC-01 -> JNC-05)", ambulance_id="AMB-01")

    def _setup_multi_ambulance_conflict(self):
        # AMB-01 approaches JNC-02 from West (JNC-01) with CRITICAL priority
        # AMB-02 approaches JNC-02 from North (JNC-03) with URGENT priority
        route1 = ["JNC-01", "JNC-02", "JNC-04"]
        dist1 = 450.0 + 700.0
        self.ambulances["AMB-01"] = {
            "id": "AMB-01",
            "call_sign": "MEDIC-101",
            "vehicle_type": "Cardiac Care Unit",
            "current_lat": JUNCTION_COORDINATES["JNC-01"]["lat"],
            "current_lon": JUNCTION_COORDINATES["JNC-01"]["lon"],
            "heading": calculate_bearing(
                JUNCTION_COORDINATES["JNC-01"]["lat"], JUNCTION_COORDINATES["JNC-01"]["lon"],
                JUNCTION_COORDINATES["JNC-02"]["lat"], JUNCTION_COORDINATES["JNC-02"]["lon"]
            ),
            "speed_kmh": 50.0,
            "route": route1,
            "current_leg_index": 0,
            "leg_progress": 0.0,
            "distance_travelled_meters": 0.0,
            "total_distance_meters": dist1,
            "remaining_distance_meters": dist1,
            "eta_seconds": int(dist1 / (50.0 * 1000.0 / 3600.0)),
            "approaching_junction": "JNC-02",
            "distance_to_junction": 450.0,
            "triage_priority": "CRITICAL",
            "status": "EN_ROUTE",
            "is_simulated": True
        }

        route2 = ["JNC-03", "JNC-02", "JNC-01"]
        dist2 = 550.0 + 450.0
        self.ambulances["AMB-02"] = {
            "id": "AMB-02",
            "call_sign": "RESCUE-202",
            "vehicle_type": "Trauma Critical Care",
            "current_lat": JUNCTION_COORDINATES["JNC-03"]["lat"],
            "current_lon": JUNCTION_COORDINATES["JNC-03"]["lon"],
            "heading": calculate_bearing(
                JUNCTION_COORDINATES["JNC-03"]["lat"], JUNCTION_COORDINATES["JNC-03"]["lon"],
                JUNCTION_COORDINATES["JNC-02"]["lat"], JUNCTION_COORDINATES["JNC-02"]["lon"]
            ),
            "speed_kmh": 48.0,
            "route": route2,
            "current_leg_index": 0,
            "leg_progress": 0.0,
            "distance_travelled_meters": 0.0,
            "total_distance_meters": dist2,
            "remaining_distance_meters": dist2,
            "eta_seconds": int(dist2 / (48.0 * 1000.0 / 3600.0)),
            "approaching_junction": "JNC-02",
            "distance_to_junction": 550.0,
            "triage_priority": "URGENT",
            "status": "EN_ROUTE",
            "is_simulated": True
        }
        self._add_timeline_event("DISPATCH", "AMB-01 (CRITICAL) and AMB-02 (URGENT) converge towards JNC-02.", junction_id="JNC-02")

    def _setup_comm_loss_scenario(self):
        self._setup_standard_corridor()
        self._add_timeline_event("SCENARIO_SETUP", "Communication loss scheduled at Ring Road Flyover (JNC-03) at T+15s.", junction_id="JNC-03")

    def _setup_gridlock_scenario(self):
        # AMB-01 planned via JNC-01 -> JNC-02 -> JNC-04 -> JNC-05
        route = ["JNC-01", "JNC-02", "JNC-04", "JNC-05"]
        total_dist = 450.0 + 700.0 + 400.0  # 1550m
        self.ambulances["AMB-01"] = {
            "id": "AMB-01",
            "call_sign": "MEDIC-101",
            "vehicle_type": "Advanced Life Support",
            "current_lat": JUNCTION_COORDINATES["JNC-01"]["lat"],
            "current_lon": JUNCTION_COORDINATES["JNC-01"]["lon"],
            "heading": calculate_bearing(
                JUNCTION_COORDINATES["JNC-01"]["lat"], JUNCTION_COORDINATES["JNC-01"]["lon"],
                JUNCTION_COORDINATES["JNC-02"]["lat"], JUNCTION_COORDINATES["JNC-02"]["lon"]
            ),
            "speed_kmh": 45.0,
            "route": route,
            "current_leg_index": 0,
            "leg_progress": 0.0,
            "distance_travelled_meters": 0.0,
            "total_distance_meters": total_dist,
            "remaining_distance_meters": total_dist,
            "eta_seconds": int(total_dist / (45.0 * 1000.0 / 3600.0)),
            "approaching_junction": "JNC-02",
            "distance_to_junction": 450.0,
            "triage_priority": "CRITICAL",
            "status": "EN_ROUTE",
            "is_simulated": True
        }
        self._add_timeline_event("SCENARIO_SETUP", "Gridlock simulation primed on link JNC-02 -> JNC-04.", junction_id="JNC-02")

    def pause(self) -> Dict[str, Any]:
        if self.state == "RUNNING":
            self.state = "PAUSED"
            self._stop_ticker()
            self._add_timeline_event("SIMULATION_PAUSED", f"Simulation paused at T+{round(self.elapsed_seconds, 1)}s.")
        return self.get_status()

    def resume(self) -> Dict[str, Any]:
        if self.state == "PAUSED":
            self.state = "RUNNING"
            self._add_timeline_event("SIMULATION_RESUMED", f"Simulation resumed at T+{round(self.elapsed_seconds, 1)}s.")
            self._ensure_ticker_running()
        return self.get_status()

    def reset(self) -> Dict[str, Any]:
        self.state = "STOPPED"
        self._stop_ticker()
        self.elapsed_seconds = 0.0
        self.ambulances = {}
        self._init_junctions()
        self.timeline.clear()
        self._add_timeline_event("SIMULATION_RESET", "Simulation engine reset to baseline operational state.")
        return self.get_status()

    def set_speed(self, multiplier: float) -> Dict[str, Any]:
        self.speed_multiplier = max(0.5, min(10.0, multiplier))
        self._add_timeline_event("SPEED_CHANGED", f"Simulation speed adjusted to {self.speed_multiplier}x.")
        return self.get_status()

    def tick(self, dt: float) -> Dict[str, Any]:
        """
        Advances the simulation authoritatively by dt seconds (scaled by speed_multiplier).
        Calculates waypoint interpolation, distance thresholds, safety clearance intervals,
        and priority green state transitions.
        """
        if self.state != "RUNNING":
            return self.get_status()

        effective_dt = dt * self.speed_multiplier
        self.elapsed_seconds += effective_dt

        # 1. Check Scenario-specific temporal events
        self._evaluate_scenario_triggers()

        # 2. Update Junction clearance timers
        for j_id, j in self.junctions.items():
            if j["clearance_remaining"] > 0:
                j["clearance_remaining"] = max(0.0, j["clearance_remaining"] - effective_dt)
                if j["clearance_remaining"] == 0 and j["signal_state"] == "FAILSAFE_ALL_RED" and j["granted_to"]:
                    # Clearance interval completed! Activate priority green
                    j["signal_state"] = "PRIORITY_ACTIVE"
                    self._add_timeline_event(
                        "PRIORITY_GREEN",
                        f"Priority green wave activated at {j['name']} ({j_id}) for {j['granted_to']}.",
                        junction_id=j_id,
                        ambulance_id=j["granted_to"]
                    )

        # 3. Advance Ambulances
        all_completed = True
        for amb_id, amb in list(self.ambulances.items()):
            if amb["status"] == "ARRIVED":
                continue

            all_completed = False
            route = amb["route"]
            leg_idx = amb["current_leg_index"]

            if leg_idx >= len(route) - 1:
                amb["status"] = "ARRIVED"
                self._add_timeline_event(
                    "ARRIVAL",
                    f"{amb['call_sign']} ({amb_id}) arrived at destination {route[-1]}.",
                    junction_id=route[-1],
                    ambulance_id=amb_id
                )
                continue

            from_j = route[leg_idx]
            to_j = route[leg_idx + 1]

            from_coord = JUNCTION_COORDINATES[from_j]
            to_coord = JUNCTION_COORDINATES[to_j]
            leg_distance = JUNCTION_EDGES.get(from_j, {}).get(to_j, 500.0)

            speed_mps = (amb["speed_kmh"] * 1000.0) / 3600.0
            distance_step = speed_mps * effective_dt

            amb["distance_travelled_meters"] += distance_step
            amb["remaining_distance_meters"] = max(0.0, amb["total_distance_meters"] - amb["distance_travelled_meters"])
            amb["eta_seconds"] = int(amb["remaining_distance_meters"] / speed_mps) if speed_mps > 0 else 0

            # Leg fraction
            dist_on_leg = amb["leg_progress"] * leg_distance + distance_step
            if dist_on_leg >= leg_distance:
                # Crossed junction
                amb["current_leg_index"] += 1
                amb["leg_progress"] = 0.0

                # Revert junction signal as ambulance clears
                junction = self.junctions.get(to_j)
                if junction and junction["granted_to"] == amb_id:
                    self._revert_junction_signal(to_j, amb_id)

                if amb["current_leg_index"] >= len(route) - 1:
                    amb["current_lat"] = to_coord["lat"]
                    amb["current_lon"] = to_coord["lon"]
                    amb["status"] = "ARRIVED"
                    self._add_timeline_event(
                        "ARRIVAL",
                        f"{amb['call_sign']} ({amb_id}) arrived at destination {to_j}.",
                        junction_id=to_j,
                        ambulance_id=amb_id
                    )
                else:
                    next_target = route[amb["current_leg_index"] + 1]
                    amb["approaching_junction"] = next_target
                    amb["heading"] = calculate_bearing(
                        to_coord["lat"], to_coord["lon"],
                        JUNCTION_COORDINATES[next_target]["lat"], JUNCTION_COORDINATES[next_target]["lon"]
                    )
            else:
                amb["leg_progress"] = dist_on_leg / leg_distance
                interp_lat, interp_lon = interpolate_position(
                    from_coord["lat"], from_coord["lon"],
                    to_coord["lat"], to_coord["lon"],
                    amb["leg_progress"]
                )
                amb["current_lat"] = interp_lat
                amb["current_lon"] = interp_lon
                amb["heading"] = calculate_bearing(
                    from_coord["lat"], from_coord["lon"],
                    to_coord["lat"], to_coord["lon"]
                )
                dist_to_j = leg_distance - dist_on_leg
                amb["distance_to_junction"] = dist_to_j
                amb["approaching_junction"] = to_j

                # Signal preemption trigger: within 250m
                if dist_to_j <= 250.0:
                    self._handle_approach_preemption(amb, to_j)

        if all_completed and len(self.ambulances) > 0 and self.state == "RUNNING":
            self.state = "COMPLETED"
            self._stop_ticker()
            self._add_timeline_event("SCENARIO_COMPLETED", f"Scenario '{self.active_scenario}' successfully completed in {round(self.elapsed_seconds, 1)}s.")

        return self.get_status()

    def _handle_approach_preemption(self, amb: Dict[str, Any], junction_id: str):
        junction = self.junctions.get(junction_id)
        if not junction or not junction["is_online"]:
            return

        amb_id = amb["id"]
        # Already granted to this ambulance?
        if junction["granted_to"] == amb_id:
            return

        # Check if already granted to another ambulance (CONFLICT)
        if junction["signal_state"] == "PRIORITY_ACTIVE" and junction["granted_to"] != amb_id:
            other_amb = self.ambulances.get(junction["granted_to"], {})
            # Triage priority comparison
            p_curr = 3 if other_amb.get("triage_priority") == "CRITICAL" else 2 if other_amb.get("triage_priority") == "URGENT" else 1
            p_new = 3 if amb.get("triage_priority") == "CRITICAL" else 2 if amb.get("triage_priority") == "URGENT" else 1

            if amb_id not in junction["queue"]:
                junction["queue"].append(amb_id)
                self._add_timeline_event(
                    "CONFLICT_DETECTED",
                    f"Traffic contention at {junction['name']} ({junction_id}): {amb['call_sign']} ({amb['triage_priority']}) queued behind active {other_amb.get('call_sign', junction['granted_to'])} ({other_amb.get('triage_priority')}).",
                    junction_id=junction_id,
                    ambulance_id=amb_id,
                    extra={"triage_reason": "Non-preemption safety rule: active green must clear safely."}
                )
            return

        # Not occupied: Initiate All-Red Clearance Interval (2.0s)
        junction["signal_state"] = "FAILSAFE_ALL_RED"
        junction["clearance_remaining"] = 2.0
        junction["granted_to"] = amb_id
        junction["active_direction"] = "STRAIGHT"
        self._add_timeline_event(
            "ALL_RED_CLEARANCE",
            f"All-red clearance interval (2s) initiated at {junction['name']} ({junction_id}) for approaching {amb['call_sign']}.",
            junction_id=junction_id,
            ambulance_id=amb_id
        )

    def _revert_junction_signal(self, junction_id: str, amb_id: str):
        junction = self.junctions.get(junction_id)
        if not junction:
            return

        self._add_timeline_event(
            "JUNCTION_CLEARED",
            f"{amb_id} cleared intersection {junction['name']} ({junction_id}).",
            junction_id=junction_id,
            ambulance_id=amb_id
        )

        # Check if another ambulance was queued
        if junction["queue"]:
            next_amb_id = junction["queue"].pop(0)
            next_amb = self.ambulances.get(next_amb_id)
            junction["signal_state"] = "FAILSAFE_ALL_RED"
            junction["clearance_remaining"] = 2.0
            junction["granted_to"] = next_amb_id
            self._add_timeline_event(
                "ALL_RED_CLEARANCE",
                f"Transition clearance (2s) granted to queued {next_amb.get('call_sign', next_amb_id) if next_amb else next_amb_id}.",
                junction_id=junction_id,
                ambulance_id=next_amb_id
            )
        else:
            junction["signal_state"] = "NORMAL_CYCLE"
            junction["granted_to"] = None
            junction["active_direction"] = None
            self._add_timeline_event(
                "NORMAL_REVERSION",
                f"{junction['name']} ({junction_id}) safely reverted to normal 4-phase cycle.",
                junction_id=junction_id
            )

    def _evaluate_scenario_triggers(self):
        # 1. Communication Loss Scenario triggers
        if self.active_scenario == "COMM_LOSS_FAILSAFE":
            jnc = self.junctions.get("JNC-03")
            if 15.0 <= self.elapsed_seconds < 28.0 and jnc and jnc["is_online"]:
                jnc["is_online"] = False
                jnc["signal_state"] = "FAILSAFE_ALL_RED"
                self._add_timeline_event(
                    "COMM_LOSS_WARNING",
                    "Telemetry heartbeat lost on JNC-03 (Ring Road Flyover). Junction transitioned to autonomous failsafe all-red.",
                    junction_id="JNC-03"
                )
            elif self.elapsed_seconds >= 28.0 and jnc and not jnc["is_online"]:
                jnc["is_online"] = True
                jnc["signal_state"] = "NORMAL_CYCLE"
                self._add_timeline_event(
                    "COMM_RESTORED",
                    "Gateway telemetry re-established with JNC-03. Autonomous watchdog confirmed normal cycle resumption.",
                    junction_id="JNC-03"
                )

        # 2. Gridlock Congestion Scenario triggers
        if self.active_scenario == "GRIDLOCK_CONGESTION":
            amb = self.ambulances.get("AMB-01")
            if amb and self.elapsed_seconds >= 8.0 and amb["route"] == ["JNC-01", "JNC-02", "JNC-04", "JNC-05"]:
                # Trigger dynamic rerouting via JNC-03 to bypass severe bottleneck
                amb["route"] = ["JNC-01", "JNC-02", "JNC-03", "JNC-05"]
                amb["total_distance_meters"] = 450.0 + 550.0 + 600.0
                amb["remaining_distance_meters"] = max(0.0, amb["total_distance_meters"] - amb["distance_travelled_meters"])
                self._add_timeline_event(
                    "REROUTE_COMPLETED",
                    "Gridlock alert: Heavy congestion on JNC-02 -> JNC-04. Dijkstra dynamic reroute activated via JNC-03 -> JNC-05 (saving estimated 120s).",
                    junction_id="JNC-02",
                    ambulance_id="AMB-01",
                    extra={"alternate_path": ["JNC-01", "JNC-02", "JNC-03", "JNC-05"]}
                )

    def get_status(self) -> Dict[str, Any]:
        """Returns the full real-time state of the simulation."""
        return {
            "state": self.state,
            "active_scenario": self.active_scenario,
            "speed_multiplier": self.speed_multiplier,
            "elapsed_seconds": round(self.elapsed_seconds, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ambulances": list(self.ambulances.values()),
            "junctions": list(self.junctions.values()),
            "corridor_edges": [
                {"from": u, "to": v, "distance": dist, "active": any(
                    (a["status"] != "ARRIVED" and a["current_leg_index"] < len(a["route"]) - 1 and
                     a["route"][a["current_leg_index"]] == u and a["route"][a["current_leg_index"] + 1] == v)
                    for a in self.ambulances.values()
                )}
                for u, neighbors in JUNCTION_EDGES.items()
                for v, dist in neighbors.items()
            ],
            "timeline": list(reversed(self.timeline[-20:])),
            "attribution": {
                "tiles": "© OpenStreetMap contributors, © CartoDB",
                "disclaimer": "ALL TELEMETRY, GPS COORDINATES, AND SIGNAL TRANSITIONS ARE SIMULATED FOR PROTOTYPE VALIDATION"
            }
        }


# Singleton service instance
simulation_service = SimulationService()
