from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import jwt, JWTError

from ..config import settings


# bcrypt has a hard 72-byte input limit. We truncate explicitly so long
# passwords are accepted (silently capped) rather than raising at runtime.
_BCRYPT_MAX = 72


def hash_password(password: str) -> str:
    pw = password.encode("utf-8")[:_BCRYPT_MAX]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pw = plain.encode("utf-8")[:_BCRYPT_MAX]
    try:
        return bcrypt.checkpw(pw, hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(subject: str, expires_delta: timedelta, token_type: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "type": token_type,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_password_reset_token(user_id: int) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES),
        token_type="reset",
    )


def create_email_verification_token(user_id: int) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(hours=settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS),
        token_type="verify",
    )


def create_email_change_token(user_id: int, new_email: str) -> str:
    """Token sent to the *new* address to confirm an email change.

    The new email is embedded so a stale token (e.g. user requested another
    change since) can be detected and rejected at confirmation time.
    """
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(hours=settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS),
        token_type="email_change",
        extra={"new_email": new_email.lower()},
    )


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
    if expected_type and payload.get("type") != expected_type:
        raise ValueError("Wrong token type")
    return payload



