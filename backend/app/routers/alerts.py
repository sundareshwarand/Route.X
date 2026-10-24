from datetime import timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import NearbyVehicleAlert, AlertDelivery, Direction, utc_now
from ..schemas import (
    NearbyVehicleAlertResponse,
    ClientSubscriptionCreate,
    ClientSubscriptionResponse,
    AlertDeliveryAckRequest,
    AlertDeliveryResponse,
    ProximityCheckRequest,
    ProximityCheckResponse
)
from ..services.alert_service import (
    get_active_alerts_for_zone,
    expire_stale_alerts,
    upsert_client_subscription,
    acknowledge_alert_delivery,
    evaluate_proximity_for_coordinates,
    process_delivery_retries
)
from ..services.ws_manager import ws_manager

router = APIRouter(prefix="/alerts", tags=["Nearby Vehicle Alerts"])


@router.get("", response_model=List[NearbyVehicleAlertResponse])
def list_alerts(
    zone: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    expire_stale_alerts(db)
    query = db.query(NearbyVehicleAlert)
    if zone:
        query = query.filter(NearbyVehicleAlert.zone == zone)
    return query.order_by(NearbyVehicleAlert.created_at.desc()).limit(limit).all()


@router.get("/active", response_model=List[NearbyVehicleAlertResponse])
def list_active_alerts(
    zone: Optional[str] = None,
    db: Session = Depends(get_db)
):
    expire_stale_alerts(db)
    return get_active_alerts_for_zone(db, zone)


@router.post("/subscribe", response_model=ClientSubscriptionResponse)
def subscribe_client(
    sub_data: ClientSubscriptionCreate,
    db: Session = Depends(get_db)
):
    """
    Subscribes a client device to a test zone for simulated nearby emergency alerts.
    """
    subscription = upsert_client_subscription(
        db=db,
        client_uuid=sub_data.client_uuid,
        zone=sub_data.zone,
        latitude=sub_data.latitude,
        longitude=sub_data.longitude,
        is_simulation=sub_data.is_simulation
    )
    return subscription


@router.post("/{alert_id}/acknowledge", response_model=AlertDeliveryResponse)
def acknowledge_alert(
    alert_id: str,
    ack_data: AlertDeliveryAckRequest,
    db: Session = Depends(get_db)
):
    """
    Acknowledges receipt of an advisory alert by a client device.
    """
    alert = db.query(NearbyVehicleAlert).filter(NearbyVehicleAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found."
        )

    delivery = acknowledge_alert_delivery(
        db=db,
        alert_id=alert_id,
        client_identifier=ack_data.client_identifier
    )
    return delivery


@router.get("/{alert_id}/deliveries", response_model=List[AlertDeliveryResponse])
def get_alert_deliveries(
    alert_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns the delivery statuses and retry counts for a specific alert.
    """
    alert = db.query(NearbyVehicleAlert).filter(NearbyVehicleAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found."
        )
    return db.query(AlertDelivery).filter(AlertDelivery.alert_id == alert_id).all()


@router.post("/process-retries")
def trigger_delivery_retries(
    max_retries: int = 3,
    db: Session = Depends(get_db)
):
    """
    Evaluates unacknowledged alert deliveries, increments retry counts,
    and transitions deliveries to FAILED when max_retries is reached.
    """
    count = process_delivery_retries(db, max_retries=max_retries)
    return {
        "status": "RETRIES_PROCESSED",
        "processed_count": count,
        "max_retries": max_retries
    }


@router.post("/proximity-check", response_model=ProximityCheckResponse)
def check_proximity(
    req: ProximityCheckRequest,
    db: Session = Depends(get_db)
):
    """
    Advisory proximity check using Haversine distance on client coordinates vs active emergency junctions.
    Clearly marked as simulated test advisory.
    """
    expire_stale_alerts(db)
    has_nearby, distance, alert = evaluate_proximity_for_coordinates(
        db=db,
        client_lat=req.client_latitude,
        client_lon=req.client_longitude,
        max_radius_meters=req.max_radius_meters
    )
    return ProximityCheckResponse(
        has_nearby_emergency=has_nearby,
        distance_meters=distance,
        alert=alert,
        is_simulated_proximity=True,
        disclaimer="Advisory test simulation only. Does not represent actual consumer vehicle detection."
    )


@router.post("/test-broadcast", response_model=NearbyVehicleAlertResponse)
async def broadcast_test_alert(
    junction_id: str = "JNC-01",
    zone: str = "ZONE-CENTRAL",
    direction: Direction = Direction.STRAIGHT,
    duration_seconds: int = 30,
    db: Session = Depends(get_db)
):
    """
    Triggers an advisory test broadcast for road users in a configured zone.
    Strictly marked as test simulation (is_test_simulation=True).
    """
    now = utc_now()
    expires_at = now + timedelta(seconds=duration_seconds)
    
    alert = NearbyVehicleAlert(
        request_id="SIMULATED-TEST-REQ",
        junction_id=junction_id,
        zone=zone,
        approach_direction=direction,
        message=f"[SIMULATION DEMO] Emergency vehicle approaching {junction_id} via {direction.value} lane. Stay alert and give way safely.",
        is_test_simulation=True,
        expires_at=expires_at,
        created_at=now
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Deliver to test recipients or registered subscribers
    subscriptions = db.query(AlertDelivery).filter(AlertDelivery.alert_id == alert.id).all()
    for i in range(1, 4):
        delivery = AlertDelivery(
            alert_id=alert.id,
            recipient_identifier=f"citizen-test-subscriber-{i}",
            delivery_channel="ZONE_SIMULATED_TEST",
            recorded_at=now
        )
        db.add(delivery)
    db.commit()

    await ws_manager.broadcast("NEARBY_ALERT_BROADCAST", {
        "alert_id": alert.id,
        "zone": alert.zone,
        "message": alert.message,
        "is_test_simulation": True,
        "expires_at": alert.expires_at.isoformat()
    })

    return alert

