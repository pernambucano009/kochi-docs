"""SAM 2.1 (Meta, Apache-2.0) محلي على CPU عبر ONNX: صورة + مربعات/نقط → أقنعة بنفس دقة الصورة."""
import numpy as np, cv2, onnxruntime as ort, os
D = os.environ.get("SAM21_DIR") or (os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/models/sam21/")
_enc = _dec = None
FILES = ("vision_encoder.onnx", "vision_encoder.onnx_data", "prompt_encoder_mask_decoder.onnx", "prompt_encoder_mask_decoder.onnx_data")
URL = "https://huggingface.co/onnx-community/sam2.1-hiera-large-ONNX/resolve/main/onnx/"
def _fetch():
    """الموديل مش موجود (السيرفر اتبنى من غيره)؟ بيتحمّل مرة واحدة. لو المجلد مش بيتكتب فيه، بيتحط في SAM21_CACHE أو /tmp."""
    global D
    if all(os.path.exists(D + f) for f in FILES): return
    import urllib.request
    for d in (D, os.environ.get("SAM21_CACHE") or "/tmp/sam21/"):
        try:
            os.makedirs(d, exist_ok=True)
            for f in FILES:
                if not os.path.exists(d + f):
                    urllib.request.urlretrieve(URL + f, d + f + ".part"); os.replace(d + f + ".part", d + f)
            D = d; return
        except OSError:
            continue
def _sess():
    global _enc, _dec
    if _enc is None:
        _fetch()
        o = ort.SessionOptions(); o.intra_op_num_threads = 4
        _enc = ort.InferenceSession(D + "vision_encoder.onnx", o, providers=["CPUExecutionProvider"])
        _dec = ort.InferenceSession(D + "prompt_encoder_mask_decoder.onnx", o, providers=["CPUExecutionProvider"])
    return _enc, _dec
def embed(rgb):
    enc, _ = _sess(); H, W = rgb.shape[:2]
    x = cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    e = enc.run(None, {"pixel_values": x.transpose(2, 0, 1)[None].astype(np.float32)})
    return {"e": e, "H": H, "W": W}
def _sc(E, pts): s = np.array([1024 / E["W"], 1024 / E["H"]], np.float32); return np.asarray(pts, np.float32) * s
def masks_from_boxes(E, boxes, best=True):
    """boxes: [[x0,y0,x1,y1],...] بإحداثيات الصورة. بيرجع لستة أقنعة (احتمالات 0..1) بنفس مقاس الصورة."""
    _, dec = _sess(); out = []
    for b in boxes:
        bb = _sc(E, np.array(b, np.float32).reshape(2, 2)).reshape(1, 1, 4)
        r = dec.run(None, {"input_points": np.zeros((1, 1, 1, 2), np.float32), "input_labels": -np.ones((1, 1, 1), np.int64),
                           "input_boxes": bb.astype(np.float32), "image_embeddings.0": E["e"][0], "image_embeddings.1": E["e"][1], "image_embeddings.2": E["e"][2]})
        iou, pm = r[0][0, 0], r[1][0, 0]; k = int(np.argmax(iou)) if best else 0
        m = cv2.resize(pm[k], (1024, 1024), interpolation=cv2.INTER_LINEAR); m = cv2.resize(m, (E["W"], E["H"]), interpolation=cv2.INTER_LINEAR)
        out.append((1 / (1 + np.exp(-m)), float(iou[k])))
    return out
def masks_from_points(E, pos, neg=(), box=None):
    _, dec = _sess()
    P = list(pos) + list(neg); L = [1] * len(pos) + [0] * len(neg)
    pts = _sc(E, P).reshape(1, 1, -1, 2); lab = np.array(L, np.int64).reshape(1, 1, -1)
    feed = {"input_points": pts.astype(np.float32), "input_labels": lab, "image_embeddings.0": E["e"][0], "image_embeddings.1": E["e"][1], "image_embeddings.2": E["e"][2]}
    feed["input_boxes"] = (_sc(E, np.array(box, np.float32).reshape(2, 2)).reshape(1, 1, 4) if box is not None else np.zeros((1, 0, 4), np.float32)).astype(np.float32)
    r = _dec.run(None, feed); iou, pm = r[0][0, 0], r[1][0, 0]; k = int(np.argmax(iou))
    m = cv2.resize(cv2.resize(pm[k], (1024, 1024)), (E["W"], E["H"]))
    return 1 / (1 + np.exp(-m)), float(iou[k])
