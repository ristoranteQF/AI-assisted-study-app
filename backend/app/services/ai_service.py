from __future__ import annotations

import json
import logging
import re
from typing import Any

from anthropic import Anthropic, APIError

from ..config import settings


logger = logging.getLogger("studybuddy.ai")


SYSTEM_PROMPT = """You are StudyBuddy, an expert academic assistant that helps students learn from their lecture notes, slides, and textbook excerpts.

You always follow these rules:

1. Stay strictly grounded in the provided study material. Never fabricate facts, citations, formulas, or definitions. If the material does not contain enough information to answer, say so explicitly inside the JSON instead of guessing.
2. Use clear, student-friendly language. Prefer concrete examples over abstract jargon. When a technical term is unavoidable, briefly explain it.
3. Output strictly valid JSON in the exact schema requested by the user. Do not wrap the JSON in Markdown fences, do not add commentary, do not add trailing commas. The first character of your reply must be `{` or `[` and the last must be `}` or `]`.
4. Keep individual fields concise: flashcard answers should be 1-3 sentences, quiz explanations 1-2 sentences, highlight reasons one sentence. Summaries may be longer but should be tightly structured.
5. For multiple-choice questions, ensure exactly one option is unambiguously correct and the distractors are plausible but clearly wrong on close reading. Vary the position of the correct answer.
6. Never include personally identifying information, opinions about the student, or content unrelated to studying the material.
7. ALWAYS respond in the same language as the user's study material. If the material is in Romanian, all generated questions, answers, summaries, keywords, and explanations must be in Romanian. If it is in English, respond in English. If it is in another language (Spanish, French, German, etc.), match that language. JSON keys themselves stay in English exactly as specified by the schema; only the human-readable values follow the source language. Highlight `text` fields must be copied verbatim from the source, so they always inherit the source language naturally.

You are a study aid, not a search engine. Quality and faithfulness to the source matter more than coverage."""


_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def _extract_json(text: str) -> Any:
    cleaned = _JSON_FENCE_RE.sub("", text).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        for opener, closer in (("{", "}"), ("[", "]")):
            start = cleaned.find(opener)
            end = cleaned.rfind(closer)
            if start != -1 and end != -1 and end > start:
                snippet = cleaned[start : end + 1]
                try:
                    return json.loads(snippet)
                except json.JSONDecodeError:
                    continue
        raise


