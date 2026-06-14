from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..core.deps import get_current_user
from ..database import get_db
from ..models.note import Note
from ..models.user import User
from ..schemas.note import NoteCreate, NoteDetail, NoteOut, NoteUpdate
from ..services.file_service import SUPPORTED_EXTS, extract_text


router = APIRouter(prefix="/api/notes", tags=["notes"])


def _own_note(db: Session, note_id: int, user: User) -> Note:
    note = db.get(Note, note_id, options=[selectinload(Note.highlights), selectinload(Note.keywords)])
    if not note or note.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.get("", response_model=list[NoteOut])
def list_notes(
    db: Session = Depends(get_db), current: User = Depends(get_current_user)
) -> list[Note]:
    return list(
        db.scalars(select(Note).where(Note.owner_id == current.id).order_by(desc(Note.updated_at)))
    )


@router.post("", response_model=NoteDetail, status_code=status.HTTP_201_CREATED)
def create_note(
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Note:
    note = Note(
        owner_id=current.id,
        title=payload.title.strip(),
        content=payload.content,
        source_type="text",
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.post("/upload", response_model=NoteDetail, status_code=status.HTTP_201_CREATED)
async def upload_note(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Note:
    suffix = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in file.filename else ""
    if suffix not in SUPPORTED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(SUPPORTED_EXTS))}",
        )

    data = await file.read()
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_MB} MB",
        )

    try:
        content = extract_text(file.filename, data)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract text from this file. Try a different format.",
        )

    MAX_CONTENT_CHARS = 1_000_000
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS]

    note = Note(
        owner_id=current.id,
        title=title.strip() or file.filename,
        original_filename=file.filename,
        content=content,
        source_type=suffix.lstrip("."),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{note_id}", response_model=NoteDetail)
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Note:
    return _own_note(db, note_id, current)


@router.patch("/{note_id}", response_model=NoteDetail)
def update_note(
    note_id: int,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Note:
    note = _own_note(db, note_id, current)
    if payload.title is not None:
        note.title = payload.title.strip()
    if payload.content is not None:
        note.content = payload.content
    if payload.summary is not None:
        note.summary = payload.summary
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    note = _own_note(db, note_id, current)
    db.delete(note)
    db.commit()
