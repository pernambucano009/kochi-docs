"""📧 إرسال الإيميلات (تأكيد الحساب، نسيت كلمة المرور).

يشتغل بأي واحد من هؤلاء (من متغيرات الخادم):
- RESEND_API_KEY (+ MAIL_FROM): خدمة Resend.
- SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASS (+ MAIL_FROM): أي بريد إلكتروني بيزنس (Google Workspace / Zoho …).
إذا لا يوجد أي واحد: البريد الإلكتروني يُكتب في سجل الخادم فقط (للتجربة)، و MAIL_DEV=1 يخلي صفحة التسجيل تعرض الرابط.
"""
from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

import httpx

log = logging.getLogger("mailer")
BRAND = os.environ.get("BRAND_NAME") or "SimsimKit"


def configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY") or os.environ.get("SMTP_HOST"))


def sender() -> str:
    return os.environ.get("MAIL_FROM") or os.environ.get("SMTP_USER") or "no-reply@localhost"


def send(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """True إذا أُرسل فعلًا."""
    if os.environ.get("RESEND_API_KEY"):
        try:
            r = httpx.post("https://api.resend.com/emails", timeout=20,
                           headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"},
                           json={"from": sender(), "to": [to], "subject": subject, "text": text, **({"html": html} if html else {})})
            if r.status_code < 300:
                log.warning("email sent via resend to %s", to)
                return True
            log.warning("resend failed %s %s", r.status_code, r.text[:200])
        except httpx.HTTPError as e:
            log.warning("resend error %s", e)
        return False
    if os.environ.get("SMTP_HOST"):
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = sender(), to, subject
        msg.set_content(text)
        if html:
            msg.add_alternative(html, subtype="html")
        port = int(os.environ.get("SMTP_PORT") or 587)
        try:
            if port == 465:
                with smtplib.SMTP_SSL(os.environ["SMTP_HOST"], port, context=ssl.create_default_context(), timeout=20) as s:
                    s.login(os.environ.get("SMTP_USER", ""), os.environ.get("SMTP_PASS", ""))
                    s.send_message(msg)
            else:
                with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=20) as s:
                    s.starttls(context=ssl.create_default_context())
                    s.login(os.environ.get("SMTP_USER", ""), os.environ.get("SMTP_PASS", ""))
                    s.send_message(msg)
            return True
        except (smtplib.SMTPException, OSError) as e:
            log.warning("smtp error %s", e)
            return False
    log.warning("email not configured; would send to %s: %s\n%s", to, subject, text)
    return False


def button_html(title: str, body: str, link: str, label: str) -> str:
    return f"""<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#141414">
<div style="font-weight:700;font-size:18px;margin-bottom:18px">Simsim<span style="color:#E5613E">Kit</span></div>
<h2 style="margin:0 0 12px">{title}</h2><p style="line-height:1.8;color:#555">{body}</p>
<p style="margin:24px 0"><a href="{link}" style="background:#E5613E;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none">{label}</a></p>
<p style="font-size:12px;color:#999">إذا الزر لا يعمل، انسخ هذا الرابط: {link}</p></div>"""
