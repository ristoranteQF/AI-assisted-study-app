# Security model


## Identities and credentials

### Password storage
Passwords are hashed with **bcrypt** (`passlib[bcrypt]`, work factor = library
default of 12 rounds). The plaintext never touches the database. Verification
uses `passlib`'s constant-time comparator.

### Password requirements
A floor of 8 characters is enforced both client-side (HTML `minLength`) and
server-side (Pydantic `Field(min_length=8, max_length=128)`). The upper
bound is a defence against bcrypt's 72-byte input limit and against trivial
DoS via huge inputs.

### Email validation
- Pydantic's `EmailStr` (powered by `email-validator`) rejects malformed
  addresses on every endpoint that accepts an email.
- Emails are stored lower-cased so duplicates can't sneak in via case.
- Verification is via signed JWT; updating the email un-verifies the
  account (`is_email_verified = False`).

## Tokens

All tokens are **JWTs** (HS256, signed with `SECRET_KEY`). They carry a
`type` claim and `decode_token` enforces the expected type, so a reset
token can't be used to verify and vice versa.

| Token | Lifetime | Scope |
|---|---|---|
| `access` | 60 minutes | Authenticate API calls. |
| `reset` | 30 minutes | Single-purpose: reset the password. |
| `verify` | 48 hours | Single-purpose: confirm email ownership. |

Tokens are not revocable individually (they're stateless). Revocation is
accomplished by rotating `SECRET_KEY` in the rare case of a key compromise,
which invalidates all outstanding tokens. For session-style logout the
frontend simply discards the token.

## Authentication flow

1. **Signup / Login** — email + password posted to `/api/auth/signup` or
   `/login`. On success the server returns `{access_token, user}`.
2. The frontend persists the token in `localStorage` (`studybuddy.token`).
3. Subsequent requests carry `Authorization: Bearer <jwt>`. The
   `get_current_user` dependency decodes the token, fetches the user, and
   rejects with 401 if the user is missing or `is_active = false`.

## Authorisation

There is no role/permission system — every resource is owned by exactly one
user. Each router checks ownership inline:

```python
note = db.get(Note, note_id)
if not note or note.owner_id != current.id:
    raise HTTPException(404, "Note not found")
```

Crucially we return **404 not 403** to avoid leaking the existence of
resources owned by other users.

The Postgres FK `ON DELETE CASCADE` chain ensures that when a user is
deleted (or their parent record is), no orphan rows remain that could leak
through a future bug.

## Forgot-password flow

`POST /api/auth/forgot-password` always returns the same generic message,
whether the email exists or not, to prevent enumeration. The reset link is
delivered out-of-band (via email or, in dev mode, the backend log).

The reset endpoint requires the matching JWT and the user must still be
active. Once consumed, the token expires naturally — no replay protection
beyond expiry, but the 30-minute window plus the requirement to know the
user's email keeps the attack surface tiny.

## Uploads

`POST /api/notes/upload` validates:
- File extension (must be in `{pdf, docx, txt, md}`).
- Size (rejected with 413 if `> MAX_UPLOAD_MB`).
- Extracted text non-empty (so a corrupt or scanned file returns 400 with a
  clear message rather than silently making a useless note).

Files are streamed into memory and parsed; we do not persist the original
file to disk. The extracted text is the only artifact stored. This avoids
arbitrary-file-storage risks and simplifies GDPR-style deletion (cascade on
the note row removes everything).

## Transport & CORS

- The CORS middleware allow-lists `FRONTEND_URL`, `http://localhost:5173`,
  and `http://127.0.0.1:5173`. Any other origin is blocked from making
  cross-origin requests to the API.
- Production deployments **must** terminate TLS at the proxy. The JWT
  carries the user's identity; over HTTP it would be trivially sniffable.

## What is NOT implemented (and why)

These were considered and explicitly left out, with reasoning so a reviewer
can evaluate the trade-offs:

- **Refresh tokens.** Rotating short-lived access tokens via long-lived
  refresh tokens is best practice for hostile-network deployments. Skipped
  here because StudyBuddy isn't multi-device by design and a 60-minute
  access token is acceptable for a study app. Adding refresh tokens later
  is a localised change in `core/security.py` + a `/refresh` endpoint.
- **Per-IP rate limiting.** A real production deployment would bolt on
  `slowapi` or do this at the proxy layer. Out of scope for the in-scope
  CRUD demo.
- **2FA / passkeys.** Not in the requirements. Would slot in cleanly as an
  optional `User.totp_secret` column + a separate flow.
- **CSRF tokens.** Because we use the `Authorization` header (not cookies)
  for auth, there is no CSRF surface — a malicious site cannot forge the
  header from another origin.
- **Refusing reused passwords / breach-list lookups.** Worth doing in
  production (e.g. Have I Been Pwned k-anonymity); not implemented here.

## Threat surface summary

| Threat | Mitigation |
|---|---|
| Password DB leak | bcrypt with per-password salt |
| Password reuse via brute force | bcrypt's slow KDF; rate-limit at the proxy in prod |
| Token theft from XSS | Frontend has no `dangerouslySetInnerHTML` against user input *except* for AI-generated highlight markup, which is sanitised: the entire content is HTML-escaped first, then known highlight ranges are re-introduced as `<mark>` |
| Email enumeration | Forgot-password returns generic response |
| IDOR (accessing other users' data) | Ownership check on every router |
| Session fixation | Stateless JWT — no session ID to fix |
| CSRF | Token is in `Authorization` header, not a cookie |
| Brute-force JWT | HS256 with 64-byte secret; production should use a secret of equivalent entropy |
| Server-side template injection | None — JSON-only API |
| File-upload RCE | Files parsed in-memory, never executed; extension and size capped |
