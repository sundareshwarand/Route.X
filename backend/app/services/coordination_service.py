import hashlib
import heapq
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Tuple, Optional, Any
from sqlalchemy.orm import Session
from ..models import (
    EmergencyRequest,
    Ambulance,
    AmbulanceStatus,
    RequestStatus,
    RequestSource,
    Direction,
    Junction,
    SignalState,
    AuditLog,
    TriagePriority,
    utc_now
)
from ..config import settings

# Urgency weights for triage scheduling
TRIAGE_WEIGHTS = {
    TriagePriority.CRITICAL: 300,
    TriagePriority.URGENT: 200,
    TriagePriority.STANDARD: 100
}

# Predefined junction graph for Dijkstra shortest-path calculations
JUNCTION_GRAPH = {
    "JNC-01": {"JNC-02": 450, "JNC-03": 800},
    "JNC-02": {"JNC-01": 450, "JNC-03": 550, "JNC-04": 700},
    "JNC-03": {"JNC-01": 800, "JNC-02": 550, "JNC-05": 600},
    "JNC-04": {"JNC-02": 700, "JNC-05": 400},
    "JNC-05": {"JNC-03": 600, "JNC-04": 400}
}


def calculate_message_hash(ambulance_id: str, junction_id: str, direction: str, sequence_id: Optional[int] = None) -> str:
    """
    Computes a cryptographic fingerprint to identify duplicate LoRa/App requests within a sliding window.
    """
    raw = f"{ambulance_id}:{junction_id}:{direction}:{sequence_id or ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def detect_conflicts(db: Session, junction_id: str, new_direction: Direction, exclude_request_id: Optional[str] = None) -> List[EmergencyRequest]:
    """
    Checks for conflicting active emergency requests at the specified junction.
    A conflict occurs when another emergency request is currently PRIORITY_ACTIVE or RECEIVED.
    """
    query = db.query(EmergencyRequest).filter(
        EmergencyRequest.junction_id == junction_id,
        EmergencyRequest.status.in_([RequestStatus.PRIORITY_ACTIVE, RequestStatus.RECEIVED])
    )
    if exclude_request_id:
        query = query.filter(EmergencyRequest.id != exclude_request_id)
    return query.all()


def schedule_junction_queue(db: Session, junction_id: str) -> List[EmergencyRequest]:
    """
    Evaluates all active and pending requests at the given junction.
    Orders them based on:
      1. Active priority request remains in execution (non-preempting until clearance)
      2. Queued requests sorted by triage priority (CRITICAL > URGENT > STANDARD)
      3. Secondary sort by ETA (estimated_arrival_seconds) or request timestamp (FIFO)
      4. Assigns transparent scheduling_reason explaining why the position was granted
    """
    now = utc_now()
    active_req = db.query(EmergencyRequest).filter(
        EmergencyRequest.junction_id == junction_id,
        EmergencyRequest.status == RequestStatus.PRIORITY_ACTIVE,
        EmergencyRequest.expires_at > now
    ).order_by(EmergencyRequest.activated_at.desc()).first()

    pending_reqs = db.query(EmergencyRequest).filter(
        EmergencyRequest.junction_id == junction_id,
        EmergencyRequest.status == RequestStatus.PENDING,
        EmergencyRequest.expires_at > now
    ).all()

    def sort_key(r: EmergencyRequest):
        weight = TRIAGE_WEIGHTS.get(r.triage_priority, 100)
        eta = r.estimated_arrival_seconds if r.estimated_arrival_seconds > 0 else 999
        return (-weight, eta, r.requested_at)

    sorted_pending = sorted(pending_reqs, key=sort_key)

    for idx, req in enumerate(sorted_pending):
        if active_req:
            if req.direction == active_req.direction:
                req.scheduling_reason = f"Corridor compatibility: shares {req.direction.value} phase with active vehicle {active_req.ambulance_id}"
            else:
                req.scheduling_reason = (
                    f"Position #{idx+1} queued: {req.triage_priority.value} urgency. "
                    f"Awaiting safe clearance sequence ({req.clearance_seconds}s all-red) from active vehicle {active_req.ambulance_id}"
                )
        else:
            if idx == 0:
                req.scheduling_reason = f"Priority lead: {req.triage_priority.value} triage, next to receive priority green"
            else:
                req.scheduling_reason = f"Position #{idx+1} in queue: {req.triage_priority.value} triage behind #{idx}"

    db.commit()
    return sorted_pending


