from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..database import get_db
from ..models.deck import Deck
from ..models.flashcard import Flashcard, ReviewLog
from ..models.user import User
from ..schemas.flashcard import FlashcardCreate, FlashcardOut, FlashcardUpdate, ReviewRequest
from ..services.spaced_repetition import schedule


router = APIRouter(prefix="/api/flashcards", tags=["flashcards"])


def _own_card(db: Session, card_id: int, user: User) -> Flashcard:
    card = db.get(Flashcard, card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")
    deck = db.get(Deck, card.deck_id)
    if not deck or deck.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")
    return card


@router.post("/decks/{deck_id}", response_model=FlashcardOut, status_code=status.HTTP_201_CREATED)
def create_card(
    deck_id: int,
    payload: FlashcardCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Flashcard:
    deck = db.get(Deck, deck_id)
    if not deck or deck.owner_id != current.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    card = Flashcard(
        deck_id=deck.id,
        question=payload.question,
        answer=payload.answer,
        hint=payload.hint,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.patch("/{card_id}", response_model=FlashcardOut)
def update_card(
    card_id: int,
    payload: FlashcardUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Flashcard:
    card = _own_card(db, card_id, current)
    if payload.question is not None:
        card.question = payload.question
    if payload.answer is not None:
        card.answer = payload.answer
    if payload.hint is not None:
        card.hint = payload.hint
    db.commit()
    db.refresh(card)
    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    card = _own_card(db, card_id, current)
    db.delete(card)
    db.commit()


@router.post("/{card_id}/review", response_model=FlashcardOut)
def review_card(
    card_id: int,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Flashcard:
    card = _own_card(db, card_id, current)

    result = schedule(
        quality=payload.quality,
        ease_factor=card.ease_factor,
        interval_days=card.interval_days,
        repetitions=card.repetitions,
    )
    card.ease_factor = result.ease_factor
    card.interval_days = result.interval_days
    card.repetitions = result.repetitions
    card.due_at = result.due_at
    card.last_reviewed_at = result.last_reviewed_at

    db.add(ReviewLog(flashcard_id=card.id, user_id=current.id, quality=payload.quality))
    db.commit()
    db.refresh(card)
    return card
