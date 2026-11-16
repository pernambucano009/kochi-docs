"""🧩 مكتبة رسومات المجال: عناصر منفصلة (أجهزة، أكل، ناس بحركات، رموز) بخلفية فاضية، كلها بنفس الزاوية والإضاءة،
عشان القوالب المرسومة تاخد منها حسب السكريبت وتطبّق ستايلها عليها بالكود.
    python3 tools/fieldcovers/elements.py trial               ← نفس ٥ عناصر على كل موديل رخيص (للمقارنة والسعر)
    python3 tools/fieldcovers/elements.py gen <model> [name…] ← يولّد المكتبة (أو عناصر بعينها) بالموديل اللي اتختار
    python3 tools/fieldcovers/elements.py style riso krea2t [name…] ← نفس العناصر بستايل قالب (بدون أسماء: ٥ للتجربة الأول)
الناتج: tools/fieldcovers/elements/<field>/<model>/<name>.png (من غير خلفية) و_cost.json (السعر الفعلي لكل صورة).
المفتاح من المتغيرات بس (والبروكسي بيحطه)، مابيتحفظش في أي ملف."""
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent.parent / "backend"))
import atlas  # noqa: E402
import firstvid  # noqa: E402

FIELD = "fitness"
OUT = HERE / "elements" / FIELD

# الموديلات الرخيصة اللي بنجربها (السعر الأساسي من كتالوج المزوّد، بالدولار للصورة)
MODELS = {
    "gpt25": {"model": "openai/gpt-image-2.5-sunburst/text-to-image", "base": 0.003, "body": lambda p: {"prompt": p, "size": "1024x1024", "quality": "medium", "output_format": "png"}},
    "gpt25low": {"model": "openai/gpt-image-2.5-sunburst/text-to-image", "base": 0.003, "body": lambda p: {"prompt": p, "size": "1024x1024", "quality": "low", "output_format": "png"}},
    "krea2t": {"model": "krea-2-turbo/text-to-image", "base": 0.008, "body": lambda p: {"prompt": p, "image_size": "square_hd"}},
    "nano2lite": {"model": "google/nano-banana-2-lite/text-to-image-developer", "base": 0.014, "body": lambda p: {"prompt": p, "aspect_ratio": "1:1", "resolution": "1k"}},
}

# 🎨 الطريقة الموحدة: نفس الزاوية والإضاءة والخامة لكل العناصر، عشان تبان مجموعة واحدة
STYLE = ("A single isolated object, centered, fully visible with generous margin, on a seamless flat pure white background. "
         "Clean semi-realistic 3D product render, matte materials, soft even studio light from the upper left, "
         "three-quarter view from slightly above, one soft contact shadow under it, no other objects, no text, no logo, no brand, no watermark. Subject: ")
PERSON = ("a stylized faceless mannequin-like athletic figure with smooth matte light-grey skin and no facial features, "
          "wearing modest long black sports clothes (long sleeves, long pants), side view, ")

# 🖌️ نسخة العناصر بستايل قالب معيّن (برومبت ثابت لكل قالب، نفس الموديل الرخيص): لما الستايل مايتعملش بالكود من صورة عادية.
# الناتج: elements/<field>/<model>/<style>/<name>.png
STYLES = {
    "riso": ("A single isolated object, centered, fully visible with generous margin, on plain white paper. "
             "Risograph print illustration made of exactly three transparent overlapping inks: medium blue (#0078BF), fluorescent pink (#FF48B0) "
             "and bright yellow (#FFE800), where the inks overlap they mix into purple, green and orange. Flat simple shapes, visible coarse halftone dots, "
             "grainy ink texture, slight misregistration between the color layers, no black outlines, no gradients, no shadow, "
             "three-quarter view from slightly above, no text, no logo, no watermark. Subject: "),
}
PERSON_STYLED = ("a simple faceless athletic figure with no facial features, wearing modest long sports clothes (long sleeves, long pants), side view, ")

