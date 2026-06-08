# Architecture

## Birds-eye view

```
┌──────────────────────┐     HTTPS / JSON       ┌────────────────────────┐
│  React SPA (Vite)    │ <────────────────────> │   FastAPI (Uvicorn)    │
│  - Router            │                        │   - Routers (REST)     │
│  - AuthContext       │                        │   - Pydantic schemas   │
│  - Axios client      │                        │   - Services           │
│  - Design system     │                        │     · ai_service       │
└──────────────────────┘                        │     · file_service     │
                                                │     · spaced_repetition│
                                                │   - Auth middleware    │
                                                └────────┬───────────────┘
                                                         │ SQLAlchemy
                                                         ▼
                                                ┌─────────────────────────┐
                                                │     PostgreSQL          │
                                                │  users · notes · decks  │
                                                │  flashcards · quizzes   │
                                                │  sessions · review_logs │
                                                └─────────────────────────┘
                                                         ▲
                                                         │ HTTPS
                                                ┌────────┴───────────────┐
                                                │   Anthropic API        │
                                                │  Claude (system-prompt │
                                                │  cached, ephemeral)    │
                                                └────────────────────────┘
```

## Frontend

- **React 18 + Vite** — lightweight, instant HMR.
- **React Router 6** — single source of truth for navigation. Routes that need
  authentication are wrapped in `ProtectedRoute`, which redirects unauthenticated
  visitors to `/login` and remembers where they were going.
- **AuthContext** — exposes `user`, `login`, `signup`, `logout`, `refresh`.
  On boot it tries `GET /api/users/me` with the cached JWT to rehydrate.
- **Axios client** (`src/api/client.js`) — auto-attaches the token, and on a
  401 response wipes the token and redirects to `/login`.
- **Design system** — one global stylesheet (`src/styles/global.css`) defines
  CSS custom properties for color, spacing, radii, shadows, transitions. It
  ships a dark mode via `prefers-color-scheme`. There are no UI dependencies
  beyond React itself.

## Backend

### Layered structure

```
HTTP layer  ─── routers/*.py
                ↓ depends on
DTO layer   ─── schemas/*.py        (Pydantic v2)
                ↓ converts to/from
Domain      ─── models/*.py         (SQLAlchemy ORM)
                ↑ used by
Services    ─── services/*.py       (AI, file extraction, scheduler)
                ↑ infra
Cross-cut   ─── core/security.py, core/deps.py, core/email.py, config.py, database.py
```

Routers are intentionally thin: they parse input via Pydantic schemas, enforce
ownership via `Depends(get_current_user)`, call into services where needed,
and serialise the ORM model back through a Pydantic schema. Heavy logic lives
in `services/`.

### Auth model

- `POST /api/auth/signup` creates the user and immediately returns a JWT
  access token plus the user record. An email-verification token (separate
  signed JWT, 48h expiry) is fired off as a background task.
- `POST /api/auth/login` verifies the password (constant-time bcrypt) and
  returns the same Token shape.
- `POST /api/auth/forgot-password` always returns the same generic message,
  whether or not the email exists, to defeat enumeration.
- `POST /api/auth/reset-password` and `POST /api/auth/verify-email` decode
  their respective JWT subtypes and apply the change. JWT subtypes are
  enforced via the `type` claim — a reset token can't be used to verify, and
  vice versa.

### Spaced repetition (SM-2)

Implemented in `services/spaced_repetition.py`. On each review, the user
self-grades from 0 (blackout) to 5 (perfect):

- **quality < 3** — repetitions reset to 0, interval = 1 day. Ease factor
  is still nudged based on quality (with a 1.30 floor).
- **quality ≥ 3** — interval grows: `1 → 6 → previous × ease_factor`.
  Repetitions counter increments.

`due_at` is updated to `now + interval_days`, and the card is requeued when
the user pulls the deck's "due" list.

### AI service

`services/ai_service.py` wraps the Anthropic SDK with four high-level methods:
`generate_flashcards`, `generate_summary`, `generate_quiz`, `extract_insights`
(highlights + keywords).

The same long system prompt is shared across every call and marked with
`cache_control: ephemeral`. Anthropic caches it for ~5 minutes, so a study
session that triggers multiple AI calls re-uses the cached prefix and pays
only for the per-call user message — typically a 70-90% cost reduction on
the prompt tokens.

The user prompt requests strict JSON. The service has a fault-tolerant
extractor (`_extract_json`) that handles fenced output and fishes balanced
JSON out of leading/trailing prose if the model misbehaves.

### File extraction

`services/file_service.py` handles `.pdf` (pypdf), `.docx` (python-docx),
`.txt`, `.md`. Empty extractions are rejected with a clear 400 so the user
knows the file wasn't usable (e.g., scanned PDFs without OCR).

## Request flow: "generate flashcards from a note"

1. User clicks "Make flashcards" on `/notes/:id`.
2. Frontend calls `POST /api/ai/flashcards` with `{note_id, count}`.
3. `routers/ai.py` validates the JWT, loads the note, checks the user owns it.
4. `ai_service.generate_flashcards(content, count)` calls Claude with the
   cached system prompt + a per-note user prompt. Returns parsed JSON.
5. A new `Deck` is created with one `Flashcard` per generated card (default
   SM-2 state: `ease_factor=2.5`, `interval_days=0`, due immediately).
6. Frontend receives the new deck and navigates to `/decks/:id`.

## Why these choices?

- **FastAPI** — Pydantic gives free request/response validation and OpenAPI.
  Async-ready for the email/IO bits without forcing async on the simple CRUD.
- **SQLAlchemy 2.0** — typed ORM, modern declarative syntax, plays well with
  Pydantic 2 via `from_attributes=True`.
- **Postgres** — relational shape fits the data perfectly (users → notes →
  decks → cards). JSON columns let the quiz `options` ride along without a
  separate `quiz_options` table.
- **JWT** over session cookies — keeps the frontend completely stateless and
  trivially deployable on any static host.
- **Vite + plain CSS** — zero UI-framework lock-in, fast dev cycle, and a
  small dependency tree for thesis review.
- **Anthropic Claude** — the long system prompt + structured JSON output
  pattern works well, and prompt caching keeps repeat-call costs low.
