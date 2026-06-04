from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeckCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    note_id: int | None = None


class DeckUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None


class DeckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    note_id: int | None = None
    created_at: datetime
    updated_at: datetime
    card_count: int = 0
    due_count: int = 0