# العناصر: الاسم ← الوصف (people بتاخد وصف الشخص قبلها)
ITEMS = {
    # أجهزة
    "dumbbell": "a pair of black hexagonal rubber dumbbells with chrome handles",
    "kettlebell": "a matte orange cast iron kettlebell with a black handle",
    "barbell": "an olympic barbell with black bumper plates on both ends, lying on the floor",
    "ems_suit": "an EMS electrical muscle stimulation training vest, black with orange electrode pads",
    "jump_rope": "a jump rope with black handles, the rope loosely curled",
    "yoga_mat": "a rolled teal yoga mat standing upright",
    "treadmill": "a modern black home treadmill",
    "bench": "an adjustable black weight bench",
    "resistance_band": "a set of three looped resistance bands in orange, teal and black",
    "foam_roller": "a textured teal foam roller",
    "pullup_bar": "a black doorway pull-up bar",
    "boxing_gloves": "a pair of red boxing gloves",
    "medicine_ball": "a black and orange medicine ball",
    "stationary_bike": "a modern black indoor exercise bike",
    "smartwatch": "a black fitness smartwatch showing an orange heart-rate graph on its screen",
    # أكل وصحة
    "protein": "a black tub of protein powder with a blank orange label and a scoop of powder in front",
    "water_bottle": "a clear sports water bottle with a black cap, full of water",
    "shaker": "a translucent protein shaker bottle with a black lid, half full of chocolate shake",
    "banana": "a bunch of three ripe bananas",
    "apple": "a simple flat green apple with one leaf",
    "oats_bowl": "a white bowl of oatmeal topped with blueberries and banana slices",
    "salad_bowl": "a white bowl of green salad with grilled chicken slices",
    "eggs": "three whole eggs standing side by side, simple oval shapes",
    "dates": "a small ceramic plate of dates",
    "scale": "a white digital bathroom scale",
    "tape_measure": "a yellow measuring tape loosely coiled",
    "towel": "a folded white gym towel",
    # ناس وحركات (من غير وشوش)
    "squat": PERSON + "doing a deep bodyweight squat with arms forward",
    "plank": PERSON + "holding a forearm plank on the floor",
    "running": PERSON + "running mid-stride",
    "pushup": PERSON + "in a push-up position",
    "lunge": PERSON + "doing a forward lunge",
    "deadlift": PERSON + "lifting a barbell in a deadlift",
    "stretch": PERSON + "doing a standing side stretch with one arm overhead",
    "jumping_jack": PERSON + "jumping in the air doing a jumping jack, both feet off the ground, arms raised overhead and legs spread wide in an X shape, front view",
    "biceps_curl": PERSON + "standing and curling a dumbbell",
    "rest": PERSON + "sitting on the floor resting and drinking from a water bottle",
    # رموز
    "stopwatch": "a modern stopwatch, black and orange",
    "heart": "a glossy red 3D heart shape",
    "flame": "a stylized orange and yellow flame shape",
    "arrow_up": "a bold orange 3D arrow pointing up and to the right",
    "trophy": "a shiny gold trophy cup",
    "medal": "a gold medal with an orange ribbon",
    "calendar": "a small desk calendar with one day circled in orange",
    "lightning": "a stylized yellow lightning bolt shape",
    "star": "a glossy gold 3D star",
    "check": "a bold green 3D check mark",
    "target": "a red and white target with a dart in the center",
}
TRIAL = ["dumbbell", "ems_suit", "water_bottle", "squat", "stopwatch"]


def one(key: str, name: str, style: str = "") -> dict:
    m = MODELS[key]
    desc = ITEMS[name].replace(PERSON, PERSON_STYLED) if style else ITEMS[name]
    body = {"model": m["model"], **m["body"]((STYLES[style] if style else STYLE) + desc)}
    t0 = time.time()
    with httpx.Client(timeout=90) as c:
        r = c.post(f"{atlas.BASE_URL}/api/v1/model/generateImage", headers=atlas._headers(), json=body)  # noqa: SLF001
    data = atlas._check(r, "طلب الصورة")  # noqa: SLF001
    pid = (data or {}).get("id") or (data or {}).get("prediction_id")
    pred = atlas.wait_prediction(pid, max_seconds=600, interval=3, what="رسم العنصر")
    url = next(o for o in (pred.get("outputs") or []) if isinstance(o, str) and o.startswith("http"))
    d = OUT / key / style if style else OUT / key
    d.mkdir(parents=True, exist_ok=True)
    raw = d / f"{name}.raw.png"
    raw.write_bytes(httpx.get(url, timeout=120, follow_redirects=True).content)
    firstvid.cutout(raw, d / f"{name}.png")
    raw.unlink()
    cost = next((pred.get(k) for k in ("cost", "price", "credits", "amount", "fee") if pred.get(k) not in (None, "", 0)), None)
    if cost is None:   # أحيانًا السعر بيتأخر في الرد: نسأل تاني
        time.sleep(3)
        p2 = atlas.get_prediction(pid)
        cost = next((p2.get(k) for k in ("cost", "price", "credits", "amount", "fee") if p2.get(k) not in (None, "", 0)), None)
    return {"model": key, "style": style, "name": name, "secs": round(time.time() - t0, 1), "cost": cost, "base": m["base"]}


def run(jobs: list[tuple], style: str = "") -> None:
    log = OUT / "_cost.json"
    rows = json.loads(log.read_text()) if log.exists() else []
    with ThreadPoolExecutor(6) as ex:
        for f, (k, n) in [(ex.submit(one, k, n, style), (k, n)) for k, n in jobs]:
            try:
                row = f.result()
                rows = [x for x in rows if (x["model"], x.get("style", ""), x["name"]) != (k, style, n)] + [row]
                print("✓", k, n, row["secs"], "s", flush=True)
            except Exception as e:  # noqa: BLE001
                print("✗", k, n, str(e)[:300], flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    log.write_text(json.dumps(rows, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    if not atlas.api_key():
        sys.exit("ATLASCLOUD_API_KEY مش موجود")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "trial"
    if cmd == "trial":
        run([(k, n) for k in MODELS for n in TRIAL])
    elif cmd == "trial-only":   # موديل واحد على عناصر التجربة: trial-only <model> [name…]
        run([(sys.argv[2], n) for n in (sys.argv[3:] or TRIAL)])
    elif cmd == "style":   # style <style> <model> [name…] ← بدون أسماء = عناصر التجربة الخمسة بس
        run([(sys.argv[3], n) for n in (sys.argv[4:] or TRIAL)], style=sys.argv[2])
    elif cmd == "gen":
        run([(sys.argv[2], n) for n in (sys.argv[3:] or ITEMS)])
