"""🧩 ينشر مكتبة عناصر المجال للموقع: نسخة خفيفة (webp ‏٥١٢) في frontend/gallery/el/<field>/<style>/<name>.webp
وملف فهرس index.json (وصف كل عنصر، والستايل اللي كل قالب بيستخدمه) عشان البرنامج يختار العناصر حسب السكريبت.
    python3 tools/fieldcovers/publish_elements.py [field]
الستايل لكل قالب من أمثلة الأغلفة (fitness.py: أول «ستايل:اسم» في els)، و«base» = العناصر العادية."""
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import elements  # noqa: E402

FIELD = sys.argv[1] if len(sys.argv) > 1 else "fitness"
SRC = HERE / "elements" / FIELD / "krea2t"
OUT = ROOT / "frontend" / "gallery" / "el" / FIELD


def tpl_styles() -> dict:
    import fitness  # noqa: PLC0415  (أمثلة الأغلفة: قالب ← قيمه)
    out = {}
    for tid, v in fitness.F.items():
        els = v.get("els") if isinstance(v, dict) else None
        if els:
            out[tid] = str(els[0]).split(":", 1)[0] if ":" in str(els[0]) else "base"
    return out


def main() -> None:
    tpl = tpl_styles()
    styles = sorted(set(tpl.values()) | {"base"})
    n = 0
    for st in styles:
        src = SRC if st == "base" else SRC / st
        dst = OUT / st
        dst.mkdir(parents=True, exist_ok=True)
        for name in elements.ITEMS:
            f = src / f"{name}.png"
            if not f.exists():
                continue
            im = Image.open(f).convert("RGBA")
            box = im.getbbox()   # الهوامش الفاضية بتتشال (العنصر بحجمه الحقيقي)
            if box:
                im = im.crop(box)
            im.thumbnail((512, 512))
            im.save(dst / f"{name}.webp", "WEBP", quality=82, method=6)
            n += 1
    items = {k: v.replace(elements.PERSON, "a faceless athletic figure ") for k, v in elements.ITEMS.items()
             if (SRC / f"{k}.png").exists()}
    (OUT / "index.json").write_text(json.dumps({"field": FIELD, "items": items, "styles": styles, "tpl": tpl}, ensure_ascii=False, indent=1), "utf-8")
    print(f"{n} files → {OUT}; templates: {len(tpl)}; styles: {styles}")


if __name__ == "__main__":
    main()
