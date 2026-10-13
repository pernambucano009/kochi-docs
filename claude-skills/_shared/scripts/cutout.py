#!/usr/bin/env python3
"""cutout.py — split a generated pose sheet (N poses on a flat background) into transparent PNGs.

usage:
  python cutout.py sheet.png out_dir --n 6 [--name trainer] [--scale 1.4] [--t1 14 --t2 34]

What it does
  1. Reads the flat background colour from the image border (median).
  2. Builds a soft alpha from colour distance to that background (t1 = fully transparent,
     t2 = fully opaque) and removes the background tint from edge pixels (no peach halos).
  3. Drops specks, splits the sheet into N poses by empty columns (small detached bits such as
     clap sparkles join the nearest pose), crops each pose.
  4. Optionally upscales (--scale, Lanczos; flat art upscales cleanly).
  5. Writes <name>_<i>.png plus <name>.json with each pose's size and FOOT ANCHOR
     (bottom-centre of the feet), so poses can be swapped in place without jumping.

The sheet must be: one character, N poses in a row, evenly spaced, on a plain flat background
(ask the image model for "plain flat solid background, no floor, no ground shadows").
Needs numpy + pillow (+ scipy if available, for faster labelling).
"""
import argparse, json, os
import numpy as np
from PIL import Image

try:
    from scipy import ndimage
except Exception:  # tiny fallback labeller
    ndimage = None


def label(mask):
    if ndimage is not None:
        return ndimage.label(mask)
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32); n = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not lab[y, x]:
                n += 1; stack = [(y, x)]; lab[y, x] = n
                while stack:
                    cy, cx = stack.pop()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; stack.append((yy, xx))
    return lab, n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('out')
    ap.add_argument('--n', type=int, required=True, help='number of poses in the row')
    ap.add_argument('--name', default=None)
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--t1', type=float, default=14, help='colour distance below which a pixel is background')
    ap.add_argument('--t2', type=float, default=34, help='colour distance above which a pixel is fully opaque')
    ap.add_argument('--pad', type=int, default=6)
    a = ap.parse_args()
    name = a.name or os.path.splitext(os.path.basename(a.sheet))[0]
    os.makedirs(a.out, exist_ok=True)

    im = np.asarray(Image.open(a.sheet).convert('RGB')).astype(np.float32)
    H, W, _ = im.shape
    border = np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3), im[:, :8].reshape(-1, 3), im[:, -8:].reshape(-1, 3)])
    bg = np.median(border, 0)
    d = np.sqrt(((im - bg) ** 2).sum(-1))
    alpha = np.clip((d - a.t1) / (a.t2 - a.t1), 0, 1)

    solid = alpha > 0.5
    lab, n = label(solid)
    sizes = np.bincount(lab.ravel())
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes[1:] > 60                       # drop specks
    alpha[~keep[lab] & (alpha > 0)] = 0
    # also drop faint pixels far from any kept solid component
    solid = keep[lab]
    if ndimage is not None:
        near = ndimage.binary_dilation(solid, iterations=3)
        alpha[~near] = 0

    # un-mix background colour from semi-transparent edges
    A = alpha[..., None]
    rgb = np.where(A > 0.02, (im - (1 - A) * bg) / np.maximum(A, 0.02), im)
    rgb = np.clip(rgb, 0, 255)

    # split into N poses: columns with content, cut at the emptiest columns between pose centres
    colsum = (alpha > 0.5).sum(0).astype(float)
    xs = np.where(colsum > 0)[0]
    x0, x1 = xs.min(), xs.max()
    step = (x1 - x0) / a.n
    cuts = [x0]
    for i in range(1, a.n):
        c = int(x0 + i * step); lo, hi = int(c - step * 0.35), int(c + step * 0.35)
        win = colsum[lo:hi]
        # prefer the centre of the widest empty run
        z = np.where(win == win.min())[0]
        cuts.append(lo + int(np.median(z)))
    cuts.append(x1 + 1)

    meta = {'sheet': os.path.basename(a.sheet), 'background': '#%02X%02X%02X' % tuple(int(v) for v in bg), 'scale': a.scale, 'poses': []}
    for i in range(a.n):
        cx0, cx1 = cuts[i], cuts[i + 1]
        sub = alpha[:, cx0:cx1]
        ys, xs_ = np.where(sub > 0.05)
        if len(ys) == 0: continue
        bx0, bx1 = max(cx0 + xs_.min() - a.pad, 0), min(cx0 + xs_.max() + a.pad + 1, W)
        by0, by1 = max(ys.min() - a.pad, 0), min(ys.max() + a.pad + 1, H)
        rgba = np.dstack([rgb[by0:by1, bx0:bx1], alpha[by0:by1, bx0:bx1] * 255]).astype(np.uint8)
        # zero out content that belongs to neighbouring poses (outside this pose's column slice)
        rgba[:, : max(cx0 - bx0, 0), 3] = 0; rgba[:, cx1 - bx0:, 3] = 0
        img = Image.fromarray(rgba, 'RGBA')
        # foot anchor: bottom-most solid rows, centre of their x extent
        aa = rgba[..., 3] > 128
        rows = np.where(aa.any(1))[0]; bottom = rows.max()
        band = aa[max(bottom - 12, 0): bottom + 1]
        fx = np.where(band.any(0))[0]
        anchor = [float((fx.min() + fx.max()) / 2), float(bottom)]
        if a.scale != 1:
            img = img.resize((round(img.width * a.scale), round(img.height * a.scale)), Image.LANCZOS)
            anchor = [anchor[0] * a.scale, anchor[1] * a.scale]
        fn = f'{name}_{i + 1}.png'; img.save(os.path.join(a.out, fn))
        meta['poses'].append({'file': fn, 'w': img.width, 'h': img.height, 'anchor': [round(anchor[0], 1), round(anchor[1], 1)]})
    json.dump(meta, open(os.path.join(a.out, f'{name}.json'), 'w'), indent=1)
    print(f'{len(meta["poses"])} poses -> {a.out}  (bg {meta["background"]})')
    for p in meta['poses']: print('  ', p)


if __name__ == '__main__':
    main()
