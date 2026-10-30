from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Normalize database URL (e.g. handle Render/Heroku postgres:// -> postgresql://)
raw_db_url = settings.DATABASE_URL
if not raw_db_url or not str(raw_db_url).strip():
    raw_db_url = "sqlite:///./routex.db"
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

engine_kwargs = {"pool_pre_ping": True}
if not raw_db_url.startswith("sqlite"):
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 300,
        "pool_timeout": 30
    })

engine = create_engine(
    raw_db_url,
    connect_args=connect_args,
    **engine_kwargs
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
    Safely inspects tables across SQLite and PostgreSQL and adds missing columns without dropping data.
    """
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        with engine.connect() as conn:
            if "alert_deliveries" in table_names:
                cols = [c["name"] for c in inspector.get_columns("alert_deliveries")]
                if "retry_count" not in cols:
                    conn.execute(text("ALTER TABLE alert_deliveries ADD COLUMN retry_count INTEGER DEFAULT 0"))
                if "failure_reason" not in cols:
                    conn.execute(text("ALTER TABLE alert_deliveries ADD COLUMN failure_reason VARCHAR"))
                if "acknowledged_at" not in cols:
                    conn.execute(text("ALTER TABLE alert_deliveries ADD COLUMN acknowledged_at TIMESTAMP"))
                conn.commit()

            if "emergency_requests" in table_names:
                cols = [c["name"] for c in inspector.get_columns("emergency_requests")]
                if "triage_priority" not in cols:
                    conn.execute(text("ALTER TABLE emergency_requests ADD COLUMN triage_priority VARCHAR DEFAULT 'STANDARD'"))
                if "estimated_arrival_seconds" not in cols:
                    conn.execute(text("ALTER TABLE emergency_requests ADD COLUMN estimated_arrival_seconds INTEGER DEFAULT 0"))
                if "scheduling_reason" not in cols:
                    conn.execute(text("ALTER TABLE emergency_requests ADD COLUMN scheduling_reason VARCHAR"))
                if "clearance_seconds" not in cols:
                    conn.execute(text("ALTER TABLE emergency_requests ADD COLUMN clearance_seconds INTEGER DEFAULT 3"))
                conn.commit()
    except Exception:
        pass

