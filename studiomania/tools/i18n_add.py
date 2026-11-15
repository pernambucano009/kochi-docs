"""يضيف ترجمات جديدة لقاموس الإنجليزي (frontend/i18n-en.js) من ملف JSON {عربي: إنجليزي}، والمفاتيح الموجودة بتفضل زي ما هي.

    python3 tools/i18n_add.py batch.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIC = ROOT / "frontend" / "i18n-en.js"
sys.path.insert(0, str(ROOT / "tools"))
from langmap import en_dict  # noqa: E402

new = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
have = en_dict()
add = {k: v for k, v in new.items() if k not in have and v}
src = DIC.read_text(encoding="utf-8").rstrip()
assert src.endswith("};"), "آخر القاموس مش «};»"
body = src[:-2].rstrip()
if not body.endswith(","):
    body += ","
lines = "".join(f"\n  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}," for k, v in add.items())
DIC.write_text(body + lines + "\n};\n", encoding="utf-8")
en_dict()   # القاموس لسه بيتقري صح
print(f"added {len(add)}, skipped {len(new) - len(add)}")
