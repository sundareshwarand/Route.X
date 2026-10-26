import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, UserRole, utc_now
from ..schemas import UserCreate, UserResponse, Token, LoginRequest
from ..auth import hash_password, verify_password, create_access_token, get_current_user
from ..config import settings

logger = logging.getLogger("routex.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    email_clean = (user_in.email or "").strip().lower()
    existing = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
    user = User(
        email=email_clean,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=True,
        created_at=utc_now()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"User registered successfully: email={email_clean} role={user.role.value}")
    return user


@router.post("/login", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email_clean = (form_data.username or "").strip().lower()
    raw_password = form_data.password or ""  # Passwords must not be modified by normalization
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()
    user_exists = bool(user)
    password_valid = verify_password(raw_password, user.hashed_password) if user else False

    logger.info(f"OAuth2 form login attempt: email={email_clean} | user_exists={user_exists} | password_valid={password_valid}")

    if not user or not password_valid:
        logger.warning(f"OAuth2 form login rejected: invalid credentials for email={email_clean}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        logger.warning(f"OAuth2 form login rejected: inactive account for email={email_clean}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "user_id": user.id},
        expires_delta=access_token_expires
    )
    logger.info(f"OAuth2 form login granted: email={email_clean} role={user.role.value}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/login/json", response_model=Token)
def login_json(payload: LoginRequest, db: Session = Depends(get_db)):
    email_clean = (payload.email or "").strip().lower()
    raw_password = payload.password or ""  # Passwords must not be modified by normalization
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()
    user_exists = bool(user)
    password_valid = verify_password(raw_password, user.hashed_password) if user else False

    logger.info(f"JSON login attempt: email={email_clean} | user_exists={user_exists} | password_valid={password_valid}")

    if not user or not password_valid:
        logger.warning(f"JSON login rejected: invalid credentials for email={email_clean}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if not user.is_active:
        logger.warning(f"JSON login rejected: inactive account for email={email_clean}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "user_id": user.id},
        expires_delta=access_token_expires
    )
    logger.info(f"JSON login granted: email={email_clean} role={user.role.value}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserResponse)
def read_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user
