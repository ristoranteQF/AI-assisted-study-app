from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..core.deps import get_current_user
from ..core.email import send_email
from ..core.security import (
    create_email_change_token,
    hash_password,
    verify_password,
)
from ..database import get_db
from ..models.user import User
from ..schemas.auth import MessageResponse
from ..schemas.user import PasswordChange, UserOut, UserUpdate


router = APIRouter(prefix="/api/users", tags=["users"])


def _send_email_change_email(background: BackgroundTasks, user: User, new_email: str) -> None:
    token = create_email_change_token(user.id, new_email)
    link = f"{settings.FRONTEND_URL}/confirm-email-change?token={token}"
    body = (
        f"Hi {user.full_name or 'there'},\n\n"
        f"You requested to change your StudyBuddy account email to this address.\n"
        f"To confirm the change, click the link below:\n\n"
        f"{link}\n\n"
        f"This link expires in {settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS} hours. "
        f"If you didn't request this, you can safely ignore this email — "
        f"your account email will not be changed.\n"
    )
    background.add_task(send_email, new_email, "Confirm your StudyBuddy email change", body)


@router.get("/me", response_model=UserOut)
def read_me(current: User = Depends(get_current_user)) -> User:
    return current


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    background: BackgroundTasks,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if payload.full_name is not None:
        current.full_name = payload.full_name.strip()

    if payload.email is not None:
        new_email = payload.email.lower()
        if new_email != current.email:
            clash = db.scalar(
                select(User).where(
                    User.id != current.id,
                    or_(User.email == new_email, User.pending_email == new_email),
                )
            )
            if clash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already in use",
                )
        
            current.pending_email = new_email
            _send_email_change_email(background, current, new_email)
        else:
            current.pending_email = None

    db.commit()
    db.refresh(current)
    return current


@router.delete("/me/pending-email", response_model=UserOut)
def cancel_pending_email(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    current.pending_email = None
    db.commit()
    db.refresh(current)
    return current


@router.post("/me/password", response_model=MessageResponse)
def change_password(
    payload: PasswordChange,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if not verify_password(payload.current_password, current.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current.hashed_password = hash_password(payload.new_password)
    db.commit()
    return MessageResponse(message="Password updated.")


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(current: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    db.delete(current)
    db.commit()
