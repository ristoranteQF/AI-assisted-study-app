"""
SM-2 spaced repetition scheduler.

Reference: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method

Inputs (per review):
  quality: 0..5, where 0=blackout, 5=perfect.

Updates ease_factor, interval_days, repetitions, and produces a new due_at.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class SchedulerResult:
    ease_factor: float
    interval_days: int
    repetitions: int
    due_at: datetime
    last_reviewed_at: datetime


def schedule(
    *,
    quality: int,
    ease_factor: float,
    interval_days: int,
    repetitions: int,
    now: datetime | None = None,
) -> SchedulerResult:
    if not 0 <= quality <= 5:
        raise ValueError("quality must be in 0..5")

    now = now or datetime.now(timezone.utc)

    if quality < 3:
        repetitions = 0
        interval_days = 1
    else:
        if repetitions == 0:
            interval_days = 1
        elif repetitions == 1:
            interval_days = 6
        else:
            interval_days = max(1, round(interval_days * ease_factor))
        repetitions += 1

    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if ease_factor < 1.3:
        ease_factor = 1.3

    return SchedulerResult(
        ease_factor=round(ease_factor, 4),
        interval_days=interval_days,
        repetitions=repetitions,
        due_at=now + timedelta(days=interval_days),
        last_reviewed_at=now,
    )
