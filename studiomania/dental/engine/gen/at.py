import httpx, json, sys, time, pathlib
K = (__import__("os").environ.get("ATLASCLOUD_API_KEY") or __import__("os").environ.get("ATLAS_CLOUD_API_KEY") or "")
B = "https://api.atlascloud.ai/api/v1/model"
H = {"Authorization": f"Bearer {K}"}
def unwrap(p): return p["data"] if isinstance(p, dict) and "data" in p and "code" in p else p
def run(kind, body, t=1800):
    r = httpx.post(f"{B}/generate{kind}", headers=H, json=body, timeout=90)
    if r.status_code in (401, 403): raise SystemExit("ATLAS_AUTH " + r.text[:200])
    if r.status_code >= 400: raise SystemExit(f"{r.status_code} {r.text[:600]}")
    pid = unwrap(r.json()).get("id")
    t0 = time.time()
    while time.time() - t0 < t:
        p = unwrap(httpx.get(f"{B}/prediction/{pid}", headers=H, timeout=60).json())
        st = p.get("status")
        if st in ("completed", "succeeded"):
            o = p.get("outputs") or p.get("output"); o = [o] if isinstance(o, str) else o
            return o[0]
        if st in ("failed", "timeout", "canceled", "cancelled"): raise SystemExit(f"failed: {str(p)[:600]}")
        time.sleep(5)
    raise SystemExit("timeout")
def get(url, dest): pathlib.Path(dest).write_bytes(httpx.get(url, timeout=300, follow_redirects=True).content)
def upload(path):
    with open(path, "rb") as f:
        r = httpx.post(f"{B}/uploadMedia", headers=H, files={"file": (pathlib.Path(path).name, f)}, timeout=300)
    if r.status_code in (401, 403): raise SystemExit("ATLAS_AUTH " + r.text[:200])
    d = unwrap(r.json()); return d.get("download_url") or d.get("url")
