# API reference

Base URL: `/api`. All non-auth endpoints require an `Authorization: Bearer
<jwt>` header. The interactive Swagger UI lives at `/docs` and the ReDoc
version at `/redoc`.


---

## Auth — `/api/auth`

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/signup` | none | `{email, password, full_name}` | `Token` (and triggers verification email) |
| POST | `/login` | none | `{email, password}` | `Token` |
| POST | `/forgot-password` | none | `{email}` | `{message}` (always generic) |
| POST | `/reset-password` | none | `{token, new_password}` | `{message}` |
| POST | `/verify-email` | none | `{token}` | `{message}` |
| POST | `/resend-verification` | none | `{email}` | `{message}` |

**Token** = `{access_token, token_type: "bearer", user: User}`. Access
tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` minutes (default 60).

## Users — `/api/users`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/me` | — | `User` |
| PATCH | `/me` | `{full_name?, email?}` | `User` (changing email un-verifies it) |
| POST | `/me/password` | `{current_password, new_password}` | `{message}` |
| DELETE | `/me` | — | `204 No Content` |

## Notes — `/api/notes`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `` | — | `Note[]` (summary fields only) |
| POST | `` | `{title, content}` | `NoteDetail` |
| POST | `/upload` (multipart) | `title`, `file` | `NoteDetail` |
| GET | `/{id}` | — | `NoteDetail` |
| PATCH | `/{id}` | `{title?, content?, summary?}` | `NoteDetail` |
| DELETE | `/{id}` | — | `204` |

`NoteDetail` includes the AI-extracted `highlights` and `keywords`
collections (empty until you trigger the AI insights endpoint).

## Decks — `/api/decks`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `` | — | `Deck[]` (each has `card_count`, `due_count`) |
| POST | `` | `{name, description?, note_id?}` | `Deck` |
| GET | `/{id}` | — | `Deck` |
| PATCH | `/{id}` | `{name?, description?}` | `Deck` |
| DELETE | `/{id}` | — | `204` |
| GET | `/{id}/cards` | — | `Flashcard[]` |
| GET | `/{id}/due?limit=50` | — | `Flashcard[]` (cards with `due_at <= now`) |

## Flashcards — `/api/flashcards`

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/decks/{deck_id}` | `{question, answer, hint?}` | `Flashcard` |
| PATCH | `/{id}` | `{question?, answer?, hint?}` | `Flashcard` |
| DELETE | `/{id}` | — | `204` |
| POST | `/{id}/review` | `{quality: 0..5}` | `Flashcard` (with new SM-2 state) |

The review endpoint is the heart of spaced repetition — it logs a
`ReviewLog` row and updates `ease_factor`, `interval_days`, `repetitions`,
`due_at`.

## Quizzes — `/api/quizzes`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `` | — | `Quiz[]` (each has `question_count`) |
| POST | `` | `QuizCreate` | `QuizDetail` |
| GET | `/{id}` | — | `QuizDetail` (includes `questions[]`) |
| PATCH | `/{id}` | `{title?, description?}` | `Quiz` |
| DELETE | `/{id}` | — | `204` |
| POST | `/{id}/submit` | `{answers: [{question_id, selected_index}]}` | `QuizAttempt` |
| GET | `/{id}/attempts` | — | `QuizAttempt[]` (most-recent first) |

## Sessions — `/api/sessions`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `?limit=30` | — | `StudySession[]` |
| POST | `/start` | `{activity, deck_id?, quiz_id?, note_id?}` | `StudySession` |
| POST | `/{id}/end` | `{duration_seconds, cards_reviewed, correct_count, incorrect_count}` | `StudySession` |

The Study and Quiz pages call `start` when they mount and `end` when they
unmount or finish, so analytics reflects real wall-clock time spent.

## Analytics — `/api/analytics`

| Method | Path | Returns |
|---|---|---|
| GET | `/overview` | `AnalyticsOverview` |

`AnalyticsOverview` shape:

```jsonc
{
  "total_notes": 12,
  "total_decks": 4,
  "total_cards": 88,
  "total_quizzes": 3,
  "cards_due_today": 17,
  "sessions_last_7_days": 9,
  "minutes_last_7_days": 142,
  "accuracy_last_30_days": 0.83,
  "streak_days": 5,
  "daily": [
    {"date": "2026-04-13", "minutes": 12, "cards_reviewed": 18, "accuracy": 0.78},
    ...
  ]
}
```

## AI — `/api/ai`

All AI endpoints return 503 if `ANTHROPIC_API_KEY` is unset.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/status` | — | `{enabled, model}` |
| POST | `/summary` | `{note_id}` | `NoteDetail` (with `summary` filled in) |
| POST | `/insights` | `{note_id}` | `NoteDetail` (replaces highlights + keywords) |
| POST | `/flashcards` | `{note_id, count?, deck_name?}` | `Deck` (newly created) |
| POST | `/quiz` | `{note_id, count?, title?}` | `QuizDetail` (newly created) |

`count` is clamped server-side: 1-40 for flashcards, 1-20 for quizzes.

## Health

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{status: "ok", name}` |
