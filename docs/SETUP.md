# Setup

## Prerequisites

Python - Node.js - PostgreSQL - Anthropic API key (optional but required for AI features)




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

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

auto-generated docs at <http://localhost:8000/docs>.

## 4 — Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>