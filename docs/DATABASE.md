# Database schema

PostgreSQL is the only supported database. All tables are managed by SQLAlchemy
2.0 declarative models in `backend/app/models/`. On first startup the backend
runs `Base.metadata.create_all`; for production swap that for Alembic
migrations (see SETUP.md).

## Entity-relationship diagram

```
              ┌──────────┐
              │  users   │
              └────┬─────┘
        ┌─────────┼──────────────────────────────────────┐
        │         │           │              │            │
┌───────▼──┐ ┌────▼───┐ ┌────▼───┐  ┌──────▼──────┐  ┌──▼──────────┐
│  notes   │ │ decks  │ │ quizzes│  │study_sessions│  │ review_logs │
└────┬─────┘ └───┬────┘ └───┬────┘  └─────────────┘  └─────────────┘
     │ 0..*      │ 1..*     │ 1..*
     │           │          │
┌────▼─────┐ ┌──▼────────┐ ┌▼───────────────┐
│highlights│ │flashcards │ │ quiz_questions │
└──────────┘ └────┬──────┘ └────┬───────────┘
┌──────────┐     │              │
│ keywords │     │              │
└──────────┘  ┌──▼──────┐  ┌────▼───────┐
              │review_  │  │quiz_attempts│
              │  logs   │  └────┬────────┘
              └─────────┘       │
                            ┌───▼──────┐
                            │quiz_     │
                            │ answers  │
                            └──────────┘
```

## Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| email | varchar(255) | unique, indexed, stored lower-cased |
| full_name | varchar(120) | may be empty |
| hashed_password | varchar(255) | bcrypt |
| is_active | bool | soft-disable flag |
| is_email_verified | bool | flipped by `/verify-email` |
| created_at, updated_at | timestamptz | server defaults |

### notes
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| owner_id | int FK→users | cascade delete |
| title | varchar(255) | |
| source_type | varchar(20) | `text` \| `pdf` \| `docx` \| `txt` \| `md` |
| original_filename | varchar(255) nullable | |
| content | text | extracted plain text |
| summary | text nullable | latest AI summary |
| created_at, updated_at | timestamptz | |

### note_highlights
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| note_id | int FK→notes | cascade delete |
| text | text | verbatim slice from the note |
| importance | int | 1-5 (5 = critical) |
| reason | text nullable | one-sentence rationale from the AI |

### note_keywords
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| note_id | int FK→notes | cascade delete |
| term | varchar(120) | |
| definition | text nullable | |
| weight | float | 0..1 importance |

### decks
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| owner_id | int FK→users | cascade delete |
| note_id | int FK→notes nullable | `SET NULL` on note delete |
| name | varchar(255) | |
| description | text nullable | |
| created_at, updated_at | timestamptz | |

### flashcards
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| deck_id | int FK→decks | cascade delete |
| question, answer | text | |
| hint | text nullable | |
| ease_factor | float | SM-2 EF, default 2.5, floor 1.3 |
| interval_days | int | days until next review |
| repetitions | int | consecutive successful reviews |
| due_at | timestamptz | indexed; `WHERE due_at <= now()` for queue |
| last_reviewed_at | timestamptz nullable | |
| created_at | timestamptz | |

### review_logs
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| flashcard_id | int FK→flashcards | cascade delete |
| user_id | int FK→users | cascade delete |
| quality | int | 0..5 (SM-2 grade) |
| reviewed_at | timestamptz | indexed; powers accuracy analytics |

### quizzes
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| owner_id | int FK→users | cascade delete |
| note_id | int FK→notes nullable | `SET NULL` on note delete |
| title | varchar(255) | |
| description | text nullable | |
| created_at | timestamptz | |

### quiz_questions
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| quiz_id | int FK→quizzes | cascade delete |
| position | int | display order |
| prompt | text | |
| options | json | array of strings |
| correct_index | int | 0-based |
| explanation | text nullable | |

### quiz_attempts
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| quiz_id | int FK→quizzes | cascade delete |
| user_id | int FK→users | cascade delete |
| score | int | correct count |
| total | int | number of questions |
| completed_at | timestamptz | |

### quiz_answers
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| attempt_id | int FK→quiz_attempts | cascade delete |
| question_id | int FK→quiz_questions | |
| selected_index | int | |
| is_correct | bool | denormalised for fast lookup |

### study_sessions
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| user_id | int FK→users | cascade delete |
| activity | varchar(30) | `flashcards` \| `quiz` \| `reading` |
| deck_id, quiz_id, note_id | int FK nullable | optional context |
| started_at | timestamptz | indexed |
| ended_at | timestamptz nullable | populated by `/end` |
| duration_seconds | int | wall-clock seconds |
| cards_reviewed, correct_count, incorrect_count | int | per-session counters |

## Index strategy

Hot indexes — added explicitly because they're on the critical query paths:

- `users(email)` — login lookups.
- `flashcards(due_at)` and `(deck_id)` — the spaced-repetition queue.
- `review_logs(reviewed_at)`, `study_sessions(started_at)` — analytics scans.

The remaining FKs all benefit from Postgres's automatic indexes on PK lookups.

## Cascade behaviour

- Deleting a user cascades to **everything** they own (notes, decks,
  flashcards, quizzes, sessions, review logs). The Settings → Delete account
  button uses this.
- Deleting a note cascades to its highlights and keywords. Decks and quizzes
  generated from the note are *retained* (`SET NULL` on `note_id`) so the
  user doesn't lose study material when the source goes.
- Deleting a deck cascades to its flashcards and to those flashcards'
  review logs.
