# Setup

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11 or newer |
| Node.js | 18 or newer (npm 9+) |
| PostgreSQL | 14+ (any modern release) |
| Anthropic API key | optional but required for AI features |

> If you don't want to install Postgres locally, the easiest alternative is
> Docker: `docker run --name studybuddy-pg -e POSTGRES_USER=studybuddy -e
> POSTGRES_PASSWORD=studybuddy -e POSTGRES_DB=studybuddy -p 5432:5432 -d postgres:16`

## 1 — Clone & enter the project

```bash
cd StuddyBuddy
```

## 2 — Database

Create a database and matching user:

```bash
# psql shell
CREATE USER studybuddy WITH PASSWORD 'studybuddy';
CREATE DATABASE studybuddy OWNER studybuddy;
```

The backend creates all tables automatically on first startup
(`Base.metadata.create_all`). For a thesis-grade migration story, see the
note at the bottom about Alembic.

## 3 — Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`. The two values that actually matter on first run:

| Var | Why |
|---|---|
| `DATABASE_URL` | Defaults to `postgresql+psycopg2://studybuddy:studybuddy@localhost:5432/studybuddy`. Update if your creds differ. |
| `SECRET_KEY` | Used to sign JWTs. Generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"`. |
| `ANTHROPIC_API_KEY` | Required only if you want AI features. Get one from console.anthropic.com. |

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

You should see `StudyBuddy backend ready (debug=True, ai=...)` and the
auto-generated docs at <http://localhost:8000/docs>.

## 4 — Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite serves on <http://localhost:5173> and proxies `/api/*` to the FastAPI
server on `:8000` (configured in `vite.config.js`), so you don't need CORS
heroics in development.

Open <http://localhost:5173>, hit **Sign up**, and you're in.

## Email in development

If `SMTP_HOST` is empty (the default), email-flow messages — verification,
password reset — are printed to the **backend's stdout** instead of being
sent. The reset/verify URLs include the JWT directly, so you can copy them
into your browser to exercise those flows without any mail server.

To use a real provider in development (e.g. Mailtrap, Postmark, Gmail SMTP),
fill in:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=StudyBuddy <noreply@yourdomain>
SMTP_TLS=true
```

## Troubleshooting

**`psycopg2.OperationalError: connection refused`** — Postgres isn't running,
or the host/port/credentials in `DATABASE_URL` are wrong.

**`bcrypt` install fails on Windows** — the requirements pin `bcrypt==4.0.1`
which has prebuilt wheels for Windows + Python 3.11/3.12. If you're on a very
new Python, upgrade pip (`python -m pip install --upgrade pip`) and retry.

**AI endpoints return 503** — `ANTHROPIC_API_KEY` is empty. Set it and
restart the backend.

**File upload returns 400 "Could not extract text"** — your PDF is probably
a scanned image (no embedded text). Try a different file or run an OCR
preprocessor like `ocrmypdf` first.

**CORS errors in production** — set `FRONTEND_URL` in the backend `.env` to
your deployed frontend origin. The CORS middleware allows that origin plus
the local Vite dev server.

## Production notes

- Replace `Base.metadata.create_all` with Alembic migrations: drop a
  `backend/alembic` folder via `alembic init alembic`, point `sqlalchemy.url`
  at `Settings().DATABASE_URL`, and run `alembic revision --autogenerate -m
  "initial"` against the existing models.
- Run uvicorn behind a reverse proxy (nginx, Caddy, Traefik) and switch to
  multiple workers: `uvicorn app.main:app --workers 4 --host 0.0.0.0`.
- Build the frontend with `npm run build` and serve `dist/` from the same
  proxy. Set `VITE_API_BASE_URL` at build time if the API is on a different
  origin.
- Tighten `SECRET_KEY`, set `DEBUG=false`, enable HTTPS termination at the
  proxy. The JWT cookie/header should always travel over TLS.
