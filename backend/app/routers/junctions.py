from typing import List, Optional
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Junction, SignalState, User, utc_now
from ..schemas import (
    JunctionCreate,
    JunctionResponse,
    ShortestPathRequest,
    ShortestPathResponse,
    RouteComparisonRequest,
    RouteComparisonResponse
)
from ..auth import require_operator
from ..services.coordination_service import dijkstra_shortest_path, compare_routes, JUNCTION_GRAPH
from ..config import settings

router = APIRouter(prefix="/junctions", tags=["Junctions"])


@router.get("", response_model=List[JunctionResponse])
def list_junctions(zone: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Junction)
    if zone:
        query = query.filter(Junction.zone == zone)
    junctions = query.order_by(Junction.id.asc()).all()
    
    # Check heartbeat freshness for online indicator
    now = utc_now()
    threshold = timedelta(seconds=settings.HEARTBEAT_TIMEOUT_SECONDS)
    for j in junctions:
        if j.last_heartbeat:
            j.is_online = (now - j.last_heartbeat.replace(tzinfo=now.tzinfo) if j.last_heartbeat.tzinfo is None else now - j.last_heartbeat) < threshold
        else:
            j.is_online = False
    return junctions


@router.post("", response_model=JunctionResponse, status_code=status.HTTP_201_CREATED)
def create_junction(
    j_in: JunctionCreate,
    current_user: User = Depends(require_operator),
    db: Session = Depends(get_db)
):
    existing = db.query(Junction).filter((Junction.id == j_in.id) | (Junction.code == j_in.code)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A junction with this ID or Code already exists"
        )
    junction = Junction(
        id=j_in.id,
        name=j_in.name,
        code=j_in.code,
        latitude=j_in.latitude,
        longitude=j_in.longitude,
        zone=j_in.zone,
        current_signal_state=SignalState.NORMAL_CYCLE,
        is_online=False,
        created_at=utc_now()
    )
    db.add(junction)
    db.commit()
    db.refresh(junction)
    return junction


@router.get("/{junction_id}", response_model=JunctionResponse)
def get_junction(junction_id: str, db: Session = Depends(get_db)):
    junction = db.query(Junction).filter(Junction.id == junction_id).first()
    if not junction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Junction not found")
    
    # Check heartbeat freshness
    if junction.last_heartbeat:
        now = utc_now()
        threshold = timedelta(seconds=settings.HEARTBEAT_TIMEOUT_SECONDS)
        time_diff = now - (junction.last_heartbeat.replace(tzinfo=now.tzinfo) if junction.last_heartbeat.tzinfo is None else junction.last_heartbeat)
        junction.is_online = time_diff < threshold
    return junction


@router.post("/route/shortest-path", response_model=ShortestPathResponse)
def calculate_route(payload: ShortestPathRequest, db: Session = Depends(get_db)):
    path, dist_meters, est_seconds = dijkstra_shortest_path(
        payload.start_junction_id,
        payload.destination_junction_id
    )
    junctions_in_path = db.query(Junction).filter(Junction.id.in_(path)).all()
    j_dict = {j.id: {"name": j.name, "zone": j.zone, "signal": j.current_signal_state.value} for j in junctions_in_path}
    
    details = [{"id": j_id, "info": j_dict.get(j_id, {})} for j_id in path]
    return {
        "start_junction": payload.start_junction_id,
        "destination_junction": payload.destination_junction_id,
        "path": path,
        "total_distance_meters": dist_meters,
        "estimated_travel_time_seconds": est_seconds,
        "junction_details": details
    }


@router.post("/route/compare", response_model=RouteComparisonResponse)
def compare_junction_routes(payload: RouteComparisonRequest, db: Session = Depends(get_db)):
    dest_junction_id = payload.destination_junction_id or "JNC-05"
    congested_dicts = [ce.model_dump() for ce in payload.congested_edges] if payload.congested_edges else None
    result = compare_routes(payload.start_junction_id, dest_junction_id, congested_dicts)

    all_junc_ids = list(set(result["standard_distance_route"]["path"] + result["traffic_optimized_route"]["path"]))
    junctions_in_db = db.query(Junction).filter(Junction.id.in_(all_junc_ids)).all()
    j_map = {j.id: {"name": j.name, "zone": j.zone, "signal": j.current_signal_state.value} for j in junctions_in_db}

    result["standard_distance_route"]["junction_details"] = [
        {"id": j_id, "info": j_map.get(j_id, {})} for j_id in result["standard_distance_route"]["path"]
    ]
    result["traffic_optimized_route"]["junction_details"] = [
        {"id": j_id, "info": j_map.get(j_id, {})} for j_id in result["traffic_optimized_route"]["path"]
    ]
    return result

