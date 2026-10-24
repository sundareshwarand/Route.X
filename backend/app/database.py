from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Normalize database URL (e.g. handle Render/Heroku postgres:// -> postgresql://)
raw_db_url = settings.DATABASE_URL
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

# If SQLite, ensure directory exists and check_same_thread=False
connect_args = {}
if raw_db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # Auto-create parent directory if path is specified (e.g. /data/routex.db for Render persistent disks)
    if "sqlite:///" in raw_db_url:
        db_path_str = raw_db_url.replace("sqlite:///", "", 1)
        if db_path_str and db_path_str != ":memory:":
            try:
                db_file = Path(db_path_str)
                if db_file.parent and str(db_file.parent) != ".":
                    db_file.parent.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass

engine = create_engine(
    raw_db_url,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_compatibility():
    """
    Safely inspects existing SQLite tables and adds missing columns without dropping data.
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    from sqlalchemy import text
    with engine.connect() as conn:
        # Check AlertDelivery columns
        try:
            res = conn.execute(text("PRAGMA table_info(alert_deliveries)")).fetchall()
            existing_cols = [row[1] for row in res]
            if existing_cols:
                if "retry_count" not in existing_cols:
                    conn.execute(text("ALTER TABLE alert_deliveries ADD COLUMN retry_count INTEGER DEFAULT 0"))
                if "failure_reason" not in existing_cols:
                    conn.execute(text("ALTER TABLE alert_deliveries ADD COLUMN failure_reason VARCHAR"))
                if "acknowledged_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE alert_deliveries ADD COLUMN acknowledged_at DATETIME"))
                conn.commit()
        except Exception:
            pass

        # Check EmergencyRequest columns
        try:
            res = conn.execute(text("PRAGMA table_info(emergency_requests)")).fetchall()
            existing_cols = [row[1] for row in res]
            if existing_cols:
                if "triage_priority" not in existing_cols:
                    conn.execute(text("ALTER TABLE emergency_requests ADD COLUMN triage_priority VARCHAR DEFAULT 'STANDARD'"))
                if "estimated_arrival_seconds" not in existing_cols:
                    conn.execute(text("ALTER TABLE emergency_requests ADD COLUMN estimated_arrival_seconds INTEGER DEFAULT 0"))
                if "scheduling_reason" not in existing_cols:
                    conn.execute(text("ALTER TABLE emergency_requests ADD COLUMN scheduling_reason VARCHAR"))
                if "clearance_seconds" not in existing_cols:
                    conn.execute(text("ALTER TABLE emergency_requests ADD COLUMN clearance_seconds INTEGER DEFAULT 3"))
                conn.commit()
        except Exception:
            pass

