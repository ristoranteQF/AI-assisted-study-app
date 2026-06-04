# Backend

FastAPI service. See [`../docs/SETUP.md`](../docs/SETUP.md) for installation
and [`../docs/API.md`](../docs/API.md) for the endpoint reference.

```bash
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Interactive docs: <http://localhost:8000/docs>
