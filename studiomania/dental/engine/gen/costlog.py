"""تسجيل تكلفة كل طلب لموديل مدفوع، لكل حالة لوحدها: <CASE_DIR>/qa/costs.jsonl (سطر لكل طلب).
الأسعار من قايمة أطلس / Anthropic (دولار). موديلات النص: لكل مليون توكن (دخل، خرج). موديلات الصور/الفيديو: للطلب (الفيديو: للثانية).
التسجيل مابيوقّعش أي شغل أبدًا (أي خطأ فيه بيتبلع)."""
import os, json, time, threading

TOKEN = {   # (دخل، خرج) لكل مليون توكن
    "google/gemini-2.5-pro": (1.25, 10.0), "google/gemini-3.8-flash": (0.75, 3.75),
    "anthropic/claude-opus-5.5": (4.0, 20.0), "claude-opus-5-5": (4.0, 20.0),
    "anthropic/claude-sonnet-5.5": (2.0, 10.0), "claude-sonnet-5-5": (2.0, 10.0),
    "anthropic/claude-haiku-5.5": (0.10, 0.50), "claude-haiku-5-5": (0.10, 0.50), "anthropic/claude-haiku-5.5-ccmax": (0.10, 0.50),
}
FIXED = {   # للطلب
    "google/nano-banana-pro/edit-developer": 0.049, "google/nano-banana-pro/edit": 0.049,
    "tencent/image/upscaler": 0.024,
}
PER_SEC = {"bytedance/seedance-2.0-mini/image-to-video": 0.011}   # للثانية (تقدير من قايمة أطلس)
_L = threading.Lock()


def _path():
    d = os.environ.get("COST_LOG") or (os.path.join(os.environ["CASE_DIR"], "qa", "costs.jsonl") if os.environ.get("CASE_DIR") else None)
    return d


def log(kind, model, usd, **meta):
    try:
        p = _path()
        if not p: return
        os.makedirs(os.path.dirname(p), exist_ok=True)
        row = {"t": time.strftime("%Y-%m-%d %H:%M:%S"), "kind": kind, "model": model, "usd": round(float(usd), 5), **meta}
        with _L, open(p, "a") as f: f.write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception: pass


def tokens(kind, model, tin, tout, **meta):
    pin, pout = TOKEN.get(model, (0.0, 0.0))
    log(kind, model, (tin or 0) / 1e6 * pin + (tout or 0) / 1e6 * pout, tin=tin, tout=tout, est=model not in TOKEN, **meta)


def gen(kind, model, body=None, **meta):
    if model in FIXED: usd = FIXED[model]
    elif model in PER_SEC: usd = PER_SEC[model] * float((body or {}).get("duration", 5))
    else: usd = 0.0
    log(kind, model, usd, est=model in PER_SEC or model not in FIXED, **meta)


def summary(case_dir):
    p = os.path.join(case_dir, "qa", "costs.jsonl"); rows = []
    if os.path.exists(p):
        for l in open(p):
            try: rows.append(json.loads(l))
            except Exception: pass
    by = {}
    for r in rows:
        k = (r.get("kind"), r.get("model")); n, u = by.get(k, (0, 0.0)); by[k] = (n + 1, u + r.get("usd", 0))
    return {"total_usd": round(sum(r.get("usd", 0) for r in rows), 4), "calls": len(rows),
            "by": [{"kind": k, "model": m, "calls": n, "usd": round(u, 4)} for (k, m), (n, u) in sorted(by.items(), key=lambda x: -x[1][1])]}
