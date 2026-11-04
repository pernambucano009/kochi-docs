"""قناع السنان بالذكاء الاصطناعي: نطلب خريطة أبيض/أسود بنفس الأبعاد، كل تاج سنة أبيض وبين السنان خط أسود رفيع."""
import sys, cv2
sys.path.insert(0, '../gen'); from at import run, get, upload
P = ("Convert this dental photo into a precise segmentation mask with the EXACT same framing, size and geometry. "
     "Every visible tooth crown becomes solid flat pure white. Everything else (gums, lips, cheeks, retractor, tongue, shadows, background) becomes pure black. "
     "Leave a thin pure black line between every pair of adjacent teeth so each tooth is a separate white shape. No shading, no texture, no outlines, only black and white.")
def one(src, out):
    im = cv2.imread(src); h, w = im.shape[:2]
    url = run("Image", {"model": "google/nano-banana-pro/edit-developer", "prompt": P, "images": [upload(src)], "aspect_ratio": "3:2", "resolution": "2k"})
    get(url, out); m = cv2.resize(cv2.imread(out, 0), (w, h), interpolation=cv2.INTER_NEAREST); cv2.imwrite(out, m)
if __name__ == '__main__': one(sys.argv[1], sys.argv[2])
