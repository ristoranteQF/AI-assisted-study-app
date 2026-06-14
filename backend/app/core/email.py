from email.mime.text import MIMEText
import asyncio
import logging

import aiosmtplib

from ..config import settings


logger = logging.getLogger("studybuddy.email")


async def send_email(to: str, subject: str, body: str) -> None:
    if settings.DEBUG:
        print(
            "\n" + "=" * 72
            + f"\n📧 StudyBuddy email"
            + f"\n   To:      {to}"
            + f"\n   Subject: {subject}"
            + "\n" + "-" * 72
            + f"\n{body}"
            + "=" * 72 + "\n",
            flush=True,
        )

    if not settings.SMTP_HOST:
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USERNAME or None,
        password=settings.SMTP_PASSWORD or None,
        start_tls=settings.SMTP_TLS,
    )


def send_email_sync(to: str, subject: str, body: str) -> None:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(send_email(to, subject, body))
        return
    asyncio.create_task(send_email(to, subject, body))
