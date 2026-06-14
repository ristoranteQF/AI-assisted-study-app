from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="text")  # text|pdf|docx
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User", back_populates="notes")
    decks = relationship("Deck", back_populates="note")
    quizzes = relationship("Quiz", back_populates="note")
    highlights = relationship("NoteHighlight", back_populates="note", cascade="all, delete-orphan")
    keywords = relationship("NoteKeyword", back_populates="note", cascade="all, delete-orphan")


class NoteHighlight(Base):
    __tablename__ = "note_highlights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[int] = mapped_column(Integer, default=3)  # 1-5
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    note = relationship("Note", back_populates="highlights")


class NoteKeyword(Base):
    __tablename__ = "note_keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    term: Mapped[str] = mapped_column(String(120), nullable=False)
    definition: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight: Mapped[float] = mapped_column(default=1.0)

    note = relationship("Note", back_populates="keywords")
