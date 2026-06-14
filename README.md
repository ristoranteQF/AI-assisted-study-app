# StudyBuddy — Smart Study Companion

A full-stack AI-assisted study app. Students upload lecture notes, PDFs, or
slides; StudyBuddy turns them into **summaries**, **flashcards** with
spaced-repetition scheduling, **multiple-choice quizzes**, and visual
**progress analytics**. The backend is FastAPI + Postgres; the frontend is
React (Vite). AI generation is powered by Anthropic's Claude API with prompt
caching to keep latency and cost down.





## Demo

![StudyBuddy demo](demo.gif)


---




## Features

**Core**
- Sign up, sign in, password reset, email verification (JWT-based).
- CRUD for user account credentials, notes, decks, flashcards, quizzes.
- Upload notes as PDF, DOCX, TXT, or Markdown — text is extracted server-side.
- AI-generated summaries (with key points), flashcards, and quizzes.
- Spaced repetition (SM-2) scheduling for flashcards.
- Quiz attempts persisted with per-question correctness + scores.
- Study sessions tracked: minutes, items reviewed, accuracy.
- Analytics dashboard: streak, daily minutes, daily review accuracy, due cards.

**Bonus**
- AI-extracted **highlights** (rendered inline over the note content with importance-based colour coding).
- AI-extracted **keywords** with definitions.

**Security**
- bcrypt-hashed passwords (passlib).
- Short-lived JWT access tokens, separate signed token types for password reset and email verification.
- Email enumeration protection on the forgot-password endpoint.
- Per-user authorisation enforced on every CRUD endpoint.
- Server-side file size and MIME-suffix validation on uploads.
- CORS restricted to the configured frontend origin.


## Quick start

See [docs/SETUP.md](docs/SETUP.md) for the full walk-through. 

```bash
# 1. Database
createdb studybuddy
createuser studybuddy --pwprompt        

# 2. Backend
cd backend
python -m venv .venv 
# Windows: .venv\Scripts\activate
source .venv/bin/activate    
pip install -r requirements.txt
cp .env.example .env                                 
uvicorn app.main:app --reload

# 3. Frontend
cd frontend
npm install
npm run dev
```