"""🌱 مكتبة العناصر اللي بتكبر: السكريبت بيتقسم لجمل، وكل جملة بتاخد رسمة للحاجة اللي اتقالت فيها هي بالظبط
(مش رمز عام للمجال). لو الرسمة مش موجودة بستايل القالب، بتترسم مرة واحدة وتتحفظ في مكتبة المنصة المشتركة
(<PLATFORM>/el/<field>/<style>/<key>.webp)، فأي حساب تاني في نفس المجال بيلاقيها بعد كده.
مافيهاش أي حاجة من بيانات العميل: وصف إنجليزي عام لشيء واحد مرسوم."""
from __future__ import annotations

import fcntl
import hashlib
import json
import re
import time
from contextlib import contextmanager
from pathlib import Path

RECENT_KEEP = 40     # ذاكرة الحساب: آخر العناصر اللي اتستخدمت (عشان مايتكررش)
PLANS_KEEP = 300


def norm_key(s) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(s or "").lower()).strip("_")[:48]


def field_root(root: Path, field: str) -> Path:
    return root / "el" / re.sub(r"[^a-z0-9_-]", "", field)


def file_for(root: Path, field: str, style: str, key: str) -> Path:
    return field_root(root, field) / re.sub(r"[^a-z0-9_-]", "", style) / f"{norm_key(key)}.webp"


