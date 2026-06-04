import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings
from .database import Base, engine
from .routers import ai, analytics, auth, decks, flashcards, notes, quizzes, sessions, users

# Import models so SQLAlchemy registers them before create_all.
from . import models  # noqa: F401


logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("studybuddy")


# ---- Production safety: refuse to start with the placeholder SECRET_KEY ----
_PLACEHOLDER_SECRETS = {
    "change-me-to-a-long-random-secret-string-please",
    "dev-secret-change-me",
    "",
}
if not settings.DEBUG and settings.SECRET_KEY in _PLACEHOLDER_SECRETS:
    raise RuntimeError(
        "SECRET_KEY is the default placeholder. Generate a strong key before "
        "deploying with DEBUG=false:\n"
        '    python -c "import secrets; print(secrets.token_urlsafe(64))"'
    )
if not settings.DEBUG and len(settings.SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters in production.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Smart Study Companion — AI-assisted flashcards, summaries, and quizzes.",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,    # disable Swagger UI in production
    redoc_url="/redoc" if settings.DEBUG else None,
)


# ---- CORS ----
# Only allow the configured frontend in production. Localhost origins are
# included in DEBUG mode so the Vite dev server can reach the API.
_cors_origins = [settings.FRONTEND_URL]
if settings.DEBUG:
    _cors_origins += ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ---- Defensive HTTP security headers ----
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds the headers a static analyser / penetration test will look for.

    Why each one:
    - X-Content-Type-Options: nosniff — blocks MIME-sniffing attacks (e.g.
      uploading a .txt that the browser interprets as HTML/JS).
    - X-Frame-Options: DENY — prevents clickjacking via <iframe> embedding.
    - Referrer-Policy: strict-origin-when-cross-origin — limits referrer leakage
      across origins (we never want the auth page URL with a token in a referer).
    - Permissions-Policy: locks down browser APIs the app doesn't use.
    """

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response


app.add_middleware(SecurityHeadersMiddleware)


# ---- Global error handler — surface unexpected errors as JSON, not HTML ----
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(notes.router)
app.include_router(decks.router)
app.include_router(flashcards.router)
app.include_router(quizzes.router)
app.include_router(sessions.router)
app.include_router(analytics.router)
app.include_router(ai.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "name": settings.APP_NAME}


@app.on_event("startup")
def on_startup() -> None:
    # In a production deployment we'd use Alembic migrations instead, but
    # create_all keeps the dev/thesis-demo workflow as one command.
    Base.metadata.create_all(bind=engine)

    # Tiny ad-hoc migration for columns added after a DB was first created.
    # Postgres ignores the ADD when the column is already there.
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255)"
        ))

    log.info("StudyBuddy backend ready (debug=%s, ai=%s)", settings.DEBUG, bool(settings.ANTHROPIC_API_KEY))
