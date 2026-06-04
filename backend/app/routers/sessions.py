from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..database import get_db
from ..models.study_session import StudySession
from ..models.user import User
from ..schemas.study_session import StudySessionEnd, StudySessionOut, StudySessionStart


router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=list[StudySessionOut])
def list_sessions(
    limit: int = 30,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[StudySession]:
    return list(
        db.scalars(
            select(StudySession)
            .where(StudySession.user_id == current.id)
            .order_by(desc(StudySession.started_at))
            .limit(limit)
        )
    )


@router.post("/start", response_model=StudySessionOut, status_code=status.HTTP_201_CREATED)
def start_session(
    payload: StudySessionStart,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> StudySession:
    session = StudySession(
        user_id=current.id,
        activity=payload.activity,
        deck_id=payload.deck_id,
        quiz_id=payload.quiz_id,
        note_id=payload.note_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/end", response_model=StudySessionOut)
def end_session(
    session_id: int,
    payload: StudySessionEnd,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> StudySession:
    session = db.get(StudySession, session_id)
    if not session or session.user_id != current.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.ended_at = datetime.now(timezone.utc)
    session.duration_seconds = max(0, payload.duration_seconds)
    session.cards_reviewed = payload.cards_reviewed
    session.correct_count = payload.correct_count
    session.incorrect_count = payload.incorrect_count
    db.commit()
    db.refresh(session)
    return session
