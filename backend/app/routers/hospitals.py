from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Hospital, Junction
from ..schemas import (
    HospitalResponse,
    RouteComparisonRequest,
    RouteComparisonResponse
)
from ..services.coordination_service import compare_routes

router = APIRouter(prefix="/hospitals", tags=["Hospitals & Fleet Coordination"])


def _format_hospital_response(h: Hospital) -> dict:
    specialties_list = [s.strip() for s in h.specialties.split(",") if s.strip()] if h.specialties else []
    return {
        "id": h.id,
        "name": h.name,
        "junction_id": h.junction_id,
        "latitude": h.latitude,
        "longitude": h.longitude,
        "readiness_status": h.readiness_status.value if hasattr(h.readiness_status, "value") else str(h.readiness_status),
        "available_icu_beds": h.available_icu_beds,
        "total_icu_beds": h.total_icu_beds,
        "specialties": specialties_list,
        "is_accepting_emergencies": h.is_accepting_emergencies,
        "created_at": h.created_at
    }


@router.get("", response_model=List[HospitalResponse])
def list_hospitals(db: Session = Depends(get_db)):
    """
    Returns registered receiving hospitals with real-time trauma readiness, ICU bed capacity,
    and associated junction corridor coordinates.
    """
    hospitals = db.query(Hospital).order_by(Hospital.id.asc()).all()
    return [_format_hospital_response(h) for h in hospitals]


@router.get("/{hospital_id}", response_model=HospitalResponse)
def get_hospital(hospital_id: str, db: Session = Depends(get_db)):
    h = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not h:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital not found")
    return _format_hospital_response(h)


@router.post("/route/compare", response_model=RouteComparisonResponse)
def compare_hospital_routes(payload: RouteComparisonRequest, db: Session = Depends(get_db)):
    """
    Evaluates shortest physical distance (standard Dijkstra) vs dynamic congestion-weighted transit time.
    Provides authoritative algorithmic justification and time savings.
    """
    dest_junction_id = payload.destination_junction_id
    hospital_data = None

    if payload.destination_hospital_id:
        h = db.query(Hospital).filter(Hospital.id == payload.destination_hospital_id).first()
        if not h:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified destination hospital not found")
        dest_junction_id = h.junction_id
        hospital_data = _format_hospital_response(h)

    if not dest_junction_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either destination_junction_id or destination_hospital_id must be provided"
        )

    congested_dicts = [ce.model_dump() for ce in payload.congested_edges] if payload.congested_edges else None
    result = compare_routes(
        payload.start_junction_id,
        dest_junction_id,
        congested_dicts
    )

    # Attach junction names for UI clarity
    all_junc_ids = list(set(result["standard_distance_route"]["path"] + result["traffic_optimized_route"]["path"]))
    junctions_in_db = db.query(Junction).filter(Junction.id.in_(all_junc_ids)).all()
    j_map = {j.id: {"name": j.name, "zone": j.zone, "signal": j.current_signal_state.value} for j in junctions_in_db}

    result["standard_distance_route"]["junction_details"] = [
        {"id": j_id, "info": j_map.get(j_id, {})} for j_id in result["standard_distance_route"]["path"]
    ]
    result["traffic_optimized_route"]["junction_details"] = [
        {"id": j_id, "info": j_map.get(j_id, {})} for j_id in result["traffic_optimized_route"]["path"]
    ]
    result["destination_hospital"] = hospital_data

    return result
