"""
RouteX Database Migration & Backup Tool
Safely backs up local SQLite data and migrates all entities into cloud PostgreSQL (Neon / Supabase).
Preserves IDs, foreign keys, timestamps, and SHA-256 cryptographic audit ledger records.
"""

import sys
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.models import (
    Base,
    User,
    Ambulance,
    Junction,
    Hospital,
    RegisteredDevice,
    EmergencyRequest,
    JunctionEvent,
    NearbyVehicleAlert,
    AlertDelivery,
    ClientSubscription,
    DeviceHeartbeat,
    AuditLog,
    AuditLedgerEntry
)

TABLE_ORDER = [
    User,
    Ambulance,
    Junction,
    Hospital,
    RegisteredDevice,
    EmergencyRequest,
    JunctionEvent,
    NearbyVehicleAlert,
    AlertDelivery,
    ClientSubscription,
    DeviceHeartbeat,
    AuditLog,
    AuditLedgerEntry
]


def backup_sqlite(source_path: str = "routex.db", backup_dir: str = "backups") -> str:
    """Creates a timestamped backup of the SQLite database file."""
    src = Path(source_path)
    if not src.exists():
        print(f"[!] Source database '{source_path}' does not exist. Skipping file backup.")
        return ""
    
    bdir = Path(backup_dir)
    bdir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    dest = bdir / f"routex_backup_{timestamp}.db"
    shutil.copy2(src, dest)
    print(f"[+] SQLite backup saved: {dest} ({dest.stat().st_size} bytes)")
    return str(dest)


def migrate_to_postgres(source_sqlite_url: str, target_postgres_url: str):
    """Migrates all records from SQLite to PostgreSQL without loss."""
    # Normalize postgres URL
    if target_postgres_url.startswith("postgres://"):
        target_postgres_url = target_postgres_url.replace("postgres://", "postgresql://", 1)

    print(f"[*] Connecting to Source SQLite: {source_sqlite_url}")
    src_engine = create_engine(source_sqlite_url, connect_args={"check_same_thread": False})
    SrcSession = sessionmaker(bind=src_engine)
    src_db = SrcSession()

    print(f"[*] Connecting to Target PostgreSQL: {target_postgres_url.split('@')[-1] if '@' in target_postgres_url else target_postgres_url}")
    tgt_engine = create_engine(target_postgres_url, pool_pre_ping=True)
    TgtSession = sessionmaker(bind=tgt_engine)

    # Create all tables on target PostgreSQL
    print("[*] Ensuring schemas and tables exist on target database...")
    Base.metadata.create_all(bind=tgt_engine)
    tgt_db = TgtSession()

    total_migrated = 0
    try:
        for model in TABLE_ORDER:
            records = src_db.query(model).all()
            table_name = model.__tablename__
            count = len(records)
            print(f"[*] Migrating table '{table_name}': {count} records found.")
            
            for item in records:
                # Merge into target session to avoid primary key duplicate conflicts
                tgt_db.merge(item)
            
            tgt_db.commit()
            total_migrated += count
            print(f"    [OK] Table '{table_name}' migrated successfully.")

        print(f"\n[SUCCESS] Completed migration! Total records transferred: {total_migrated}")

    except Exception as e:
        tgt_db.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
        raise
    finally:
        src_db.close()
        tgt_db.close()


if __name__ == "__main__":
    backup_sqlite()
    target_url = os.getenv("TARGET_DATABASE_URL") or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not target_url:
        print("[!] No TARGET_DATABASE_URL provided.")
        print("    Usage: python scripts/migrate_sqlite_to_postgres.py postgresql://user:pass@host/db")
        print("    Or set $env:TARGET_DATABASE_URL='...'")
    else:
        migrate_to_postgres("sqlite:///./routex.db", target_url)
