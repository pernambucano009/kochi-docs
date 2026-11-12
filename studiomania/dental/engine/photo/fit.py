"""أي حالة تنفع لأي قالب (صور وفيديو) — من تصنيف صور الحالة بس (بايثون عادي، من غير مكتبات صور)، فالمنصة بتستورده مباشرة.

صورة مصنّفة = {"id", "stage": before|prep|after|unknown, "kind": smile|retracted|macro|occlusal|other,
               "view": front|right|left, "yaw": رقم أو None, "group": رقم أو None, "from_face": صورة وش كامل؟, "video": فيديو؟}
fit_photo(tid, photos) / fit_video(tid, photos, needs) ← {"ok", "photos": {الدور: id}, "missing": نص للطبيب أو None}
"""

YAW_TOL = 10   # أقصى فرق (درجات) في زاوية الكاميرا بين صورتين «بالزاوية نفسها»
ST = {"before": "قبل العلاج", "prep": "بعد التحضير", "after": "بعد العلاج"}
KD = {"smile": "ابتسامة", "retracted": "بالريتراكتور", "macro": "مقرّبة", "*": "", "retracted|macro": "بالريتراكتور"}
VW = {"front": "من الأمام", "side": "من الجانب", "right": "من اليمين", "left": "من اليسار", "*": ""}

# قوالب الصور: كل دور (المرحلة، النوع، الاتجاه)
PHOTO_NEEDS = {
    "p01": [("before", "smile", "front"), ("after", "smile", "front")],
    "p02": [("before", "retracted", "front"), ("after", "retracted", "front")],
    "p03": [("before", "smile|retracted", "side"), ("after", "smile|retracted", "side")],
    "p04": [("before", "retracted", "*"), ("after", "retracted", "*")],
    "p05": [("after", "retracted|macro", "*")],   # أي زاوية ريتراكتور؛ القالب بيلفها بالعرض ويكبّر لو محتاج
    "p06": [("before", "retracted", "*"), ("prep", "retracted", "*"), ("after", "retracted", "*")],
    "p07": [("before", "retracted", "*"), ("prep", "retracted", "*"), ("after", "retracted", "*")],
    "p08": [("after", "retracted", "front")],
    "p09": [("before", "retracted", "front"), ("after", "retracted", "front")],
    "p10": [("before", "retracted", "front"), ("after", "retracted", "front")],
    "p11": [("after", "retracted", "right")],
    "p12": [("after", "retracted", "left")],
}


def _ok(p, stage, kind, view):
    if p.get("video") or p.get("made") or p.get("stage") != stage: return False
    if kind != "*" and p.get("kind") not in kind.split("|"): return False
    if view == "side": return p.get("view") in ("right", "left")
    return view == "*" or p.get("view") == view


def _desc(stage, kind, view):
    return " ".join(x for x in ("صورة", KD.get(kind, ""), ST[stage], VW.get(view, "")) if x)


def fit_photo(tid, photos):
    need = PHOTO_NEEDS[tid]
    if len(need) == 1:
        c = [p for p in photos if _ok(p, *need[0])]
        c.sort(key=lambda p: (p.get("from_face", False), p.get("kind") != "retracted"))
        return {"ok": bool(c), "photos": {need[0][0]: c[0]["id"]} if c else {}, "missing": None if c else "ينقصها " + _desc(*need[0])}
    firsts = [p for p in photos if _ok(p, *need[0])]
    best, lacking = None, None
    for b in firsts:
        same_shot = lambda p: p.get("kind") == b.get("kind") and p.get("view") == b.get("view")
        rest = [[p for p in photos if _ok(p, *n) and same_shot(p)] for n in need[1:]]
        if any(not r for r in rest):
            lacking = lacking or next(n for n, r in zip(need[1:], rest) if not r)
            continue
        for combo in _combos(rest):
            ph = [b] + combo
            same = (len({p.get("group") for p in ph}) == 1 and ph[0].get("group") is not None) or any(p.get("from_face") for p in ph)
            ys = [p["yaw"] for p in ph if isinstance(p.get("yaw"), (int, float))]
            d = (max(ys) - min(ys)) if len(ys) == len(ph) else 0
            d = d if same else max(d, 99)
            if best is None or d < best[0]: best = (d, ph)
    if best is None:
        miss = [n for n in need if not any(_ok(p, *n) for p in photos)]
        if not miss:   # كل صورة موجودة لوحدها، بس مفيش اتنين بنفس نوع اللقطة واتجاهها
            return {"ok": False, "photos": {}, "missing": "صور " + " و".join(ST[n[0]] for n in need) + " ليست من اللقطة نفسها (النوع أو الاتجاه مختلف)"}
        return {"ok": False, "photos": {}, "missing": "ينقصها " + " و".join(_desc(*n) for n in miss)}
    roles = {n[0]: p["id"] for n, p in zip(need, best[1])}
    if best[0] > YAW_TOL:
        return {"ok": False, "photos": roles, "missing": "صور " + " و".join(ST[n[0]] for n in need) + " ليست بزاوية التصوير نفسها"}
    return {"ok": True, "photos": roles, "missing": None}


def _combos(lists):
    if not lists: return [[]]
    return [[x] + rest for x in lists[0][:4] for rest in _combos(lists[1:])]


# قوالب الفيديو: خانات محرك الفيديو من نفس التصنيف (صورة وش كامل = خانة «الوجه»، ونقص منها البق لو الخانة القريبة ناقصة)
SLOTS = {
    "before_retracted": ("before", "retracted", False), "after_retracted": ("after", "retracted", False),
    "before_smile": ("before", "smile", False), "after_smile": ("after", "smile", False),
    "before_face": ("before", "smile", True), "after_face": ("after", "smile", True),
    "before_face_retracted": ("before", "retracted", True), "after_face_retracted": ("after", "retracted", True),
}
REQUIRED = ["before_retracted", "after_retracted", "before_smile", "after_smile", "before_face"]
DERIVE = {"before_retracted": "before_face_retracted", "after_retracted": "after_face_retracted",
          "before_smile": "before_face", "after_smile": "after_face"}
SLOT_TEXT = {"before_retracted": "صورة بالريتراكتور قبل العلاج من الأمام", "after_retracted": "صورة بالريتراكتور بعد العلاج من الأمام",
             "before_smile": "صورة ابتسامة قبل العلاج", "after_smile": "صورة ابتسامة بعد العلاج",
             "before_face": "صورة وجه المريض كاملًا قبل العلاج", "after_live": "فيديو للمريض بعد العلاج"}


def video_slots(photos):
    """{الخانة: id} من الصور المصنّفة (الأقرب للأمام أولًا)."""
    out = {}
    for slot, (stage, kind, face) in SLOTS.items():
        c = [p for p in photos if not p.get("video") and not p.get("made") and p.get("stage") == stage and p.get("kind") == kind
             and bool(p.get("from_face")) == face and p.get("view", "front") == "front"]
        if c: out[slot] = c[0]["id"]
    return out


def fit_video(tid, photos, needs=()):
    s = video_slots(photos)
    miss = [k for k in REQUIRED if k not in s and not (DERIVE.get(k) and DERIVE[k] in s)]
    vids = [p for p in photos if p.get("video") and p.get("stage") in ("after", "unknown", None)]
    if "after_live" in needs and not vids: miss.append("after_live")
    return {"ok": not miss, "photos": s, "live": vids[0]["id"] if vids else None,
            "missing": None if not miss else "ينقصها " + "، ".join(SLOT_TEXT[k] for k in miss)}
