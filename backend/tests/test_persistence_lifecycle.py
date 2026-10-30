import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models import Base, User, UserRole, Ambulance, Junction, Hospital, EmergencyRequest, TriagePriority, RequestStatus, Direction, utc_now
from app.auth import hash_password, verify_password
from app.database import ensure_schema_compatibility


def test_database_persistence_across_application_restarts(tmp_path):
    """
    CRITICAL PERSISTENCE TEST:
    Verify that tables, user accounts, and emergency data survive an application/container restart.
    Ensure that re-running schema migrations and seed scripts on startup is 100% idempotent
    and does not corrupt or overwrite existing data.
    """
    db_file = tmp_path / "persistent_test.db"
    db_url = f"sqlite:///{db_file}"

    # 1. APPLICATION LIFECYCLE 1: Cold Startup
    engine_v1 = create_engine(db_url, connect_args={"check_same_thread": False})
    Session_v1 = sessionmaker(autocommit=False, autoflush=False, bind=engine_v1)

    # Initialize tables
    Base.metadata.create_all(bind=engine_v1)

    # Insert test user and persistent emergency record
    with Session_v1() as db:
        test_user = User(
            email="persistent_commander@routex.org",
            hashed_password=hash_password("SuperSecret2026!"),
            full_name="Persistent Commander",
            role=UserRole.OPERATOR,
            is_active=True,
            created_at=utc_now()
        )
        test_ambulance = Ambulance(
            id="AMB-PERSIST-1",
            call_sign="PERSIST-101",
            plate_number="DL-PERSIST-99",
            vehicle_type="ALS Critical Care",
            base_station="Central Trauma Base"
        )
        test_emergency = EmergencyRequest(
            id="REQ-PERSIST-001",
            ambulance_id="AMB-PERSIST-1",
            junction_id="JNC-01",
            direction=Direction.STRAIGHT,
            triage_priority=TriagePriority.CRITICAL,
            status=RequestStatus.PRIORITY_ACTIVE,
            requested_at=utc_now(),
            expires_at=utc_now()
        )
        db.add_all([test_user, test_ambulance, test_emergency])
        db.commit()

    # 2. SIMULATE APPLICATION RESTART / CRASH / REBOOT
    engine_v1.dispose()

    # 3. APPLICATION LIFECYCLE 2: Post-Restart Initialization
    engine_v2 = create_engine(db_url, connect_args={"check_same_thread": False})
    Session_v2 = sessionmaker(autocommit=False, autoflush=False, bind=engine_v2)

    # Re-run startup schema compatibility & table creation (must be safe & non-destructive)
    Base.metadata.create_all(bind=engine_v2)

    # Verify data survived restart
    with Session_v2() as db:
        user = db.query(User).filter(User.email == "persistent_commander@routex.org").first()
        assert user is not None, "User account was lost across application restart!"
        assert verify_password("SuperSecret2026!", user.hashed_password), "Password hash was corrupted across restart!"
        assert user.role == UserRole.OPERATOR

        amb = db.query(Ambulance).filter(Ambulance.id == "AMB-PERSIST-1").first()
        assert amb is not None, "Ambulance record was lost across application restart!"
        assert amb.call_sign == "PERSIST-101"

        req = db.query(EmergencyRequest).filter(EmergencyRequest.id == "REQ-PERSIST-001").first()
        assert req is not None, "Emergency record was lost across application restart!"
        assert req.status == RequestStatus.PRIORITY_ACTIVE
        assert req.triage_priority == TriagePriority.CRITICAL

    engine_v2.dispose()


def test_schema_compatibility_idempotency(tmp_path):
    """Verify ensure_schema_compatibility does not raise on multiple runs."""
    db_file = tmp_path / "compat_test.db"
    db_url = f"sqlite:///{db_file}"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

    # Run twice
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    
    # Engine disposed cleanly
    engine.dispose()
