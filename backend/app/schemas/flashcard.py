from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FlashcardCreate(BaseModel):
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    hint: str | None = None


class FlashcardUpdate(BaseModel):
    question: str | None = None
    answer: str | None = None
    hint: str | None = None


class FlashcardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deck_id: int
    question: str
    answer: str
    hint: str | None = None
    ease_factor: float
    interval_days: int
    repetitions: int
    due_at: datetime
    last_reviewed_at: datetime | None = None


class ReviewRequest(BaseModel):
    quality: int = Field(ge=0, le=5)
