import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from ..models import (
    NearbyVehicleAlert,
    AlertDelivery,
    AlertDeliveryStatus,
    ClientSubscription,
    EmergencyRequest,
    Junction,
    utc_now
)


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two GPS points using the Haversine formula.
    Used for advisory test-zone proximity evaluation only when coordinates are provided.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)


def upsert_client_subscription(
    db: Session,
    client_uuid: str,
    zone: str = "ZONE-CENTRAL",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    is_simulation: bool = True
) -> ClientSubscription:
    sub = db.query(ClientSubscription).filter(ClientSubscription.client_uuid == client_uuid).first()
    now = utc_now()
    if sub:
        sub.zone = zone
        sub.latitude = latitude
        sub.longitude = longitude
        sub.is_simulation = is_simulation
        sub.last_active_at = now
    else:
        sub = ClientSubscription(
            client_uuid=client_uuid,
            zone=zone,
            latitude=latitude,
            longitude=longitude,
            is_simulation=is_simulation,
            last_active_at=now
        )
        db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def create_nearby_alert_for_request(
    db: Session,
    request: EmergencyRequest,
    is_simulation: bool = True
) -> NearbyVehicleAlert:
    """
    Creates an advisory nearby-vehicle alert for an emergency vehicle request.
    Dispatches deliveries to subscribed test clients in the target zone.
    """
    existing_alert = db.query(NearbyVehicleAlert).filter(
        NearbyVehicleAlert.request_id == request.id
    ).first()
    if existing_alert:
        return existing_alert

    junction = db.query(Junction).filter(Junction.id == request.junction_id).first()
    zone = junction.zone if junction else "ZONE-CENTRAL"
    expires_at = request.expires_at

    alert = NearbyVehicleAlert(
        request_id=request.id,
        junction_id=request.junction_id,
        zone=zone,
        approach_direction=request.direction,
        message=f"Emergency vehicle approaching via {request.direction.value} lane at {junction.name if junction else request.junction_id}. Stay alert and give way when safe.",
        is_test_simulation=is_simulation,
        expires_at=expires_at,
        created_at=utc_now()
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # 1. Fetch registered subscribers for this zone
    subscriptions = db.query(ClientSubscription).filter(ClientSubscription.zone == zone).all()
    recipient_ids = [s.client_uuid for s in subscriptions]
    
    # 2. Add fallback test subscribers if none registered
    if not recipient_ids:
        recipient_ids = [f"citizen-test-app-{i}" for i in range(1, 4)]

    # 3. Create delivery records
    now = utc_now()
    for sub in recipient_ids:
        delivery = AlertDelivery(
            alert_id=alert.id,
            recipient_identifier=sub,
            status=AlertDeliveryStatus.SENT,
            delivery_channel="ZONE_SIMULATED_BROADCAST",
            retry_count=0,
            recorded_at=now
        )
        db.add(delivery)
    db.commit()

    return alert


def acknowledge_alert_delivery(
    db: Session,
    alert_id: str,
    client_identifier: str
) -> Optional[AlertDelivery]:
    """
    Records confirmation that a client device received the advisory notification.
    Transitions status to ACKNOWLEDGED.
    """
    delivery = db.query(AlertDelivery).filter(
        AlertDelivery.alert_id == alert_id,
        AlertDelivery.recipient_identifier == client_identifier
    ).first()

    now = utc_now()
    if delivery:
        delivery.status = AlertDeliveryStatus.ACKNOWLEDGED
        delivery.acknowledged_at = now
        db.commit()
        db.refresh(delivery)
        return delivery
    else:
        # If client ACKed an alert without initial record, create ACK record
        delivery = AlertDelivery(
            alert_id=alert_id,
            recipient_identifier=client_identifier,
            status=AlertDeliveryStatus.ACKNOWLEDGED,
            delivery_channel="ZONE_SIMULATED_BROADCAST",
            retry_count=0,
            acknowledged_at=now,
            recorded_at=now
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)
        return delivery


def process_delivery_retries(db: Session, max_retries: int = 3) -> int:
    """
    Finds unacknowledged deliveries for active alerts.
    Increments retry count; marks delivery failures after max retries.
    """
    now = utc_now()
    unacked = db.query(AlertDelivery).join(NearbyVehicleAlert).filter(
        AlertDelivery.status == AlertDeliveryStatus.SENT,
        NearbyVehicleAlert.expires_at > now
    ).all()

    retried_count = 0
    for d in unacked:
        if d.retry_count < max_retries:
            d.retry_count += 1
            retried_count += 1
        else:
            d.status = AlertDeliveryStatus.FAILED
            d.failure_reason = "Max retries exceeded without client acknowledgment"
            retried_count += 1
    db.commit()
    return retried_count


def evaluate_proximity_for_coordinates(
    db: Session,
    client_lat: float,
    client_lon: float,
    max_radius_meters: float = 1000.0
) -> Tuple[bool, Optional[float], Optional[NearbyVehicleAlert]]:
    """
    Evaluates whether the client's coordinates fall within max_radius_meters of any junction
    with an active emergency vehicle alert.
    Uses Haversine distance strictly when valid coordinates exist.
    """
    now = utc_now()
    active_alerts = db.query(NearbyVehicleAlert).filter(NearbyVehicleAlert.expires_at > now).all()

    closest_alert = None
    min_dist = float("inf")

    for alert in active_alerts:
        junction = db.query(Junction).filter(Junction.id == alert.junction_id).first()
        if junction and junction.latitude and junction.longitude:
            dist = haversine_distance_meters(client_lat, client_lon, junction.latitude, junction.longitude)
            if dist <= max_radius_meters and dist < min_dist:
                min_dist = dist
                closest_alert = alert

    if closest_alert is not None:
        return (True, min_dist, closest_alert)
    return (False, None, None)


def get_active_alerts_for_zone(db: Session, zone: Optional[str] = None) -> List[NearbyVehicleAlert]:
    now = utc_now()
    query = db.query(NearbyVehicleAlert).filter(NearbyVehicleAlert.expires_at > now)
    if zone:
        query = query.filter(NearbyVehicleAlert.zone == zone)
    return query.order_by(NearbyVehicleAlert.created_at.desc()).all()


def expire_stale_alerts(db: Session) -> int:
    """
    Finds and marks expired alerts and their deliveries.
    """
    now = utc_now()
    stale_alerts = db.query(NearbyVehicleAlert).filter(NearbyVehicleAlert.expires_at <= now).all()
    count = 0
    for alert in stale_alerts:
        deliveries = db.query(AlertDelivery).filter(
            AlertDelivery.alert_id == alert.id,
            AlertDelivery.status != AlertDeliveryStatus.EXPIRED
        ).all()
        for d in deliveries:
            d.status = AlertDeliveryStatus.EXPIRED
        count += 1
    db.commit()
    return count
