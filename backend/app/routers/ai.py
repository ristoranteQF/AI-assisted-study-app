from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..database import get_db
from ..models.deck import Deck
from ..models.flashcard import Flashcard
from ..models.note import Note, NoteHighlight, NoteKeyword
from ..models.quiz import Quiz, QuizQuestion
from ..models.user import User
from ..schemas.ai import (
    GenerateFlashcardsRequest,
    GenerateInsightsRequest,
    GenerateQuizRequest,
    GenerateSummaryRequest,
)
from ..schemas.deck import DeckOut
from ..schemas.note import NoteDetail
from ..schemas.quiz import QuizDetail
from ..services.ai_service import ai_service


router = APIRouter(prefix="/api/ai", tags=["ai"])


def _own_note(db: Session, note_id: int, user: User) -> Note:
    note = db.get(Note, note_id)
    if not note or note.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


def _ensure_enabled() -> None:
    if not ai_service.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are not configured. Set ANTHROPIC_API_KEY in the backend.",
        )


@router.get("/status")
def status_endpoint() -> dict:
    return {"enabled": ai_service.enabled, "model": ai_service._model if ai_service.enabled else None}


@router.post("/flashcards", response_model=DeckOut)
def generate_flashcards(
    payload: GenerateFlashcardsRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> DeckOut:
    _ensure_enabled()
    note = _own_note(db, payload.note_id, current)

    cards = ai_service.generate_flashcards(note.content, count=payload.count)
    if not cards:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI returned no cards")

    deck = Deck(
        owner_id=current.id,
        note_id=note.id,
        name=(payload.deck_name or note.title)[:255],
        description=f"Auto-generated from note '{note.title}'.",
    )
    for c in cards:
        deck.flashcards.append(
            Flashcard(question=c["question"], answer=c["answer"], hint=c.get("hint"))
        )
    db.add(deck)
    db.commit()
    db.refresh(deck)

    out = DeckOut.model_validate(deck)
    out.card_count = len(deck.flashcards)
    out.due_count = len(deck.flashcards)
    return out


@router.post("/summary", response_model=NoteDetail)
def generate_summary(
    payload: GenerateSummaryRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Note:
    _ensure_enabled()
    note = _own_note(db, payload.note_id, current)

    result = ai_service.generate_summary(note.content)
    parts: list[str] = []
    if result.get("tldr"):
        parts.append(f"TL;DR: {result['tldr']}")
    if result.get("key_points"):
        parts.append("Key points:\n" + "\n".join(f"• {p}" for p in result["key_points"]))
    if result.get("structured_summary"):
        parts.append(result["structured_summary"])
    note.summary = "\n\n".join(parts).strip()

    db.commit()
    db.refresh(note)
    return note


@router.post("/quiz", response_model=QuizDetail)
def generate_quiz(
    payload: GenerateQuizRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Quiz:
    _ensure_enabled()
    note = _own_note(db, payload.note_id, current)

    questions = ai_service.generate_quiz(note.content, count=payload.count)
    if not questions:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI returned no questions")

    quiz = Quiz(
        owner_id=current.id,
        note_id=note.id,
        title=(payload.title or f"Quiz · {note.title}")[:255],
        description=f"Auto-generated from note '{note.title}'.",
    )
    for i, q in enumerate(questions):
        quiz.questions.append(
            QuizQuestion(
                position=i,
                prompt=q["prompt"],
                options=q["options"],
                correct_index=q["correct_index"],
                explanation=q.get("explanation"),
            )
        )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.post("/insights", response_model=NoteDetail)
def generate_insights(
    payload: GenerateInsightsRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Note:
    _ensure_enabled()
    note = _own_note(db, payload.note_id, current)

    result = ai_service.extract_insights(note.content)

    # Replace existing highlights/keywords
    note.highlights.clear()
    note.keywords.clear()
    db.flush()

    for h in result.get("highlights", []):
        note.highlights.append(
            NoteHighlight(text=h["text"], importance=h["importance"], reason=h.get("reason"))
        )
    for k in result.get("keywords", []):
        note.keywords.append(
            NoteKeyword(term=k["term"], definition=k.get("definition"), weight=k.get("weight", 1.0))
        )

    db.commit()
    db.refresh(note)
    return note
