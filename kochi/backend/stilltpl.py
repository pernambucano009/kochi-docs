"""📦 استوديو المنتج (صور ثابتة): صورة استوديو نضيفة، المنتج جوه مشهد، و٤٠ قالب إعلان ثابت.

مستوحى من skills «studio-shot» و«product-visuals» (PYNK) و«ad-generator»: صورة المنتج هي المرجع دايمًا،
والبرومتات المقفولة بتتبعت زي ما هي من غير تعديل (اتجرّبت كده)، والملاحظة بتتضاف جملة واحدة في الآخر.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ADGEN = json.loads((Path(__file__).parent / "adgen_templates.json").read_text(encoding="utf-8"))
ADGEN_BY_N = {t["n"]: t for t in ADGEN}

FORMATS = {"1:1": "1024x1024", "3:4": "1024x1536", "9:16": "1024x1536", "16:9": "1536x1024"}

STUDIO = (
    "The reference image defines every detail of the product. Reproduce it without alteration - every colour, every surface, every text element, "
    "and every proportion must match the reference exactly as photographed. Do not alter any element of the product. Reproduce all text as written: "
    "same spelling, same weight, same position on the product.\n\nLight the product with a single soft overhead source. Even coverage, no hard "
    "shadows.\n\nBackground: {bg} - flat solid colour, no gradient, no texture, nothing bleeding in from the product.\n\nProduct centred and upright "
    "in the frame, with even space around it. No hands, no props, no studio equipment."
)
STUDIO_BGS = {"clean white": "أبيض نضيف", "soft pink": "بينك هادي", "black": "أسود", "warm beige #F5F0E1": "بيج دافي", "light gray": "رمادي فاتح",
              "sage green": "أخضر زيتي فاتح"}

RECREATE = (
    "Use image 1 as the compositional blueprint. Lock in its camera position, perspective, environment, surface material, light direction and "
    "quality, tonal grade, and overall atmosphere exactly as captured. Take the product shown in image 2 and seat it into that scene. Carry over the "
    "product's actual silhouette, surface finish, proportions, and any visible branding without distortion - draw all product detail from image 2, "
    "not from whatever was in the original scene. The rest of the frame is untouched. No added type or overlays."
)
PLACEMENT = (
    "The attached product must appear in the scene with exact photographic fidelity - shape, proportions, surface finish, and all label text and "
    "branding must match precisely. Place it into the scene at the same angle, surface, and position as the original subject. Reproduce all text "
    "as written: same spelling, same weight, same position on the product."
)
PROTECT = "The product's colors, label text, and branding must match the source exactly. Lighting on the product should adapt naturally to the scene."

ANCHOR = ("The provided reference image shows the exact product that must appear in this ad. Do not invent, modify, or substitute this product - "
          "it must look identical to the reference image: shape, label, colors, and packaging.\n\n")


def with_note(prompt: str, note: str) -> str:
    note = (note or "").strip()
    return f"{prompt.rstrip()} {note.rstrip('.')}." if note else prompt


def studio_prompt(bg: str, note: str) -> str:
    return with_note(STUDIO.format(bg=(bg or "clean white").strip()[:80]), note)


def recompose_messages(note: str) -> str:
    """الطبقتين اللي بيتكتبوا من الصورتين (الستايل من المشهد، والكلام اللي على الليبل من صورة المنتج)."""
    return (
        "You get two images: image 1 is a scene reference, image 2 is a product photo. Return JSON only: "
        '{"style": "...", "label": "..."}\n'
        "- style (80-110 words): one dense technical paragraph that recreates the scene of image 1, with the scene's objects, surfaces and details "
        "adapted to suit the product of image 2. Do NOT describe the product's own appearance. Cover lighting (quality, direction, shadow and "
        "highlight behaviour), colour and grade (temperature, saturation, a specific dominant palette - not 'warm' but e.g. 'warm sand with a slight "
        "pink undertone', contrast, grade style), surface and background (exact material, finish, props and their arrangement), composition (camera "
        "angle, product placement, negative space), and mood (five precise adjectives, never generic). Ignore any text or copy in the scene.\n"
        "- label (under 60 words): from image 2 only - every word, number and logo on the label, exact spelling, exact capitalisation, exact position. "
        "Label text only, no colour, shape or finish."
        + (f"\nUser note to respect: {note}" if note else "")
    )


def recompose_prompt(style: str, label: str, note: str) -> str:
    return with_note(" ".join(x for x in (style.strip(), label.strip(), PLACEMENT, PROTECT) if x), note)


def adgen_messages(picks: list[int], brain_txt: str, product: str, brief: str, lang_txt: str, guide: str) -> list[dict]:
    """بيملا خانات القوالب المختارة من ملف العميل (ألوانه وصوته وحقايق المنتج)."""
    tpls = "\n\n".join(f"#{n} ({ADGEN_BY_N[n]['name']}):\n{ADGEN_BY_N[n]['prompt'].split('Create:', 1)[-1].strip()}" for n in picks)
    sys = (
        "إنت كاتب إعلانات ومصمم بيملا قوالب إعلانات ثابتة (صورة واحدة) لبراند العميل.\n"
        "كل قالب فيه خانات بين [أقواس]. استبدل كل خانة بقيمة حقيقية من ملف العميل والفكرة، وسيب باقي الكلام زي ما هو بالظبط.\n"
        f"- كل الكلام اللي هيتكتب على الصورة (العناوين، العروض، الريفيوهات، الأرقام...) بلغة: {lang_txt}. {guide} "
        "وباقي البرومت بالإنجليزي.\n"
        "- الألوان من ألوان البراند (الاسم + الهكس). قاعدة التباين: خلفية فاتحة ← كلام غامق، خلفية غامقة ← كلام أبيض، واكتب لون الكلام صراحة.\n"
        "- الحقايق والمميزات من ملف العميل بس. لو محتاج حاجة مش موجودة (عدد ريفيوهات، نجوم، اسم عميل، أرقام) اخترع قيمة معقولة وحطها في invented.\n"
        "- ممنوع أسامي ناس حقيقيين معروفين أو شعارات براندات تانية أو أسامي مجلات حقيقية (اكتب اسم عام).\n"
        "- ممنوع تسيب أي [خانة] من غير ما تتملا.\n"
        'رجّع JSON بس: {"ads": [{"n": رقم القالب, "prompt": "النص بعد Create: بعد ما اتملا", "copy": ["كل جملة هتتكتب على الصورة"], "invented": ["اللي اخترعته"]}]}')
    return [{"role": "system", "content": sys}, {"role": "user", "content":
            f"ملف العميل:\n{brain_txt or '(مفيش)'}\n\nالمنتج: {product or '-'}\nالفكرة / العرض: {brief or '-'}\n\nالقوالب:\n{tpls}"}]


def adgen_prompt(filled: str, arabic: bool) -> str:
    body = re.sub(r"^\s*Create:\s*", "", filled.strip())
    tail = (" All on-image text is Arabic: right-to-left, correctly spelled, properly connected Arabic letters, clean and fully legible."
            if arabic else "")
    return f"{ANCHOR}Create: {body}{tail}"