class AIService:
    def __init__(self) -> None:
        self._enabled = bool(settings.ANTHROPIC_API_KEY)
        self._client = Anthropic(api_key=settings.ANTHROPIC_API_KEY) if self._enabled else None
        self._model = settings.AI_MODEL

    @property
    def enabled(self) -> bool:
        return self._enabled


    def _call(self, user_prompt: str, max_tokens: int = 2048) -> str:
        if not self._enabled:
            raise RuntimeError(
                "AI features are disabled. Set ANTHROPIC_API_KEY in the backend .env to enable them."
            )
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": user_prompt}],
            )
        except APIError as exc:
            logger.error("Anthropic API error: %s", exc)
            raise RuntimeError(f"AI provider error: {exc}") from exc


        parts: list[str] = []
        for block in response.content:
            if getattr(block, "type", None) == "text":
                parts.append(block.text)
        return "".join(parts).strip()

    def _call_json(self, user_prompt: str, max_tokens: int = 2048) -> Any:
        raw = self._call(user_prompt, max_tokens=max_tokens)
        try:
            return _extract_json(raw)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse AI JSON. Raw: %s", raw[:500])
            raise RuntimeError("AI returned a malformed response. Please try again.") from exc


    def generate_flashcards(self, content: str, count: int = 10) -> list[dict]:
        prompt = f"""Generate {count} high-quality study flashcards from the following material.

Return JSON in exactly this schema:
{{
  "cards": [
    {{ "question": "string", "answer": "string", "hint": "string or null" }}
  ]
}}

Guidelines:
- Cover the most important and testable facts, definitions, and relationships.
- Mix recall ("What is X?"), application ("When would you use X?"), and contrast ("How does X differ from Y?") questions.
- Hints should be short nudges that don't give the answer away. Use null when no good hint exists.

Material:
\"\"\"
{content}
\"\"\""""
        data = self._call_json(prompt, max_tokens=3072)
        cards = data.get("cards", []) if isinstance(data, dict) else []
        return [
            {
                "question": str(c.get("question", "")).strip(),
                "answer": str(c.get("answer", "")).strip(),
                "hint": (str(c["hint"]).strip() if c.get("hint") else None),
            }
            for c in cards
            if c.get("question") and c.get("answer")
        ]

    def generate_summary(self, content: str) -> dict:
        prompt = f"""Summarise the following study material.

Return JSON in exactly this schema:
{{
  "tldr": "string — 1-2 sentence overview",
  "key_points": ["string", "string", ...],
  "structured_summary": "string — 1-3 short paragraphs in plain prose"
}}

Aim for 5-8 key points. Order them from most to least important.

Material:
\"\"\"
{content}
\"\"\""""
        data = self._call_json(prompt, max_tokens=2048)
        if not isinstance(data, dict):
            return {"tldr": "", "key_points": [], "structured_summary": ""}
        return {
            "tldr": str(data.get("tldr", "")).strip(),
            "key_points": [str(p).strip() for p in data.get("key_points", []) if str(p).strip()],
            "structured_summary": str(data.get("structured_summary", "")).strip(),
        }

    def generate_quiz(self, content: str, count: int = 8) -> list[dict]:
        prompt = f"""Generate a {count}-question multiple choice quiz from the following material.

Return JSON in exactly this schema:
{{
  "questions": [
    {{
      "prompt": "string",
      "options": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "string — why the correct answer is correct"
    }}
  ]
}}

Each question MUST have exactly 4 options. correct_index is 0-based. Vary which index is correct across questions. Test understanding, not just verbatim recall when possible.

Material:
\"\"\"
{content}
\"\"\""""
        data = self._call_json(prompt, max_tokens=3072)
        questions = data.get("questions", []) if isinstance(data, dict) else []
        out: list[dict] = []
        for q in questions:
            options = [str(o).strip() for o in q.get("options", []) if str(o).strip()]
            try:
                idx = int(q.get("correct_index", 0))
            except (TypeError, ValueError):
                idx = 0
            if len(options) >= 2 and 0 <= idx < len(options) and q.get("prompt"):
                out.append(
                    {
                        "prompt": str(q["prompt"]).strip(),
                        "options": options,
                        "correct_index": idx,
                        "explanation": str(q.get("explanation", "")).strip() or None,
                    }
                )
        return out

    def extract_insights(self, content: str) -> dict:
        prompt = f"""Analyse the following study material and extract:
1. The most important keywords/terms a student should master.
2. The passages that are most important to highlight (the "must-know" sentences).

Return JSON in exactly this schema:
{{
  "keywords": [
    {{ "term": "string", "definition": "short definition", "weight": 0.0-1.0 }}
  ],
  "highlights": [
    {{ "text": "verbatim sentence(s) from the material", "importance": 1-5, "reason": "one short sentence" }}
  ]
}}

Aim for 8-15 keywords and 4-10 highlights. Highlight `text` MUST be copied verbatim from the material so the frontend can locate it. importance: 5 = critical, 1 = nice to know.

Material:
\"\"\"
{content}
\"\"\""""
        data = self._call_json(prompt, max_tokens=3072)
        if not isinstance(data, dict):
            return {"keywords": [], "highlights": []}
        keywords = []
        for k in data.get("keywords", []) or []:
            term = str(k.get("term", "")).strip()
            if not term:
                continue
            try:
                weight = float(k.get("weight", 1.0))
            except (TypeError, ValueError):
                weight = 1.0
            keywords.append(
                {
                    "term": term,
                    "definition": (str(k["definition"]).strip() if k.get("definition") else None),
                    "weight": max(0.0, min(1.0, weight)),
                }
            )
        highlights = []
        for h in data.get("highlights", []) or []:
            text = str(h.get("text", "")).strip()
            if not text:
                continue
            try:
                importance = int(h.get("importance", 3))
            except (TypeError, ValueError):
                importance = 3
            highlights.append(
                {
                    "text": text,
                    "importance": max(1, min(5, importance)),
                    "reason": (str(h["reason"]).strip() if h.get("reason") else None),
                }
            )
        return {"keywords": keywords, "highlights": highlights}


ai_service = AIService()
