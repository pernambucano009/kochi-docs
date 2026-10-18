"""🗣️ FasihTTS (فصيح): صوت عربي HD باللهجات (مصري، نجدي، حجازي، خليجي، شامي، مغربي...).

- التوليد كله بالأصوات الـ HD («-2»): POST {SUPABASE}/generate-tts-v2 بـ Idempotency-Key ← jobId،
  وبعدين get-long-tts-job كل ٣ ثواني لحد ما يرجع audio_url (رابط مؤقت بيتنزّل من غير المفتاح).
- الصوت لازم يتبعت مع dialect = dialectId بتاعه بالظبط، وإلا اللهجة بتطلع غلط.
- الواجهة القديمة /v1/tts للأصوات القديمة «-1» بس، وصوتها أوحش، فمبقيناش نستخدمها.
- كتالوج الأصوات GET /v1/voices من غير مفتاح، بنحفظه ٢٤ ساعة.
المفتاح في متغير البيئة FASIH_API_KEY (أو FASIHTTS_API_KEY) على Railway، وبيتبعت في هيدر x-api-key من السيرفر بس."""
from __future__ import annotations

import os
import time
import uuid
from pathlib import Path

import httpx

V1 = os.environ.get("FASIH_BASE_URL", "https://api.fasihtts.com")
HD = os.environ.get("FASIH_HD_URL", "https://xrwqtifhqycpxfjzfrip.supabase.co/functions/v1")
_CAT: dict = {"at": 0.0, "voices": []}


class FasihError(RuntimeError):
    pass


def api_key() -> str | None:
    for n in ("FASIH_API_KEY", "FASIHTTS_API_KEY", "FASIH_KEY"):
        v = (os.environ.get(n) or "").strip().strip('"').strip("'")
        if v:
            return v
    return None


def _err(resp: httpx.Response, what: str) -> FasihError:
    try:
        body = resp.json()
        msg = body.get("error") or body.get("message") or body.get("code") or str(body)
    except ValueError:
        msg = resp.text
    code = str(msg)
    hints = {400: "الكلام فاضي أو فيه حاجة غلط في الطلب", 401: "مفتاح فصيح غلط أو ناقص", 403: "رصيد فصيح خلص أو الباقة مش فيها API",
             409: "نفس الطلب اتبعت ببيانات مختلفة", 410: "الصوت ده اتشال من فصيح، اختار صوت تاني", 429: "طلبات كتير ورا بعض"}
    if "quota" in code:
        hints[resp.status_code] = "رصيد فصيح خلص"
    return FasihError(f"{what}: {hints.get(resp.status_code, 'فصيح فيه مشكلة دلوقتي')} ({resp.status_code}) {code[:200]}".strip())


def catalog(max_age: float = 86400) -> list[dict]:
    """أصوات فصيح من الكتالوج العام (من غير مفتاح)، محفوظة يوم. لو فصيح مش متاح بترجع آخر نسخة (أو فاضية)."""
    if _CAT["voices"] and time.time() - _CAT["at"] < max_age:
        return _CAT["voices"]
    try:
        r = httpx.get(f"{V1}/v1/voices", timeout=20)
        if r.status_code == 200:
            data = r.json()
            vs = data.get("voices") if isinstance(data, dict) else data
            if isinstance(vs, list):
                _CAT.update(at=time.time(), voices=vs)
    except (httpx.HTTPError, ValueError):
        _CAT["at"] = time.time() - max_age + 600   # نحاول تاني بعد ١٠ دقايق
    return _CAT["voices"]


DESIGN = os.environ.get("FASIH_DESIGN_URL", "https://www.fasihtts.com/v1/voice-design")


def _customs(node, out: list) -> None:
    """بيدوّر في رد فصيح على أي صوت خاص (معرّفه بيبدأ بـ custom-)، أيًا كان شكل الرد."""
    if isinstance(node, dict):
        vid = str(node.get("voiceId") or node.get("voice_id") or node.get("id") or "")
        if vid.startswith("custom-"):
            out.append(node)
        for v in node.values():
            _customs(v, out)
    elif isinstance(node, list):
        for v in node:
            _customs(v, out)


_CUSTOM: dict = {"at": 0.0, "voices": []}


