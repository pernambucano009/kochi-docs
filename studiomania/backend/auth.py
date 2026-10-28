"""الدخول بباسورد والإعدادات المحفوظة (مفاتيح Atlas وZernio).

كلمة المرور: من APP_PASSWORD إذا مسجل في الخادم، وإلا أول مرة تفتح البرنامج يطلب منك تعمل كلمة مرور.
الجلسة: كوكي موقّعة بمفتاح سري محفوظ في مجلد البيانات.
"""

import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from contextlib import closing
from pathlib import Path

SESSION_COOKIE = "sm_session"
SESSION_DAYS = 30

# المفاتيح اللي ينفع تتحط من صفحة الإعدادات
SETTING_KEYS = {"atlas": "ATLASCLOUD_API_KEY", "zernio": "ZERNIO_API_KEY", "scrape": "SCRAPECREATORS_API_KEY", "pexels": "PEXELS_API_KEY",
                # مفاتيح المنصة كلها من صفحة الإعدادات (الأدمن بس): من غير شاشة أوامر ولا متغيرات استضافة
                "fasih": "FASIH_API_KEY", "audioshake": "AUDIOSHAKE_API_KEY", "giphy": "GIPHY_API_KEY", "klipy": "KLIPY_API_KEY",
                "resend": "RESEND_API_KEY", "smtp_pass": "SMTP_PASS", "paypal_id": "PAYPAL_CLIENT_ID", "paypal_secret": "PAYPAL_SECRET", "paypal_hook": "PAYPAL_WEBHOOK_ID",
                "eleven": "ELEVENLABS_API_KEY", "recraft": "RECRAFT_API_KEY",
                "google_id": "GOOGLE_CLIENT_ID", "google_secret": "GOOGLE_CLIENT_SECRET",
                "authentica": "AUTHENTICA_API_KEY", "openai": "OPENAI_API_KEY",
                "openai_admin": "OPENAI_ADMIN_KEY"}
BASIC_KEYS = ("atlas", "zernio", "scrape", "pexels")


class Auth:
    def __init__(self, db_path: Path, data_dir: Path):
        self.db_path = db_path
        secret_file = data_dir / "secret.key"
        if not secret_file.exists():
            secret_file.write_bytes(secrets.token_bytes(32))
            secret_file.chmod(0o600)
        self.secret = secret_file.read_bytes()
        with closing(self._db()) as conn, conn:
            conn.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        self.load_keys_into_env()

    def _db(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _get(self, key: str) -> str | None:
        with closing(self._db()) as conn:
            row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def _set(self, key: str, value: str | None) -> None:
        with closing(self._db()) as conn, conn:
            if value is None:
                conn.execute("DELETE FROM settings WHERE key = ?", (key,))
            else:
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))

    def get_setting(self, key: str) -> str | None:
        return self._get(f"app:{key}")

    def set_setting(self, key: str, value: str | None) -> None:
        self._set(f"app:{key}", value)

    # ------------------------------------------------------------ الباسورد

    def env_password(self) -> str | None:
        return os.environ.get("APP_PASSWORD") or None

    def needs_setup(self) -> bool:
        return not self.env_password() and not self._get("password_hash")

    @staticmethod
    def _hash(password: str, salt: bytes) -> str:
        return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000).hex()

    def set_password(self, password: str) -> None:
        salt = secrets.token_bytes(16)
        self._set("password_hash", f"{salt.hex()}${self._hash(password, salt)}")

    def check_password(self, password: str) -> bool:
        env = self.env_password()
        if env:
            return hmac.compare_digest(password.encode(), env.encode())
        stored = self._get("password_hash")
        if not stored:
            return False
        salt_hex, digest = stored.split("$", 1)
        return hmac.compare_digest(self._hash(password, bytes.fromhex(salt_hex)), digest)

    # ------------------------------------------------------------ الجلسة

    def _version(self) -> str:
        # تغيير الباسورد بيلغي كل الجلسات القديمة
        return hashlib.sha256((self.env_password() or self._get("password_hash") or "").encode()).hexdigest()[:12]

    def make_token(self) -> str:
        expires = int(time.time()) + SESSION_DAYS * 86400
        payload = f"{expires}.{self._version()}"
        sig = hmac.new(self.secret, payload.encode(), hashlib.sha256).hexdigest()
        return f"{payload}.{sig}"

    def valid_token(self, token: str | None) -> bool:
        if not token or token.count(".") != 2:
            return False
        expires, version, sig = token.split(".")
        payload = f"{expires}.{version}"
        good = hmac.new(self.secret, payload.encode(), hashlib.sha256).hexdigest()
        return (
            hmac.compare_digest(sig, good)
            and version == self._version()
            and expires.isdigit()
            and int(expires) > time.time()
        )

    # ------------------------------------------------------------ مفاتيح الخدمات

    def load_keys_into_env(self) -> None:
        """المفاتيح المحفوظة من صفحة الإعدادات لها الأولوية على ملف .env."""
        for env_name in SETTING_KEYS.values():
            value = self._get(f"key:{env_name}")
            if value:
                os.environ[env_name] = value

    def save_key(self, name: str, value: str | None) -> None:
        env_name = SETTING_KEYS[name]
        value = (value or "").strip() or None
        self._set(f"key:{env_name}", value)
        if value:
            os.environ[env_name] = value
        else:
            os.environ.pop(env_name, None)

    def keys_state(self) -> dict:
        out = {}
        for name, env_name in SETTING_KEYS.items():
            value = os.environ.get(env_name) or ""
            out[name] = {
                "set": bool(value),
                "hint": f"…{value[-4:]}" if len(value) >= 8 else ("مسجل" if value else ""),
                "saved_here": bool(self._get(f"key:{env_name}")),
            }
        return out