def get_next_scheduled_command(db: Session, junction_id: str) -> Optional[EmergencyRequest]:
    """
    Determines the next command to issue to the NodeMCU junction gateway.
    Respects safe non-preemption: if a request is already PRIORITY_ACTIVE, that request continues.
    If no request is PRIORITY_ACTIVE, selects the highest scheduled pending request after ordering.
    """
    now = utc_now()
    active = db.query(EmergencyRequest).filter(
        EmergencyRequest.junction_id == junction_id,
        EmergencyRequest.status == RequestStatus.PRIORITY_ACTIVE,
        EmergencyRequest.expires_at > now
    ).first()
    if active:
        return None

    scheduled = schedule_junction_queue(db, junction_id)
    if scheduled:
        return scheduled[0]
    return None



def advance_junction_queue(db: Session, junction_id: str) -> Optional[EmergencyRequest]:
    """
    Advances queue after an active request completes, cancels, or expires.
    """
    check_and_expire_requests(db)
    scheduled = schedule_junction_queue(db, junction_id)
    if scheduled:
        return scheduled[0]
    return None


def get_junction_queue_state(db: Session, junction_id: str) -> dict:
    check_and_expire_requests(db)
    junction = db.query(Junction).filter(Junction.id == junction_id).first()
    now = utc_now()

    # Look for active priority request first
    active_req = db.query(EmergencyRequest).filter(
        EmergencyRequest.junction_id == junction_id,
        EmergencyRequest.status == RequestStatus.PRIORITY_ACTIVE,
        EmergencyRequest.expires_at > now
    ).order_by(EmergencyRequest.activated_at.desc()).first()

    if not active_req:
        active_req = db.query(EmergencyRequest).filter(
            EmergencyRequest.junction_id == junction_id,
            EmergencyRequest.status == RequestStatus.RECEIVED,
            EmergencyRequest.expires_at > now
        ).order_by(EmergencyRequest.requested_at.desc()).first()

    scheduled_pending = schedule_junction_queue(db, junction_id)

    active_item = None
    if active_req:
        active_item = {
            "request_id": active_req.id,
            "ambulance_id": active_req.ambulance_id,
            "direction": active_req.direction,
            "triage_priority": active_req.triage_priority,
            "estimated_arrival_seconds": active_req.estimated_arrival_seconds,
            "scheduling_reason": active_req.scheduling_reason or ("Currently executing priority green" if active_req.status == RequestStatus.PRIORITY_ACTIVE else "Command received by gateway"),
            "status": active_req.status,
            "requested_at": active_req.requested_at,
            "is_active_priority": (active_req.status == RequestStatus.PRIORITY_ACTIVE)
        }


    queued_items = []
    for r in scheduled_pending:
        queued_items.append({
            "request_id": r.id,
            "ambulance_id": r.ambulance_id,
            "direction": r.direction,
            "triage_priority": r.triage_priority,
            "estimated_arrival_seconds": r.estimated_arrival_seconds,
            "scheduling_reason": r.scheduling_reason,
            "status": r.status,
            "requested_at": r.requested_at,
            "is_active_priority": False
        })

    return {
        "junction_id": junction_id,
        "current_signal_state": junction.current_signal_state if junction else SignalState.NORMAL_CYCLE,
        "active_direction": junction.active_direction if junction else None,
        "queue_length": (1 if active_item else 0) + len(queued_items),
        "active_request": active_item,
        "queued_requests": queued_items
    }



def check_and_expire_requests(db: Session) -> int:
    """
    Transitions expired requests to EXPIRED status if their TTL has lapsed without completion.
    """
    now = utc_now()
    stale_requests = db.query(EmergencyRequest).filter(
        EmergencyRequest.status.in_([RequestStatus.PENDING, RequestStatus.RECEIVED, RequestStatus.PRIORITY_ACTIVE]),
        EmergencyRequest.expires_at <= now
    ).all()

    count = 0
    for req in stale_requests:
        req.status = RequestStatus.EXPIRED
        req.completed_at = now
        
        # If this request held junction priority, revert the junction state safely
        junction = db.query(Junction).filter(Junction.id == req.junction_id).first()
        if junction and junction.current_signal_state == SignalState.PRIORITY_ACTIVE:
            # Check if any other request is active
            other_active = db.query(EmergencyRequest).filter(
                EmergencyRequest.junction_id == junction.id,
                EmergencyRequest.status == RequestStatus.PRIORITY_ACTIVE,
                EmergencyRequest.id != req.id
            ).first()
            if not other_active:
                junction.current_signal_state = SignalState.NORMAL_CYCLE
                junction.active_direction = None

        count += 1

        # Check if ambulance has other active requests; if none, revert to IDLE
        other_active_amb = db.query(EmergencyRequest).filter(
            EmergencyRequest.ambulance_id == req.ambulance_id,
            EmergencyRequest.id != req.id,
            EmergencyRequest.status.in_([RequestStatus.PENDING, RequestStatus.RECEIVED, RequestStatus.PRIORITY_ACTIVE]),
            EmergencyRequest.expires_at > now
        ).first()
        if not other_active_amb:
            amb = db.query(Ambulance).filter(Ambulance.id == req.ambulance_id).first()
            if amb and amb.status != AmbulanceStatus.MAINTENANCE:
                amb.status = AmbulanceStatus.IDLE

    if count > 0:
        db.commit()
    return count


