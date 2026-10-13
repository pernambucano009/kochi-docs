#!/usr/bin/env python3
"""palette-check.py — fail if rendered frames use colours outside the style palette.

usage:
  python palette-check.py <frames_dir | video.mp4 | image.png ...> --palette references/palette.json

palette.json:
  {
    "tolerance": 12,          # max CIE76 delta-E from the nearest palette colour
    "max_off": 0.02,          # max share of (non-edge) pixels allowed off-palette
    "allow_mixes": false,     # true = colours on a straight blend between two palette colours pass
                              #        (needed for gradients, light shafts, transparent overlays)
    "colors": { "background": ["#FCE3CA", ...], "skin": [...], ... }
  }

Anti-aliased edges are ignored automatically (pixels whose 3x3 neighbourhood changes sharply).
Exit code 0 = pass, 1 = fail. Needs: numpy, pillow (and ffmpeg for videos).
"""
import argparse, glob, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image


def hex2rgb(h):
    h = h.lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb2lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def load_frames(inputs, every):
    files = []
    for src in inputs:
        if os.path.isdir(src):
            files += sorted(glob.glob(os.path.join(src, '*.png')) + glob.glob(os.path.join(src, '*.jpg')))
        elif src.lower().endswith(('.mp4', '.mov', '.webm', '.gif')):
            td = tempfile.mkdtemp()
            subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'fps=1/{every}', os.path.join(td, '%05d.png')], check=True)
            files += sorted(glob.glob(os.path.join(td, '*.png')))
        else:
            files.append(src)
    return files


def seg_dist(X, P):
    """min distance from each point in X (n,3) to any segment between palette colours P (k,3)."""
    best = np.full(len(X), np.inf)
    k = len(P)
    for i in range(k):
        A = P[i]; B = P[i + 1:]
        if len(B) == 0: continue
        AB = B - A                                      # (m,3)
        L = (AB ** 2).sum(1) + 1e-9                     # (m,)
        AX = X - A                                      # (n,3)
        tpar = np.clip(AX @ AB.T / L, 0, 1)             # (n,m)
        proj = A + tpar[..., None] * AB[None]           # (n,m,3)
        d = np.sqrt(((X[:, None, :] - proj) ** 2).sum(-1)).min(1)
        best = np.minimum(best, d)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--palette', required=True)
    ap.add_argument('--every', type=float, default=1.0, help='seconds between sampled frames for videos')
    ap.add_argument('--width', type=int, default=270, help='analysis width (downscaled)')
    ap.add_argument('--tolerance', type=float)
    ap.add_argument('--max-off', type=float)
    a = ap.parse_args()

    cfg = json.load(open(a.palette, encoding='utf-8'))
    tol = a.tolerance or cfg.get('tolerance', 12)
    max_off = a.max_off or cfg.get('max_off', 0.02)
    mixes = cfg.get('allow_mixes', False)
    pal_hex = [h for group in cfg['colors'].values() for h in group]
    P = rgb2lab(np.array([hex2rgb(h) for h in pal_hex], float))

    files = load_frames(a.inputs, a.every)
    if not files: print('no frames found'); sys.exit(1)
    total_off = total = 0; offenders = {}
    worst = []
    for f in files:
        im = Image.open(f).convert('RGB')
        h = round(im.height * a.width / im.width)
        im = im.resize((a.width, h), Image.BILINEAR)
        rgb = np.asarray(im, float)
        lab = rgb2lab(rgb)
        # edge mask: max delta to 8-neighbours
        pad = np.pad(lab, ((1, 1), (1, 1), (0, 0)), mode='edge')
        edge = np.zeros(lab.shape[:2])
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == dx == 0: continue
                sh = pad[1 + dy:1 + dy + lab.shape[0], 1 + dx:1 + dx + lab.shape[1]]
                edge = np.maximum(edge, np.sqrt(((sh - lab) ** 2).sum(-1)))
        keep = edge < 18
        X = lab[keep]; Xr = rgb[keep]
        d = np.sqrt(((X[:, None, :] - P[None]) ** 2).sum(-1)).min(1)
        if mixes:
            far = d > tol
            if far.any():
                # sample to keep it fast
                idx = np.where(far)[0]
                d2 = seg_dist(X[idx], P)
                d[idx] = np.minimum(d[idx], d2)
        off = d > tol
        n_off, n = int(off.sum()), int(len(d))
        total_off += n_off; total += n
        worst.append((n_off / max(n, 1), os.path.basename(f)))
        for c in (Xr[off] // 16 * 16 + 8).astype(int):
            key = '#%02X%02X%02X' % tuple(c); offenders[key] = offenders.get(key, 0) + 1
    share = total_off / max(total, 1)
    worst.sort(reverse=True)
    print(f'palette-check: {len(files)} frames, {len(pal_hex)} palette colours, tolerance dE {tol}, mixes {"on" if mixes else "off"}')
    print(f'  off-palette pixels: {share:.2%} (limit {max_off:.2%})')
    print('  worst frames: ' + ', '.join(f'{n} {s:.1%}' for s, n in worst[:5]))
    if offenders:
        top = sorted(offenders.items(), key=lambda kv: -kv[1])[:10]
        print('  top off-palette colours (approx): ' + ', '.join(f'{k}×{v}' for k, v in top))
    ok = share <= max_off
    print('  RESULT: ' + ('PASS' if ok else 'FAIL — replace the off colours with palette colours (see style-bible.md)'))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
