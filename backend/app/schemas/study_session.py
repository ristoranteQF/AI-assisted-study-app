from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StudySessionStart(BaseModel):
    activity: str = "flashcards"
    deck_id: int | None = None
    quiz_id: int | None = None
    note_id: int | None = None


class StudySessionEnd(BaseModel):
    duration_seconds: int = 0
    cards_reviewed: int = 0
    correct_count: int = 0
    incorrect_count: int = 0


class StudySessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activity: str
    deck_id: int | None = None
    quiz_id: int | None = None
    note_id: int | None = None
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: int
    cards_reviewed: int
    correct_count: int
    incorrect_count: int


class AnalyticsOverview(BaseModel):
    total_notes: int
    total_decks: int
    total_cards: int
    total_quizzes: int
    cards_due_today: int
    sessions_last_7_days: int
    minutes_last_7_days: int
    accuracy_last_30_days: float  # 0-1
    streak_days: int
    daily: list[dict]  # [{date, minutes, cards_reviewed, accuracy}]
