"""
RouteX User Account Manager
Safely inspects, seeds, or resets account passwords in the active database
without deleting tables, resetting records, or tampering with audit logs.
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models import User, UserRole, utc_now
from app.auth import hash_password, verify_password
from app.config import settings
from sqlalchemy import func


def list_users():
    """Lists all accounts in the currently configured database."""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"[*] Active Database: {settings.DATABASE_URL}")
        print(f"[*] Total Registered Users: {len(users)}")
        for u in users:
            print(f"  - [{u.role.value}] {u.email} ('{u.full_name}') - Active: {u.is_active}")
    finally:
        db.close()


def create_or_reset_user(email: str, password: str, role: UserRole = UserRole.OPERATOR, full_name: str = "Operator"):
    """
    Safely creates or resets a user password in the configured database.
    Does not drop or delete any existing data.
    """
    db = SessionLocal()
    clean_email = email.strip().lower()
    clean_password = password.strip()
    try:
        user = db.query(User).filter(func.lower(User.email) == clean_email).first()
        if user:
            print(f"[*] Existing user found for '{clean_email}'. Updating password...")
            user.hashed_password = hash_password(clean_password)
            user.is_active = True
            db.commit()
            print(f"[OK] Password updated for '{clean_email}'.")
        else:
            print(f"[*] Creating new account for '{clean_email}' with role '{role.value}'...")
            new_user = User(
                email=clean_email,
                hashed_password=hash_password(clean_password),
                full_name=full_name,
                role=role,
                is_active=True,
                created_at=utc_now()
            )
            db.add(new_user)
            db.commit()
            print(f"[OK] Account created for '{clean_email}'.")

        # Verify password immediately
        user_verify = db.query(User).filter(func.lower(User.email) == clean_email).first()
        is_valid = verify_password(clean_password, user_verify.hashed_password)
        print(f"[VERIFIED] Password check: {is_valid}")
        return is_valid
    finally:
        db.close()


def ensure_demo_accounts():
    """Ensures all standard demo personas exist with valid verified passwords."""
    demos = [
        ("operator@routex.org", "operator123", UserRole.OPERATOR, "Traffic Operations Commander"),
        ("admin@routex.org", "admin123", UserRole.ADMIN, "System Administrator"),
        ("driver1@routex.org", "driver123", UserRole.DRIVER, "Ambulance Driver Mark"),
        ("citizen@routex.org", "citizen123", UserRole.CITIZEN, "Citizen Road User")
    ]
    for email, pwd, role, name in demos:
        create_or_reset_user(email, pwd, role, name)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "list":
        list_users()
    elif len(sys.argv) > 1 and sys.argv[1] == "reset-demo":
        ensure_demo_accounts()
    elif len(sys.argv) >= 3:
        email = sys.argv[1]
        password = sys.argv[2]
        role_str = sys.argv[3].upper() if len(sys.argv) > 3 else "OPERATOR"
        role = UserRole(role_str.lower())
        create_or_reset_user(email, password, role)
    else:
        list_users()
        print("\nCommands:")
        print("  python scripts/manage_account.py list")
        print("  python scripts/manage_account.py reset-demo")
        print("  python scripts/manage_account.py <email> <new_password> [operator|admin|driver]")
