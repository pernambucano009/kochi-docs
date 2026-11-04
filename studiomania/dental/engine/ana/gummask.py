"""عزل دقيق بالذكاء الاصطناعي: قناع (السنان العلوية + اللثة العلوية) بنفس أبعاد الصورة، بيتعمل مرة ويتخزن."""
import sys, os, cv2, numpy as np
sys.path.insert(0, '../gen'); from at import run, get, upload
P = ("Convert this dental photo into a precise binary segmentation mask with EXACTLY the same framing and geometry. "
     "Pure white: the UPPER teeth crowns and the UPPER pink gum tissue directly above them (the gingiva band up to where it meets the lip/retractor). "
     "Pure black: everything else - lower teeth, lower gum, tongue, the dark inside of the mouth, the gaps between teeth that show dark background, lips, retractor, skin. "
     "Sharp clean edges, no shading.")
def make(src, out):
    if os.path.exists(out): return out
    im = cv2.imread(src); h, w = im.shape[:2]
    u = run("Image", {"model": "google/nano-banana-pro/edit-developer", "prompt": P, "images": [upload(src)], "aspect_ratio": "3:2", "resolution": "2k"}); get(u, out)
    m = cv2.resize(cv2.imread(out, 0), (w, h), interpolation=cv2.INTER_LINEAR); cv2.imwrite(out, m); return out
if __name__ == "__main__":
    C = "../case1/"
    for s, o in ((C + "before/macro.jpg", "gm_before.png"), (C + "after/front.jpg", "gm_after.png")): print(make(s, o))
