from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class QuizQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    prompt: str
    options: list[str]
    correct_index: int
    explanation: str | None = None


class QuizQuestionCreate(BaseModel):
    prompt: str
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0)
    explanation: str | None = None


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    note_id: int | None = None
    questions: list[QuizQuestionCreate] = []


class QuizUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None = None
    note_id: int | None = None
    created_at: datetime
    question_count: int = 0


class QuizDetail(QuizOut):
    questions: list[QuizQuestionOut] = []


class QuizAnswerSubmit(BaseModel):
    question_id: int
    selected_index: int


class QuizSubmit(BaseModel):
    answers: list[QuizAnswerSubmit]


class QuizAttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    quiz_id: int
    score: int
    total: int
    completed_at: datetime
