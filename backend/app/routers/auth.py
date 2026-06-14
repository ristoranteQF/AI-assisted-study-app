from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..core.email import send_email
from ..core.security import (
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    decode_token,
    hash_password,
    verify_password,
)
from ..database import get_db
from ..models.user import User
from ..schemas.auth import (
    ConfirmEmailChangeRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    Token,
    VerifyEmailRequest,
)
from ..schemas.user import UserCreate, UserOut


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _send_verification_email(background: BackgroundTasks, user: User) -> None:
    token = create_email_verification_token(user.id)
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    body = (
        f"Hi {user.full_name or 'there'},\n\n"
        f"Welcome to StudyBuddy! Please verify your email address by visiting:\n\n"
        f"{link}\n\n"
        f"This link expires in {settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS} hours.\n"
    )
    background.add_task(send_email, user.email, "Verify your StudyBuddy email", body)


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, background: BackgroundTasks, db: Session = Depends(get_db)) -> Token:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _send_verification_email(background, user)

    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    return Token(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest, background: BackgroundTasks, db: Session = Depends(get_db)
) -> MessageResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user and user.is_active:
        token = create_password_reset_token(user.id)
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        body = (
            f"Hi {user.full_name or 'there'},\n\n"
            f"Someone (hopefully you) requested a password reset. "
            f"Reset your password here:\n\n{link}\n\n"
            f"This link expires in {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes. "
            f"If you didn't request it, you can safely ignore this email.\n"
        )
        background.add_task(send_email, user.email, "StudyBuddy password reset", body)

    return MessageResponse(message="If that email is registered, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        data = decode_token(payload.token, expected_type="reset")
        user_id = int(data["sub"])
    except (ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return MessageResponse(message="Password has been reset.")


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        data = decode_token(payload.token, expected_type="verify")
        user_id = int(data["sub"])
    except (ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    if not user.is_email_verified:
        user.is_email_verified = True
        db.commit()
    return MessageResponse(message="Email verified.")


@router.post("/confirm-email-change", response_model=MessageResponse)
def confirm_email_change(
    payload: ConfirmEmailChangeRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    try:
        data = decode_token(payload.token, expected_type="email_change")
        user_id = int(data["sub"])
        token_email = str(data.get("new_email", "")).lower()
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token"
        )

    if not token_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token"
        )

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token"
        )

    if user.pending_email != token_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This change request is no longer valid",
        )

    clash = db.scalar(
        select(User).where(User.id != user.id, User.email == token_email)
    )
    if clash:
        user.pending_email = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already in use by another account",
        )

    user.email = token_email
    user.pending_email = None
    user.is_email_verified = True
    db.commit()
    return MessageResponse(message="Email updated and verified.")


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    payload: ForgotPasswordRequest, background: BackgroundTasks, db: Session = Depends(get_db)
) -> MessageResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user and user.is_active and not user.is_email_verified:
        _send_verification_email(background, user)
    return MessageResponse(message="If that account needs verification, a new email was sent.")
