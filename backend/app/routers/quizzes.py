from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from ..core.deps import get_current_user
from ..database import get_db
from ..models.note import Note
from ..models.quiz import Quiz, QuizAnswer, QuizAttempt, QuizQuestion
from ..models.user import User
from ..schemas.quiz import (
    QuizAttemptOut,
    QuizCreate,
    QuizDetail,
    QuizOut,
    QuizSubmit,
    QuizUpdate,
)


router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


def _own_quiz(db: Session, quiz_id: int, user: User, with_questions: bool = False) -> Quiz:
    opts = [selectinload(Quiz.questions)] if with_questions else []
    quiz = db.get(Quiz, quiz_id, options=opts)
    if not quiz or quiz.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return quiz


def _to_out(db: Session, quiz: Quiz) -> QuizOut:
    out = QuizOut.model_validate(quiz)
    out.question_count = (
        db.scalar(select(func.count(QuizQuestion.id)).where(QuizQuestion.quiz_id == quiz.id)) or 0
    )
    return out


@router.get("", response_model=list[QuizOut])
def list_quizzes(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[QuizOut]:
    quizzes = list(
        db.scalars(select(Quiz).where(Quiz.owner_id == current.id).order_by(desc(Quiz.created_at)))
    )
    return [_to_out(db, q) for q in quizzes]


@router.post("", response_model=QuizDetail, status_code=status.HTTP_201_CREATED)
def create_quiz(
    payload: QuizCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Quiz:
    if payload.note_id is not None:
        note = db.get(Note, payload.note_id)
        if not note or note.owner_id != current.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked note not found")

    quiz = Quiz(
        owner_id=current.id,
        title=payload.title.strip(),
        description=payload.description,
        note_id=payload.note_id,
    )
    for i, q in enumerate(payload.questions):
        if not 0 <= q.correct_index < len(q.options):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="correct_index out of range")
        quiz.questions.append(
            QuizQuestion(
                position=i,
                prompt=q.prompt,
                options=q.options,
                correct_index=q.correct_index,
                explanation=q.explanation,
            )
        )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.get("/{quiz_id}", response_model=QuizDetail)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Quiz:
    return _own_quiz(db, quiz_id, current, with_questions=True)


@router.patch("/{quiz_id}", response_model=QuizOut)
def update_quiz(
    quiz_id: int,
    payload: QuizUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> QuizOut:
    quiz = _own_quiz(db, quiz_id, current)
    if payload.title is not None:
        quiz.title = payload.title.strip()
    if payload.description is not None:
        quiz.description = payload.description
    db.commit()
    db.refresh(quiz)
    return _to_out(db, quiz)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    quiz = _own_quiz(db, quiz_id, current)
    db.delete(quiz)
    db.commit()


@router.post("/{quiz_id}/submit", response_model=QuizAttemptOut)
def submit_quiz(
    quiz_id: int,
    payload: QuizSubmit,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> QuizAttempt:
    quiz = _own_quiz(db, quiz_id, current, with_questions=True)
    questions = {q.id: q for q in quiz.questions}

    attempt = QuizAttempt(quiz_id=quiz.id, user_id=current.id, score=0, total=len(quiz.questions))
    correct = 0
    for ans in payload.answers:
        question = questions.get(ans.question_id)
        if question is None:
            continue
        is_correct = ans.selected_index == question.correct_index
        if is_correct:
            correct += 1
        attempt.answers.append(
            QuizAnswer(
                question_id=question.id,
                selected_index=ans.selected_index,
                is_correct=is_correct,
            )
        )
    attempt.score = correct
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/{quiz_id}/attempts", response_model=list[QuizAttemptOut])
def list_attempts(
    quiz_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[QuizAttempt]:
    _own_quiz(db, quiz_id, current)
    return list(
        db.scalars(
            select(QuizAttempt)
            .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == current.id)
            .order_by(desc(QuizAttempt.completed_at))
        )
    )