def validate_status_transition(current_status: RequestStatus, target_status: RequestStatus) -> bool:
    """
    Enforces valid state machine transitions:
    PENDING -> RECEIVED -> PRIORITY_ACTIVE -> COMPLETED
    Any non-terminal status can transition to EXPIRED, CANCELLED, or FAILED.
    """
    if current_status == target_status:
        return True

    valid_transitions = {
        RequestStatus.PENDING: [RequestStatus.RECEIVED, RequestStatus.CANCELLED, RequestStatus.EXPIRED, RequestStatus.FAILED],
        RequestStatus.RECEIVED: [RequestStatus.PRIORITY_ACTIVE, RequestStatus.CANCELLED, RequestStatus.EXPIRED, RequestStatus.FAILED],
        RequestStatus.PRIORITY_ACTIVE: [RequestStatus.COMPLETED, RequestStatus.CANCELLED, RequestStatus.EXPIRED, RequestStatus.FAILED],
        RequestStatus.COMPLETED: [],
        RequestStatus.FAILED: [],
        RequestStatus.EXPIRED: [],
        RequestStatus.CANCELLED: []
    }
    return target_status in valid_transitions.get(current_status, [])


def dijkstra_shortest_path(start: str, target: str) -> Tuple[List[str], float, float]:
    """
    Computes shortest physical distance path between junctions using Dijkstra's algorithm.
    Returns: (path, total_distance_meters, estimated_travel_time_seconds)
    Assumes average emergency transit speed of 50 km/h (~13.8 m/s).
    """
    if start not in JUNCTION_GRAPH or target not in JUNCTION_GRAPH:
        return ([start, target], 0.0, 0.0)

    distances = {node: float("inf") for node in JUNCTION_GRAPH}
    previous_nodes = {node: None for node in JUNCTION_GRAPH}
    distances[start] = 0
    priority_queue = [(0, start)]

    while priority_queue:
        current_distance, current_node = heapq.heappop(priority_queue)

        if current_distance > distances[current_node]:
            continue

        if current_node == target:
            break

        for neighbor, weight in JUNCTION_GRAPH.get(current_node, {}).items():
            distance = current_distance + weight
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous_nodes[neighbor] = current_node
                heapq.heappush(priority_queue, (distance, neighbor))

    # Reconstruct path
    path = []
    curr = target
    while curr is not None:
        path.append(curr)
        curr = previous_nodes[curr]
    path.reverse()

    total_distance = distances[target]
    if total_distance == float("inf"):
        return ([start], 0.0, 0.0)

    # Estimate travel time at 13.89 m/s (50 km/h)
    travel_time_seconds = round(total_distance / 13.89, 1)
    return (path, float(total_distance), travel_time_seconds)


