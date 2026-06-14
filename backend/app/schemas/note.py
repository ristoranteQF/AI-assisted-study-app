from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteHighlightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    importance: int
    reason: str | None = None


class NoteKeywordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    term: str
    definition: str | None = None
    weight: float


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    content: str | None = None
    summary: str | None = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source_type: str
    original_filename: str | None = None
    summary: str | None = None
    created_at: datetime
    updated_at: datetime


class NoteDetail(NoteOut):
    content: str
    highlights: list[NoteHighlightOut] = []
    keywords: list[NoteKeywordOut] = []
