from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..database import get_db
from ..models.deck import Deck
from ..models.flashcard import Flashcard, ReviewLog
from ..models.note import Note
from ..models.quiz import Quiz
from ..models.study_session import StudySession
from ..models.user import User
from ..schemas.study_session import AnalyticsOverview


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _streak(dates: set[date]) -> int:
    if not dates:
        return 0
    today = date.today()
    streak = 0
    cursor = today
    # If user studied today, start counting; otherwise start from yesterday so a
    # gap of one day still doesn't reset the streak immediately at midnight.
    if today not in dates:
        cursor = today - timedelta(days=1)
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("/overview", response_model=AnalyticsOverview)
def overview(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> AnalyticsOverview:
    now = datetime.now(timezone.utc)
    today = now.date()

    total_notes = db.scalar(select(func.count(Note.id)).where(Note.owner_id == current.id)) or 0
    total_decks = db.scalar(select(func.count(Deck.id)).where(Deck.owner_id == current.id)) or 0
    total_cards = (
        db.scalar(
            select(func.count(Flashcard.id))
            .join(Deck, Deck.id == Flashcard.deck_id)
            .where(Deck.owner_id == current.id)
        )
        or 0
    )
    total_quizzes = db.scalar(select(func.count(Quiz.id)).where(Quiz.owner_id == current.id)) or 0
    cards_due_today = (
        db.scalar(
            select(func.count(Flashcard.id))
            .join(Deck, Deck.id == Flashcard.deck_id)
            .where(Deck.owner_id == current.id, Flashcard.due_at <= now)
        )
        or 0
    )

    # last 7 days of sessions
    since_7 = now - timedelta(days=7)
    sessions_7 = list(
        db.scalars(
            select(StudySession).where(
                StudySession.user_id == current.id, StudySession.started_at >= since_7
            )
        )
    )
    sessions_last_7 = len(sessions_7)
    minutes_last_7 = sum(s.duration_seconds for s in sessions_7) // 60

    # accuracy from review logs in last 30 days
    since_30 = now - timedelta(days=30)
    reviews_30 = list(
        db.scalars(
            select(ReviewLog).where(
                ReviewLog.user_id == current.id, ReviewLog.reviewed_at >= since_30
            )
        )
    )
    if reviews_30:
        good = sum(1 for r in reviews_30 if r.quality >= 3)
        accuracy_30 = good / len(reviews_30)
    else:
        accuracy_30 = 0.0

    # daily breakdown for last 14 days
    since_14 = now - timedelta(days=14)
    sessions_14 = list(
        db.scalars(
            select(StudySession).where(
                StudySession.user_id == current.id, StudySession.started_at >= since_14
            )
        )
    )
    daily_minutes: dict[date, int] = defaultdict(int)
    daily_cards: dict[date, int] = defaultdict(int)
    daily_correct: dict[date, int] = defaultdict(int)
    daily_total: dict[date, int] = defaultdict(int)
    for s in sessions_14:
        d = s.started_at.date()
        daily_minutes[d] += s.duration_seconds // 60
        daily_cards[d] += s.cards_reviewed
        daily_correct[d] += s.correct_count
        daily_total[d] += s.correct_count + s.incorrect_count

    daily = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        total = daily_total[d]
        daily.append(
            {
                "date": d.isoformat(),
                "minutes": daily_minutes[d],
                "cards_reviewed": daily_cards[d],
                "accuracy": round(daily_correct[d] / total, 3) if total else 0.0,
            }
        )

    # streak: any session counts
    session_dates = {s.started_at.date() for s in sessions_14}
    # Extend lookup window for streak calculation up to 90 days back
    since_90 = now - timedelta(days=90)
    extra = db.scalars(
        select(StudySession.started_at).where(
            StudySession.user_id == current.id, StudySession.started_at >= since_90
        )
    ).all()
    session_dates.update({d.date() for d in extra})

    return AnalyticsOverview(
        total_notes=total_notes,
        total_decks=total_decks,
        total_cards=total_cards,
        total_quizzes=total_quizzes,
        cards_due_today=cards_due_today,
        sessions_last_7_days=sessions_last_7,
        minutes_last_7_days=minutes_last_7,
        accuracy_last_30_days=round(accuracy_30, 3),
        streak_days=_streak(session_dates),
        daily=daily,
    )
