from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..database import get_db
from ..models.deck import Deck
from ..models.flashcard import Flashcard
from ..models.note import Note
from ..models.user import User
from ..schemas.deck import DeckCreate, DeckOut, DeckUpdate
from ..schemas.flashcard import FlashcardOut


router = APIRouter(prefix="/api/decks", tags=["decks"])


def _own_deck(db: Session, deck_id: int, user: User) -> Deck:
    deck = db.get(Deck, deck_id)
    if not deck or deck.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    return deck


def _decorate(db: Session, deck: Deck) -> DeckOut:
    now = datetime.now(timezone.utc)
    card_count = db.scalar(select(func.count(Flashcard.id)).where(Flashcard.deck_id == deck.id)) or 0
    due_count = (
        db.scalar(
            select(func.count(Flashcard.id)).where(
                Flashcard.deck_id == deck.id, Flashcard.due_at <= now
            )
        )
        or 0
    )
    out = DeckOut.model_validate(deck)
    out.card_count = card_count
    out.due_count = due_count
    return out


@router.get("", response_model=list[DeckOut])
def list_decks(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[DeckOut]:
    decks = list(
        db.scalars(select(Deck).where(Deck.owner_id == current.id).order_by(desc(Deck.updated_at)))
    )
    return [_decorate(db, d) for d in decks]


@router.post("", response_model=DeckOut, status_code=status.HTTP_201_CREATED)
def create_deck(
    payload: DeckCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> DeckOut:
    if payload.note_id is not None:
        note = db.get(Note, payload.note_id)
        if not note or note.owner_id != current.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked note not found")

    deck = Deck(
        owner_id=current.id,
        name=payload.name.strip(),
        description=payload.description,
        note_id=payload.note_id,
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return _decorate(db, deck)


@router.get("/{deck_id}", response_model=DeckOut)
def get_deck(
    deck_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> DeckOut:
    return _decorate(db, _own_deck(db, deck_id, current))


@router.patch("/{deck_id}", response_model=DeckOut)
def update_deck(
    deck_id: int,
    payload: DeckUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> DeckOut:
    deck = _own_deck(db, deck_id, current)
    if payload.name is not None:
        deck.name = payload.name.strip()
    if payload.description is not None:
        deck.description = payload.description
    db.commit()
    db.refresh(deck)
    return _decorate(db, deck)


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(
    deck_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    deck = _own_deck(db, deck_id, current)
    db.delete(deck)
    db.commit()


@router.get("/{deck_id}/cards", response_model=list[FlashcardOut])
def list_cards(
    deck_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[Flashcard]:
    _own_deck(db, deck_id, current)
    return list(
        db.scalars(select(Flashcard).where(Flashcard.deck_id == deck_id).order_by(Flashcard.id))
    )


@router.get("/{deck_id}/due", response_model=list[FlashcardOut])
def list_due_cards(
    deck_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[Flashcard]:
    _own_deck(db, deck_id, current)
    now = datetime.now(timezone.utc)
    return list(
        db.scalars(
            select(Flashcard)
            .where(Flashcard.deck_id == deck_id, Flashcard.due_at <= now)
            .order_by(Flashcard.due_at)
            .limit(limit)
        )
    )


@router.post("/{deck_id}/reset-progress", response_model=DeckOut)
def reset_deck_progress(
    deck_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> DeckOut:
    deck = _own_deck(db, deck_id, current)
    now = datetime.now(timezone.utc)
    cards = list(db.scalars(select(Flashcard).where(Flashcard.deck_id == deck.id)))
    for card in cards:
        card.ease_factor = 2.5
        card.interval_days = 0
        card.repetitions = 0
        card.due_at = now
        card.last_reviewed_at = None
    db.commit()
    return _decorate(db, deck)
