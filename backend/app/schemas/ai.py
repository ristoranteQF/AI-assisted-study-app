from pydantic import BaseModel, Field


class GenerateFlashcardsRequest(BaseModel):
    note_id: int
    deck_name: str | None = None
    count: int = Field(default=10, ge=1, le=40)


class GenerateSummaryRequest(BaseModel):
    note_id: int


class GenerateQuizRequest(BaseModel):
    note_id: int
    title: str | None = None
    count: int = Field(default=8, ge=1, le=20)


class GenerateInsightsRequest(BaseModel):
    note_id: int
