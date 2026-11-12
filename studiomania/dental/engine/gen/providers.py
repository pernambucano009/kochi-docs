"""أرخص مزوّد لكل موديل (أطلس / Runware). at.run بيسأل هنا قبل كل طلب صورة/فيديو.

- الأسعار دولار (فيديو: للثانية، صور: للصورة) عند **الجودة اللي بنستخدمها فعلًا**. أي سعر مش متأكدين منه متعلّم «est».
- Runware بيرجّع التكلفة الحقيقية لكل طلب (includeCost) وبتتسجّل في costlog — وبيها الجدول ده بيتصحّح.
- Runware بيشتغل بس لو مفتاحه موجود: RUNWARE_API_KEY، أو ملف scratchpad/.runware_key، أو RUNWARE_VIA_PROXY=1
  (لو المفتاح محفوظ كـ Network secret والبروكسي هو اللي بيحطه).
- أي فشل من Runware ← نرجع لأطلس لوحده (المستخدم مايتأثرش).
- PROVIDER_FORCE=atlas|runware بيجبر مزوّد معين (للتجربة).
"""
import os, json, time, uuid, pathlib
import httpx

S = str(pathlib.Path(__file__).resolve().parent.parent) + "/"
RW_URL = "https://api.runware.ai/v1"

# atlas_model ← {مزوّد: {"price": سعر، "air": اسم الموديل عند المزوّد، "est": تقدير؟}}
# مصدر الأرقام: أطلس = لستة موديلات الـAPI بتاعهم (السعر بعد الخصم، للجودة الأساسية) — Runware = مقارنة 10 نوفمبر (480p).
# لما نقيس التكلفة الحقيقية بالجودة اللي بنستخدمها (1080p-sr / 720p) الأرقام دي بتتعدّل.
TABLE = {
    "bytedance/seedance-2.0-mini/image-to-video": {"atlas": {"price": .011, "est": True}, "runware": {"price": .036, "air": None, "est": True}},
    "bytedance/seedance-2.0/image-to-video":      {"atlas": {"price": .09},               "runware": {"price": .07,  "air": None, "est": True}},
    "bytedance/seedance-2.0-fast/image-to-video": {"atlas": {"price": .027, "est": True}, "runware": {"price": .06,  "air": None, "est": True}},
    "kwaivgi/kling-v3.0-pro/image-to-video":      {"atlas": {"price": .095},              "runware": {"price": .112, "air": None, "est": True}},
    "alibaba/wan-3.0/image-to-video":             {"atlas": {"price": .04},               "runware": {"price": .05,  "air": None, "est": True}},
    "alibaba/wan-3.0-prime/image-to-video":       {"atlas": {"price": .061},              "runware": {"price": .068, "air": None, "est": True}},
}
# اسم الموديل عند Runware (AIR) — بيتدوّر عليه أوتوماتيك أول مرة بـ modelSearch ويتحفظ هنا
AIR_CACHE = S + "gen/runware_air.json"


def _rw_key():
    k = os.environ.get("RUNWARE_API_KEY", "").strip()
    if not k and os.path.exists(S + ".runware_key"): k = open(S + ".runware_key").read().strip()
    if not k and os.environ.get("RUNWARE_VIA_PROXY") == "1": k = "proxy"   # البروكسي بيبدّله بالمفتاح الحقيقي
    return k


def enabled(p):
    return p == "atlas" or (p == "runware" and bool(_rw_key()))


def choose(model):
    """أرخص مزوّد متاح للموديل ده (أطلس افتراضيًا)."""
    f = os.environ.get("PROVIDER_FORCE")
    row = TABLE.get(model)
    if not row: return "atlas"
    if f and f in row and enabled(f): return f
    ok = [(v["price"], p) for p, v in row.items() if enabled(p)]
    return min(ok)[1] if ok else "atlas"


# ---------------- Runware ----------------
def _rw_post(tasks, timeout=120):
    k = _rw_key()
    r = httpx.post(RW_URL, headers={"Authorization": f"Bearer {k}", "Content-Type": "application/json"}, json=tasks, timeout=timeout)
    if r.status_code in (401, 403): raise RuntimeError("RUNWARE_AUTH " + r.text[:200])
    j = r.json()
    if j.get("errors"): raise RuntimeError("RUNWARE " + json.dumps(j["errors"])[:400])
    return j.get("data") or []


def air(model):
    """اسم الموديل عند Runware: من الكاش، أو من الجدول، أو بالبحث في كتالوجهم (modelSearch)."""
    cache = json.load(open(AIR_CACHE)) if os.path.exists(AIR_CACHE) else {}
    if model in cache: return cache[model]
    a = (TABLE.get(model, {}).get("runware") or {}).get("air")
    if not a:
        q = model.split("/")[1].replace("-", " ")           # seedance-2.0-mini ← "seedance 2.0 mini"
        d = _rw_post([{"taskType": "modelSearch", "taskUUID": str(uuid.uuid4()), "search": q, "category": "video", "limit": 10}])
        res = (d[0].get("results") if d else None) or []
        words = q.lower().split()
        best = [m for m in res if all(w in (m.get("name", "") + " " + m.get("air", "")).lower() for w in words)]
        if not best: raise RuntimeError(f"RUNWARE: مالقيتش الموديل {q} في الكتالوج: {[m.get('air') for m in res][:6]}")
        a = best[0]["air"]
    cache[model] = a; pathlib.Path(AIR_CACHE).write_text(json.dumps(cache, ensure_ascii=False, indent=1)); return a


def run_runware(kind, body, t=1800):
    """image-to-video (وstart-end) على Runware بنفس شكل طلب أطلس. بيرجّع رابط الفيديو، وبيسجّل التكلفة الحقيقية."""
    if kind != "Video": raise RuntimeError("RUNWARE: فيديو بس لحد دلوقتي")
    m = body["model"]; tid = str(uuid.uuid4())
    frames = [{"inputImage": body["image"], "frame": "first"}]
    if body.get("end_image"): frames.append({"inputImage": body["end_image"], "frame": "last"})
    task = {"taskType": "videoInference", "taskUUID": tid, "model": air(m), "positivePrompt": body.get("prompt", ""),
            "duration": body.get("duration", 5), "deliveryMethod": "async", "includeCost": True, "outputFormat": "MP4",
            "frameImages": frames}
    res = str(body.get("resolution", "")).replace("-sr", "")
    if res: task["resolution"] = res
    if body.get("aspect_ratio"): task.setdefault("providerSettings", {})["bytedance"] = {"ratio": body["aspect_ratio"]}   # تقدير — بيتأكد في أول تجربة
    _rw_post([task])
    t0 = time.time()
    while time.time() - t0 < t:
        time.sleep(5)
        d = _rw_post([{"taskType": "getResponse", "taskUUID": tid}], timeout=60)
        it = next((x for x in d if x.get("taskUUID") == tid), None)
        if not it: continue
        st = it.get("status")
        if st in ("success", "completed") or it.get("videoURL"):
            try:
                import costlog; costlog.log("gen", m, it.get("cost") or 0, via="runware", real_cost=it.get("cost") is not None, seconds=body.get("duration"))
            except Exception: pass
            return it.get("videoURL") or it.get("mediaURL")
        if st in ("error", "failed"): raise RuntimeError("RUNWARE failed " + json.dumps(it)[:400])
    raise RuntimeError("RUNWARE timeout")
