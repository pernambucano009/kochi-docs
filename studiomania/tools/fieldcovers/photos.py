"""📸 صور منتجات حقيقية الشكل (Atlas) لأغلفة المجالات، مكان الرسومات: صورة على خلفية بيضاء ← نشيل الخلفية.
    ATLASCLOUD_API_KEY=… python3 tools/fieldcovers/photos.py [name ...]
الناتج: tools/fieldcovers/photos/<name>.png (من غير خلفية). المفتاح من المتغيرات بس، مابيتحفظش في أي ملف."""
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent.parent / "backend"))
import atlas  # noqa: E402
import firstvid  # noqa: E402

atlas.with_rules = lambda p: p   # صور منتجات عامة، من غير قواعد علامة
OUT = HERE / "photos"
BASE = ("Professional commercial product photo, the product alone centered, fully visible with margin around it, "
        "on a seamless pure white background, soft studio lighting, soft shadow under it, photorealistic, sharp, no text, no logo, no brand name. ")
P = {
    "mandi": ("Saudi chicken mandi: a large round white platter of golden yellow long-grain rice topped with a whole roasted half chicken, "
              "fried almonds, raisins and a little parsley, seen from a 45 degree angle", "4:5"),
    "headphones": ("Modern wireless over-ear headphones, matte black with warm orange accents, three-quarter view", "4:5"),
    "sneaker": ("A single white running sneaker with an orange swoosh-free stripe, side view", "1:1"),
    "watch": ("A modern smartwatch with a navy blue strap and a bright fitness rings screen, front view", "1:1"),
    "bag": ("A tan leather women's handbag, front view", "1:1"),
    "building": ("A modern residential apartment building, five floors, beige facade with large glass windows and balconies, "
                 "a few palm trees at the base, isolated architectural model style", "4:5"),
    "ac": ("A modern white wall-mounted split air conditioner unit, front three-quarter view", "4:5"),
    "grocery": ("A brown paper grocery bag full of fresh vegetables and fruits: tomatoes, lettuce, carrots, bananas, a baguette", "4:5"),
    "coffee": ("A matte brown stand-up pouch bag of Arabic coffee beans with a blank cream label, a few roasted beans in front", "1:1"),
    "juice": ("A glass bottle of fresh orange juice with a green cap and a blank label, a sliced orange next to it", "1:1"),
    "honey": ("A glass jar of golden honey with a wooden lid and a honey dipper, blank label", "1:1"),
    "serum": ("A pink glass skincare serum bottle with a dropper cap, blank label, elegant", "4:5"),
    "cream": ("A white and lavender skincare cream jar, lid slightly open showing the cream, blank label", "4:5"),
    "tooth": ("A clean glossy white 3D tooth model with small sparkles, dental clinic concept", "4:5"),
}


# المنتجات البيضا: على خلفية غامقة، علشان شيل الخلفية مايشيلش المنتج نفسه
DARK = {"ac", "tooth", "sneaker", "cream"}


def one(name: str) -> str:
    desc, ratio = P[name]
    size = "1024x1280" if ratio == "4:5" else "1024x1024"
    base = BASE.replace("seamless pure white background", "seamless solid dark charcoal gray background (#2a2a2a)") if name in DARK else BASE
    url = atlas.generate_image("nano2", base + desc, size, "medium")
    raw = OUT / f"{name}.raw.png"
    raw.write_bytes(httpx.get(url, timeout=120, follow_redirects=True).content)
    firstvid.cutout(raw, OUT / f"{name}.png")
    raw.unlink()
    return name


if __name__ == "__main__":
    if not atlas.api_key():
        sys.exit("ATLASCLOUD_API_KEY مش موجود")
    OUT.mkdir(exist_ok=True)
    names = sys.argv[1:] or list(P)
    with ThreadPoolExecutor(5) as ex:
        for f in [ex.submit(one, n) for n in names]:
            try:
                print("✓", f.result(), flush=True)
            except Exception as e:  # noqa: BLE001
                print("✗", e, flush=True)
