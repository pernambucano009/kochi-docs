"""📁 مكتبة العقل: صور وفيديوهات وأصوات العميل في فولدرات جوه فولدرات، وكل ملف المخ بيكتب عليه هو إيه (وصف وتاجات).

الأساس اللي «الموديل المخصص» (الكانفاس) هيشتغل عليه: «اسحب صورة من @صور/أسنان/قبل»، أو ملف بعينه، أو «صورة فيها ابتسامة».
الملفات نفسها في فولدر واحد على السيرفر، والفولدرات مجرد شجرة في library.json (النقل والتسمية مابيلمسوش الملفات).
"""
from __future__ import annotations

import re
import uuid

from ideamem import norm

KINDS = {"image": "صورة", "video": "فيديو", "audio": "صوت"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac"}
MAX_DEPTH = 6


def kind_of(ext: str) -> str | None:
    ext = ext.lower()
    return "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else "audio" if ext in AUDIO_EXT else None


def empty() -> dict:
    return {"folders": [], "files": []}


def fid() -> str:
    return uuid.uuid4().hex[:10]


def clean_name(s: str, fallback: str = "من غير اسم") -> str:
    s = re.sub(r"[\\/\x00-\x1f]", " ", str(s or "")).strip()
    return re.sub(r"\s+", " ", s)[:80] or fallback


def children(lib: dict, parent: str | None) -> list[dict]:
    return [f for f in lib["folders"] if f.get("parent") == parent]


def path_of(lib: dict, folder: str | None) -> list[dict]:
    """الفولدر وآباؤه من فوق لتحت."""
    by = {f["id"]: f for f in lib["folders"]}
    out, cur, seen = [], by.get(folder or ""), set()
    while cur and cur["id"] not in seen:
        seen.add(cur["id"])
        out.append(cur)
        cur = by.get(cur.get("parent") or "")
    return out[::-1]


def path_text(lib: dict, folder: str | None) -> str:
    return "/".join(f["name"] for f in path_of(lib, folder))


def descendants(lib: dict, folder: str) -> set[str]:
    out, stack = set(), [folder]
    while stack:
        cur = stack.pop()
        for c in children(lib, cur):
            if c["id"] not in out:
                out.add(c["id"])
                stack.append(c["id"])
    return out


def ensure_path(lib: dict, parent: str | None, parts: list[str]) -> str | None:
    """فولدر مرفوع بفولدراته («أسنان/قبل/صورة.jpg»): الفولدرات بتتعمل لو مش موجودة، وبيرجّع آخر واحد."""
    cur = parent
    for name in [clean_name(p) for p in parts if p.strip()][:MAX_DEPTH]:
        hit = next((f for f in children(lib, cur) if norm(f["name"]) == norm(name)), None)
        if not hit:
            hit = {"id": fid(), "name": name, "parent": cur}
            lib["folders"].append(hit)
        cur = hit["id"]
    return cur


def resolve(lib: dict, ref: str) -> tuple[str | None, dict | None]:
    """منشن: «صور/أسنان/قبل» ← فولدر، أو اسم ملف بعينه ← ملف. بيرجّع (folder_id, file)."""
    parts = [p for p in re.split(r"[/\\›>]+", str(ref or "").lstrip("@")) if p.strip()]
    cur = None
    for i, p in enumerate(parts):
        hit = next((f for f in children(lib, cur) if norm(f["name"]) == norm(p)), None)
        if hit:
            cur = hit["id"]
            continue
        if i == len(parts) - 1:   # آخر جزء مش فولدر: ملف بالاسم جوه الفولدر ده
            f = next((x for x in lib["files"] if x.get("folder") == cur and norm(x["name"]) == norm(p)), None)
            return cur, f
        return None, None
    return cur, None


def search(lib: dict, q: str, kind: str = "", folder: str | None = None, deep: bool = True) -> list[dict]:
    """بحث بالاسم والوصف والتاجات (بعد توحيد الحروف). من غير كلام: كل اللي في الفولدر."""
    words = [w for w in norm(q).split() if len(w) > 1]
    scope = None if folder is None else ({folder} | (descendants(lib, folder) if deep else set()))
    out = []
    for f in lib["files"]:
        if kind and f.get("kind") != kind:
            continue
        if scope is not None and f.get("folder") not in scope:
            continue
        if words:
            hay = norm(" ".join([f.get("name", ""), f.get("desc", ""), " ".join(f.get("tags") or []), path_text(lib, f.get("folder"))]))
            score = sum(1 for w in words if w in hay)
            if not score:
                continue
            out.append((score, f))
        else:
            out.append((0, f))
    return [f for _, f in sorted(out, key=lambda x: (-x[0], x[1].get("at") or ""), reverse=False)]


def tag_messages(kind: str, name: str, where: str, extra: str = "") -> list[dict]:
    what = {"image": "الصورة", "video": "الفيديو", "audio": "التسجيل الصوتي"}[kind]
    return [{"role": "system", "content": "انت بتنظّم مكتبة صور وفيديوهات وأصوات لبراند. اكتب بالعربي الفصيح البسيط. رجّع JSON بس."},
            {"role": "user", "content": (
                f"وصّف {what} ده في جملة قصيرة (فيه إيه بالظبط: الحاجة، المكان، الناس، الإحساس، قبل/بعد لو باين)، "
                "وبعدين من 4 لـ 10 تاجات قصيرة بالعربي (وكمان الإنجليزي لو مفيد) تساعد البحث بعدين.\n"
                f"اسم الملف: «{name}» · مكانه في المكتبة: «{where or 'الرئيسية'}»\n{extra}"
                '\nJSON: {"desc": "...", "tags": ["..."]}')}]


def clean_tags(raw: dict) -> tuple[str, list[str]]:
    desc = re.sub(r"\s+", " ", str(raw.get("desc") or "")).strip()[:300]
    tags = []
    for t in raw.get("tags") or []:
        t = re.sub(r"\s+", " ", str(t)).strip(" #،,.")[:40]
        if t and norm(t) not in {norm(x) for x in tags}:
            tags.append(t)
    return desc, tags[:12]


def mock_tags(name: str, where: str) -> tuple[str, list[str]]:
    words = [w for w in re.split(r"[\s_\-./]+", f"{where} {name}") if len(w) > 1][:8]
    return f"ملف «{name}» في «{where or 'الرئيسية'}»", list(dict.fromkeys(words))