def compare_routes(
    start: str,
    target: str,
    congested_edges: Optional[List[dict]] = None
) -> Dict[str, Any]:
    """
    Computes and compares:
    1. Distance-optimal route using standard physical distance Dijkstra.
    2. Traffic/congestion-weighted route using travel-time Dijkstra where congested segments
       have delay factors applied.
    Returns comprehensive comparison metrics and human-readable algorithmic justification.
    """
    # 1. Standard distance route
    std_path, std_dist, std_base_time = dijkstra_shortest_path(start, target)

    # Build congestion lookup: (u, v) -> multiplier
    congestion_map: Dict[Tuple[str, str], float] = {}
    if congested_edges:
        for ce in congested_edges:
            u = ce.get("from_junction")
            v = ce.get("to_junction")
            m = float(ce.get("congestion_multiplier", 2.5))
            if u and v:
                congestion_map[(u, v)] = m
                congestion_map[(v, u)] = m

    # Calculate actual travel time on std_path taking congestion into account
    std_actual_time = 0.0
    std_congested_segs = []
    for i in range(len(std_path) - 1):
        u = std_path[i]
        v = std_path[i + 1]
        dist = JUNCTION_GRAPH.get(u, {}).get(v, 400.0)
        mult = congestion_map.get((u, v), 1.0)
        if mult > 1.0:
            std_congested_segs.append(f"{u}->{v} ({mult}x delay)")
        seg_time = (dist / 13.89) * mult
        std_actual_time += seg_time

    if std_actual_time == 0.0:
        std_actual_time = std_base_time

    # 2. Traffic-weighted Dijkstra: graph where weight is travel time in seconds
    distances = {node: float("inf") for node in JUNCTION_GRAPH}
    previous_nodes = {node: None for node in JUNCTION_GRAPH}
    distances[start] = 0.0
    pq = [(0.0, start)]

    while pq:
        curr_time, curr_node = heapq.heappop(pq)
        if curr_time > distances[curr_node]:
            continue
        if curr_node == target:
            break
        for neighbor, dist in JUNCTION_GRAPH.get(curr_node, {}).items():
            mult = congestion_map.get((curr_node, neighbor), 1.0)
            edge_time = (dist / 13.89) * mult
            new_time = curr_time + edge_time
            if new_time < distances[neighbor]:
                distances[neighbor] = new_time
                previous_nodes[neighbor] = curr_node
                heapq.heappush(pq, (new_time, neighbor))

    # Reconstruct optimized path
    opt_path = []
    curr = target
    while curr is not None:
        opt_path.append(curr)
        curr = previous_nodes[curr]
    opt_path.reverse()

    if not opt_path or opt_path[0] != start:
        opt_path = list(std_path)

    # Compute distance and travel time for opt_path
    opt_dist = 0.0
    opt_time = 0.0
    opt_congested_segs = []
    for i in range(len(opt_path) - 1):
        u = opt_path[i]
        v = opt_path[i + 1]
        dist = JUNCTION_GRAPH.get(u, {}).get(v, 400.0)
        mult = congestion_map.get((u, v), 1.0)
        if mult > 1.0:
            opt_congested_segs.append(f"{u}->{v} ({mult}x delay)")
        opt_dist += dist
        opt_time += (dist / 13.89) * mult

    if opt_time == 0.0:
        opt_time = std_base_time
        opt_dist = std_dist

    time_saved = max(0.0, round(std_actual_time - opt_time, 1))

    if time_saved > 5.0 and opt_path != std_path:
        recommendation = "TRAFFIC_OPTIMIZED"
        rationale = (
            f"Standard distance path ({' -> '.join(std_path)}) is physically shorter ({round(std_dist)}m) "
            f"but traverses congested corridor ({', '.join(std_congested_segs)}) with estimated {round(std_actual_time)}s transit. "
            f"Traffic-weighted Dijkstra path ({' -> '.join(opt_path)}) diverts around bottleneck, "
            f"spanning {round(opt_dist)}m and saving {round(time_saved)}s ({round(opt_time)}s total transit)."
        )
    else:
        recommendation = "STANDARD_DISTANCE"
        if std_congested_segs:
            rationale = (
                f"Standard shortest path ({' -> '.join(std_path)}) remains optimal despite delay. "
                f"Alternative diversions do not yield net time savings."
            )
        else:
            rationale = (
                f"Corridor links between {start} and {target} are operating at normal transit speed (50 km/h). "
                f"Standard distance Dijkstra route ({' -> '.join(std_path)}) is optimal."
            )

    return {
        "start_junction": start,
        "destination_junction": target,
        "standard_distance_route": {
            "name": "Standard Physical Distance (Dijkstra)",
            "path": std_path,
            "total_distance_meters": round(std_dist, 1),
            "estimated_travel_time_seconds": round(std_actual_time, 1),
            "has_congestion": len(std_congested_segs) > 0,
            "congested_segments": std_congested_segs,
            "junction_details": []
        },
        "traffic_optimized_route": {
            "name": "Traffic-Weighted Transit (Dijkstra)",
            "path": opt_path,
            "total_distance_meters": round(opt_dist, 1),
            "estimated_travel_time_seconds": round(opt_time, 1),
            "has_congestion": len(opt_congested_segs) > 0,
            "congested_segments": opt_congested_segs,
            "junction_details": []
        },
        "time_saved_seconds": time_saved,
        "recommendation": recommendation,
        "decision_rationale": rationale,
        "algorithm_type": "Dijkstra Graph Shortest-Path / Weighted Edge Transit Model",
        "is_simulated": True
    }

