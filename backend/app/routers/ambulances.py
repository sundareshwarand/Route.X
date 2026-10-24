from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Ambulance, User, AmbulanceStatus, utc_now
from ..schemas import AmbulanceCreate, AmbulanceResponse, AmbulanceStatusUpdate
from ..auth import get_current_user, require_operator
from ..services.ws_manager import ws_manager

router = APIRouter(prefix="/ambulances", tags=["Ambulances"])


@router.get("", response_model=List[AmbulanceResponse])
def list_ambulances(
    status_filter: Optional[AmbulanceStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Ambulance)
    if status_filter:
        query = query.filter(Ambulance.status == status_filter)
    return query.order_by(Ambulance.id.asc()).all()


@router.post("", response_model=AmbulanceResponse, status_code=status.HTTP_201_CREATED)
def register_ambulance(
    amb_in: AmbulanceCreate,
    current_user: User = Depends(require_operator),
    db: Session = Depends(get_db)
):
    existing = db.query(Ambulance).filter(
        (Ambulance.id == amb_in.id) | (Ambulance.call_sign == amb_in.call_sign)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An ambulance with this ID or call sign already exists"
        )
    amb = Ambulance(
        id=amb_in.id,
        call_sign=amb_in.call_sign,
        plate_number=amb_in.plate_number,
        vehicle_type=amb_in.vehicle_type,
        status=amb_in.status,
        base_station=amb_in.base_station,
        assigned_driver_id=amb_in.assigned_driver_id,
        created_at=utc_now()
    )
    db.add(amb)
    db.commit()
    db.refresh(amb)
    return amb


@router.get("/{ambulance_id}", response_model=AmbulanceResponse)
def get_ambulance(ambulance_id: str, db: Session = Depends(get_db)):
    amb = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not amb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ambulance not found")
    return amb


@router.patch("/{ambulance_id}/status", response_model=AmbulanceResponse)
async def update_ambulance_status(
    ambulance_id: str,
    status_update: AmbulanceStatusUpdate,
    current_user: User = Depends(require_operator),
    db: Session = Depends(get_db)
):
    amb = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not amb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ambulance not found")
    
    amb.status = status_update.status
    db.commit()
    db.refresh(amb)

    await ws_manager.broadcast("AMBULANCE_STATUS_UPDATED", {
        "ambulance_id": amb.id,
        "status": amb.status.value
    })

    return amb
