"""قراءة ملفات Excel (xlsx) و CSV من غير مكتبات زيادة، ولينكات حسابات السوشيال."""

import csv
import io
import re
import zipfile
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _col_index(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_xlsx(data: bytes) -> list[list[str]]:
    """أول شيت في الملف كصفوف من النصوص."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
        # أول شيت حسب ترتيب الملف
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        first = wb.find("m:sheets/m:sheet", NS)
        path = "xl/worksheets/sheet1.xml"
        if first is not None and "xl/_rels/workbook.xml.rels" in z.namelist():
            rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
            rid = first.get(REL_NS)
            for r in rels:
                if r.get("Id") == rid:
                    target = r.get("Target", "").lstrip("/")
                    path = target if target.startswith("xl/") else f"xl/{target}"
        sheet = ET.fromstring(z.read(path))
    rows = []
    for row in sheet.iter(f"{{{NS['m']}}}row"):
        cells: dict[int, str] = {}
        for c in row.findall("m:c", NS):
            kind = c.get("t")
            if kind == "inlineStr":
                value = "".join(t.text or "" for t in c.iter(f"{{{NS['m']}}}t"))
            else:
                v = c.find("m:v", NS)
                value = v.text if v is not None and v.text else ""
                if kind == "s" and value:
                    value = shared[int(value)]
            cells[_col_index(c.get("r", "A"))] = value
        if cells:
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
    return rows


def read_table(filename: str, data: bytes) -> list[list[str]]:
    if filename.lower().endswith((".xlsx", ".xlsm")):
        return read_xlsx(data)
    text = data.decode("utf-8-sig", errors="replace")
    return [row for row in csv.reader(io.StringIO(text))]


# ---------------------------------------------------------------- الحسابات

HANDLE_RE = re.compile(r"^[A-Za-z0-9._]{1,30}$")


def clean_handle(value: str | None, site: str) -> str | None:
    """اسم الحساب من أي شكل: لينك كامل أو @اسم أو اسم بس. لو مش اسم صالح بيرجّع None."""
    v = (value or "").strip()
    if not v:
        return None
    m = re.search(rf"{site}\.com/@?([^/?#\s]+)", v, re.I)
    if m:
        v = m.group(1)
    v = v.lstrip("@").strip().rstrip("/")
    # النقط ورا بعض أو في الأول والآخر مش مسموحة في أسماء الحسابات
    if not HANDLE_RE.match(v) or ".." in v or v.startswith(".") or v.endswith("."):
        return None
    return v.lower()


def norm_name(s: str) -> str:
    """الاسم بشكل واحد عشان نقارن: من غير تشكيل ومسافات زيادة، والهمزات والتاء المربوطة واحد."""
    s = re.sub(r"[ً-ْـ]", "", (s or "").strip().lower())
    s = re.sub("[إأآا]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    s = re.sub(r"^(الكوتش|كوتش|الكابتن|كابتن|coach|captain)\s+", "", s)
    return re.sub(r"\s+", " ", s)