def custom_voices(max_age: float = 600) -> list[dict]:
    """الأصوات الخاصة اللي اتصممت في حساب فصيح (Voice Design) بشكل كتالوج الأصوات، علشان تظهر في اللستة.
    كمان ممكن تتكتب بإيدك في FASIH_CUSTOM_VOICES بالشكل: custom-...-2:ar-sa-najdi:اسم الصوت (وأكتر من واحد بفاصلة)."""
    if time.time() - _CUSTOM["at"] < max_age:
        return _CUSTOM["voices"]
    out, seen = [], set()
    for part in (os.environ.get("FASIH_CUSTOM_VOICES") or "").split(","):
        bits = [b.strip() for b in part.split(":")]
        if bits and bits[0].startswith("custom-") and len(bits) >= 2:
            out.append({"id": bits[0], "dialectId": bits[1], "arabicName": bits[2] if len(bits) > 2 else "صوتك الخاص", "custom": True})
    key = api_key()
    if key:
        try:
            r = httpx.get(DESIGN, headers={"x-api-key": key}, timeout=20)
            if r.status_code == 200:
                found: list = []
                _customs(r.json(), found)
                for x in found:
                    st = str(x.get("status") or x.get("lifecycle") or "").lower()
                    if st in ("archived", "deleted", "failed", "draft", "preview"):
                        continue   # المؤرشف والمتمسح والمسودة اللي لسه ما اتحفظتش مايتقالش بيها
                    out.append({"id": str(x.get("voiceId") or x.get("voice_id") or x.get("id")),
                                "dialectId": x.get("dialectId") or x.get("dialect") or "", "gender": x.get("gender") or "",
                                "arabicName": x.get("name") or x.get("arabicName") or "صوتك الخاص", "custom": True})
        except (httpx.HTTPError, ValueError):
            pass
    res = []
    for x in out:
        if x["id"] not in seen:
            seen.add(x["id"])
            res.append(x)
    _CUSTOM.update(at=time.time(), voices=res)
    return res


def hd_voice(voice: str) -> str:
    """الأصوات القديمة «-1» بتتحول للـ HD اللي زيها."""
    return voice[:-2] + "-2" if voice.endswith("-1") else voice


def speak(text: str, voice: str, dialect: str, dest: Path) -> Path:
    """بيكتب ملف mp3 في dest بصوت HD. voice و dialect لازم يكونوا من نفس اللهجة."""
    key = api_key()
    if not key:
        raise FasihError("مفتاح فصيح مش متسجل: ضيف FASIH_API_KEY في متغيرات Railway")
    text = (text or "").strip()
    if not text:
        raise FasihError("مفيش كلام يتقال")
    head = {"x-api-key": key, "Content-Type": "application/json"}
    body = {"text": text[:5000], "voice": hd_voice(voice), "dialect": dialect}
    req_key = uuid.uuid4().hex   # نفس المفتاح لو بنعيد نفس الطلب، علشان مايتحسبش مرتين
    with httpx.Client(timeout=60) as c:
        job = None
        for attempt in range(3):
            try:
                r = c.post(f"{HD}/generate-tts-v2", headers={**head, "Idempotency-Key": req_key}, json=body)
            except httpx.HTTPError:
                if attempt == 2:
                    raise FasihError("مش قادرين نوصل لفصيح دلوقتي")
                time.sleep(2 * (attempt + 1))
                continue
            if r.status_code in (500, 502, 503, 504) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            if r.status_code not in (200, 201, 202):
                raise _err(r, "صوت فصيح")
            job = r.json().get("jobId")
            break
        if not job:
            raise FasihError("فصيح مرجعش رقم مهمة")
        t0, misses = time.time(), 0
        while time.time() - t0 < 600:
            time.sleep(3)
            try:
                r = c.post(f"{HD}/get-long-tts-job", headers=head, json={"id": job})
            except httpx.HTTPError:
                r = None
            if r is None or r.status_code in (500, 502, 503, 504):
                misses += 1
                if misses > 5:
                    raise FasihError("فصيح مش بيرد على متابعة الصوت")
                continue
            if r.status_code != 200:
                raise _err(r, "متابعة صوت فصيح")
            j = r.json().get("job") or {}
            st = j.get("status")
            if st == "completed" and j.get("audio_url"):
                a = c.get(j["audio_url"], timeout=120)   # رابط مؤقت: بيتنزّل على طول ويتحفظ عندنا
                if a.status_code != 200 or len(a.content) < 200:
                    raise FasihError("ملف الصوت من فصيح مانزلش")
                dest.write_bytes(a.content)
                return dest
            if st in ("failed", "error", "cancelled", "canceled"):
                raise FasihError(f"فصيح: {j.get('error') or 'الصوت فشل'} (رقم المهمة {job})")   # مابنعيدش لوحدنا
        raise FasihError(f"فصيح اتأخر أكتر من 10 دقايق (رقم المهمة {job})")