@contextmanager
def locked(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a+") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)


def _read(f: Path, default):
    try:
        return json.loads(f.read_text("utf-8"))
    except (OSError, ValueError):
        return default


def _write(f: Path, data) -> None:
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_name(f".{f.name}.{time.time_ns()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
    tmp.replace(f)


def shared_items(root: Path, field: str) -> dict:
    """{key: {desc, at}} للعناصر اللي اتضافت للمنصة."""
    return (_read(field_root(root, field) / "index.json", {}) or {}).get("items") or {}


def add_shared(root: Path, field: str, key: str, desc: str) -> None:
    f = field_root(root, field) / "index.json"
    with locked(f.with_name("index.lock")):
        d = _read(f, {}) or {}
        items = d.setdefault("items", {})
        if key not in items:
            items[key] = {"desc": desc, "at": int(time.time())}
            _write(f, d)


def lines_of(text: str) -> list[str]:
    """السكريبت ← جمل قصيرة (كل جملة = لحظة في الفيديو)."""
    parts = re.split(r"(?<=[.!?؟…\n])\s+|\n+", str(text or ""))
    out = [re.sub(r"\s+", " ", p).strip(" -•\t") for p in parts]
    return [p for p in out if len(p) > 2][:24]


def plan_key(mid: str, style: str, lines: list[str]) -> str:
    return hashlib.sha1(json.dumps([mid, style, lines], ensure_ascii=False).encode()).hexdigest()[:16]


def plan_get(cache: Path, key: str):
    return (_read(cache, {}) or {}).get(key)


def plan_put(cache: Path, key: str, beats: list) -> None:
    with locked(cache.with_name(cache.name + ".lock")):
        d = _read(cache, {}) or {}
        d[key] = {"beats": beats, "at": time.time()}
        if len(d) > PLANS_KEEP:
            for k in sorted(d, key=lambda k: d[k].get("at", 0))[: len(d) - PLANS_KEEP]:
                d.pop(k, None)
        _write(cache, d)


def recent_get(f: Path) -> list[str]:
    v = _read(f, [])
    return v if isinstance(v, list) else []


def recent_add(f: Path, keys: list[str]) -> None:
    with locked(f.with_name(f.name + ".lock")):
        old = [k for k in recent_get(f) if k not in keys]
        _write(f, (old + list(keys))[-RECENT_KEEP:])


def plan_messages(lines: list[str], menu: dict[str, str], avoid: list[str], n: int) -> list[dict]:
    script = "\n".join(f"{i}. {s}" for i, s in enumerate(lines))
    lib = "\n".join(f"- {k}: {v}" for k, v in menu.items())
    lo = min(3, n, len(lines))
    return [
        {"role": "system", "content": "You are the art director of a short vertical social video. For the spoken script you choose the "
                                      "illustrations that appear on screen, one at a time, so each one shows exactly what is being said at that moment. "
                                      "Answer JSON only."},
        {"role": "user", "content": (
            f"Script lines (Arabic, numbered, in speaking order):\n{script}\n\n"
            f"Existing illustration library (key: what it shows):\n{lib or '(empty)'}\n\n"
            f"Recently used in this account's other videos (avoid unless nothing else fits): {', '.join(avoid) or 'none'}\n\n"
            f"Choose about one illustration per line (between {lo} and {n}), in the order the lines are spoken. Skip only lines with nothing concrete to show.\n"
            "Rules:\n"
            "- Each illustration shows the concrete thing a specific line actually talks about: the exact object, food, body part, "
            "movement, tool, situation or number mentioned in those words. Not a generic symbol of the whole field.\n"
            "- Use a library key ONLY if its description shows that same specific thing. Otherwise create a new one.\n"
            "- Prefer a specific new one over a vague library match.\n"
            "- A new one: key = short english snake_case name; desc = one english sentence describing a single isolated subject "
            "(object, food, body part, simple figure doing the action), with its colors/details, no text, no letters, no numbers, no logos, no real people.\n"
            "- No two picks may show the same thing.\n"
            'Answer: {"beats": [{"line": 0, "use": "library_key"}, {"line": 2, "new": {"key": "glass_of_water_with_clock", "desc": "..."}}]}'
        )},
    ]


def parse_plan(raw: str, menu: dict[str, str], known: dict[str, str], n: int, nlines: int) -> list[dict]:
    """رد الموديل ← [{key, desc, line, new}] (من غير تكرار)."""
    m = re.search(r"\{.*\}", raw or "", re.S)
    beats = (json.loads(m.group(0)).get("beats") if m else None) or []
    out, seen = [], set()
    for b in beats:
        if not isinstance(b, dict):
            continue
        try:
            line = max(0, min(nlines - 1, int(b.get("line") or 0)))
        except (TypeError, ValueError):
            line = 0
        use = norm_key(b.get("use"))
        nw = b.get("new") if isinstance(b.get("new"), dict) else None
        if use and use in menu:
            key, desc, is_new = use, menu[use], False
        elif nw and norm_key(nw.get("key")):
            key = norm_key(nw.get("key"))
            if key in menu:
                desc, is_new = menu[key], False
            else:
                desc = known.get(key) or str(nw.get("desc") or "").strip()[:300]
                is_new = True
                if not desc:
                    continue
        else:
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append({"key": key, "desc": desc, "line": line, "new": is_new})
        if len(out) >= n:
            break
    return sorted(out, key=lambda x: x["line"])


def line_starts(lines: list[str], words: list, norm) -> list[float | None]:
    """ثانية بداية كل جملة في الفيديو النهائي: كلماتها بتتدوّر بالترتيب في كلمات التعليق الصوتي ([كلمة, ثانية])."""
    seq = [norm(str(w[0])) for w in words]
    out, pos = [], 0
    for ln in lines:
        ws = [norm(w) for w in re.findall(r"\w+", ln)]
        ws = [w for w in ws if w]
        hit = None
        for L in (3, 2, 1):
            if len(ws) < L:
                continue
            key = ws[:L]
            for i in range(pos, len(seq) - L + 1):
                if seq[i:i + L] == key:
                    hit = i
                    break
            if hit is not None:
                break
        if hit is None:
            out.append(None)
        else:
            out.append(float(words[hit][1]))
            pos = hit + 1
    return out


def gen_prompt(desc: str) -> str:
    return ("Draw a new illustration of: " + desc.rstrip(".") + ". "
            "Use exactly the same art style, medium, line quality, texture, color palette and level of detail as the reference images "
            "(they are other elements from the same illustration set). One single isolated subject, centered and fully visible, "
            "on a plain flat pure white background. No text, no letters, no numbers, no logos, no frame, no ground shadow.")


def save_webp(src: Path, dst: Path, side: int = 512) -> None:
    from PIL import Image
    with Image.open(src) as im:
        im = im.convert("RGBA")
        im.thumbnail((side, side))
        dst.parent.mkdir(parents=True, exist_ok=True)
        tmp = dst.with_name(f".{dst.stem}.{time.time_ns()}.webp")
        im.save(tmp, "WEBP", quality=88, method=6)
        tmp.replace(dst)
