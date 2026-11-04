"""أداة عامة: صور معالم مدينة العميل (بتتعمل مرة واحدة عند اختيار المدينة وبتتحفظ كعنصر).
الاستخدام: python3 city_assets.py "الإسكندرية"  ← بيعمل 3 معالم + طيارة فوق المدينة في assets/city/<المدينة>/"""
import sys, os, json
S = ((__import__("os").environ.get("DENTAL_ROOT") or __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))) + "/"); sys.path.insert(0, S + "gen")
from at import run, get
T2I = "google/nano-banana-pro/text-to-image-developer"
def make(city, n=3):
    d = S + f"assets/city/{city}/"; os.makedirs(d, exist_ok=True)
    for k in range(n):
        p = d + f"l{k}.png"
        if os.path.exists(p): continue
        prompt = (f"The #{k + 1} most famous and recognizable landmark of the city of {city} (pick a different landmark for each number), "
                  "photorealistic travel photo at golden hour, vertical 9:16, wide angle, no people in foreground, no text, no logos.")
        get(run("Image", {"model": T2I, "prompt": prompt, "aspect_ratio": "9:16", "resolution": "2k"}), p); print("landmark", k, flush=True)
    p = d + "plane.png"
    if not os.path.exists(p):
        get(run("Image", {"model": T2I, "prompt": f"A white passenger airplane flying over the skyline of {city} at sunset, the city's famous landmarks visible below, photorealistic, vertical 9:16, no text, no logos.", "aspect_ratio": "9:16", "resolution": "2k"}), p); print("plane", flush=True)
    return d
if __name__ == "__main__": print(make(sys.argv[1]))
