---
name: kochi-flat-clean
description: Makes animated MP4 videos (12 fps) in the clean corporate flat-vector explainer style — light pastel backgrounds, long-limbed small-headed people, no outlines, flat fills with one shadow tone, floating UI cards — from a short brief, entirely from code (SVG + Playwright + ffmpeg), with Arabic RTL text. Use for "flat vector", "flat illustration", "explainer", "SaaS/app promo", "clean corporate animation", or a KOCHI reel/TikTok/story in a clean, friendly, minimal look. Not for grain/textured mid-century looks (kochi-textured-editorial), heavy-outline cartoons (kochi-outlined-cartoon), 2–3 colour posters (kochi-bold-graphic), faceted 3D (kochi-lowpoly) or painterly film looks (kochi-cinematic-hybrid).
---

# kochi-flat-clean

This skill makes original animated videos in the **flat clean vector** explainer style for KOCHI,
a platform that connects personal trainers with clients in Saudi Arabia and the Gulf.
The default output is a vertical reel (1080×1920, 9:16) with Arabic on-screen text. 16:9 (1920×1080) and 1:1 (1080×1080) also work.

**House rule: 12 frames per second.** Every video is sampled and encoded at 12 fps (12 new poses per second).
Use `--container-fps 24` only if a platform rejects 12 fps. It repeats frames, so the motion stays at 12.

## Files in this skill
| Path | What it is | Read it when |
|---|---|---|
| `references/style-bible.md` | Measured palette, proportions, shapes, composition, type, do/don't | Before designing any frame |
| `references/motion-bible.md` | 12 fps rules, easing, acting, camera, transitions, reel tempo | Before animating |
| `references/arabic-text.md` | RTL setup, word/line animation, safe areas, verification | Before any Arabic text |
| `references/palette.json` | The allowed colours (enforced by `palette-check.py`) | When picking colours |
| `references/examples/` | Downscaled reference images (style only; local, not in git) | To compare your contact sheet |
| `templates/scene.html` | Working 5 s scene: halo, rigged character, UI cards, Arabic line | Starting point for every video |
| `templates/lib/kochi-motion.js` | Time-pure helpers: easing, springs, keys, seeded noise, blink, word reveal, mount/player | Reference while coding |
| `templates/fonts/` | Readex Pro (Arabic + Latin), local copy | Loaded by `fonts.css` |
| `scripts/render.mjs` | HTML → MP4 at 12 fps (H.264, yuv420p, faststart, optional −14 LUFS audio) | To render |
| `scripts/contact-sheet.mjs` | N frames → one PNG, from the HTML or from the MP4 | To review |
| `scripts/palette-check.py` | Fails if frames use colours outside the palette | After every render |

Requirements: Node 18+, `playwright` with Chromium (`npm i -g playwright && npx playwright install chromium`),
`ffmpeg` on PATH, Python 3 with `numpy` and `pillow`. On Windows use `python` instead of `python3`.

## Core loop (do every step, in order)

### 1. Brief → beat sheet
Turn the request into a table before you build anything:

| Time | What we see | On-screen text (AR / EN) | Motion | Sound cue |
|---|---|---|---|---|
| 0.0–1.5 s | Hook: hero on a halo, the first words | «…» | hero springs in, words rise | pop |

- Each beat is 2 to 4 s, with one idea per beat. The hook comes within the first 1.5 s. The end card holds at least 1.5 s.
- Give every beat duration in frames as well (×12).
- If the video is longer than 15 s, **show the beat sheet to the user and wait for an OK** before building.
- If the brief has no Arabic copy, write short Gulf-friendly Arabic yourself and show it in the beat sheet.

### 2. Build from the template
1. Copy the whole `templates/` folder to a new project folder (e.g. `./kochi-<slug>/`). Keep `lib/` and `fonts/` next to the HTML.
2. Edit `scene.html`:
   - Set `DURATION` and pick a theme (`peach`, `blue`, `teal`) or define a new one **using only palette colours**.
   - Build characters with `buildCharacter(root, colours)`. Pass a different colour object per person,
     with different top colours, skin tones and hair shapes. Add props (dumbbell, phone, mat, bench) as flat shapes
     built from `seg()`, `rect` with big `rx`, and simple paths.
   - Organise beats as functions of `t` inside `render(t)`. Use `KM.keys`, `KM.tween`, `KM.spring` and `KM.progress` for every value.
3. Hard rules for the code:
   - **Every frame is a pure function of `t`.** No CSS transitions or animations, no `setTimeout`/`setInterval`,
     no `Math.random` (use `KM.rng(seed)`), no `Date.now()`, no state carried between frames.
   - Everything is SVG except Arabic and English copy, which are HTML text elements with `dir="rtl" lang="ar"`.
   - Animate Arabic **by word or by line** (`KM.revealWords`, `KM.wipeLine`), never by letter.
   - List the font faces you use in `KM.mount({ fonts: [...] })`.
   - Keep the 9:16 safe area: nothing important in the top 250 px or the bottom 400 px.
4. Preview: open the HTML in a browser. It plays at 12 fps, and you can scrub with the bar, press space to pause, and use the arrow keys to step frames.

### 3. Contact sheet first
```bash
node scripts/contact-sheet.mjs <project>/scene.html --out <project>/review/sheet.png --every 1
```
**Look at the sheet** (open the PNG) next to 2 or 3 images in `references/examples/`. Fix anything that is:
off-style (outlines, black, gradients, realistic faces), cluttered (more than 5 floating items, under 35% empty space),
cropped (limbs or text cut off by the frame edge or by the safe area), or unreadable (text over busy shapes, under 64 px).
Also do the Arabic check from `references/arabic-text.md` on one full-size still (`--times <t> --thumb-w 1080 --cols 1`).

### 4. Palette check
```bash
node scripts/contact-sheet.mjs <project>/scene.html --out <project>/review/sheet.png --every 0.5 --frames-dir <project>/review/frames
python3 scripts/palette-check.py <project>/review/frames --palette references/palette.json
```
It must print `PASS`. If it fails, replace the reported colours with their nearest palette colours. Don't widen the palette to make it pass.

### 5. Full render at 12 fps
```bash
node scripts/render.mjs <project>/scene.html --out <project>/out/<slug>.mp4
# options: --w 1920 --h 1080 (16:9) | --w 1080 --h 1080 (1:1) | --audio bed.wav (normalised to -14 LUFS) | --container-fps 24
```
The output is H.264, yuv420p, `+faststart`, and `r_frame_rate=12/1`.
Verify it with `ffprobe -v error -show_entries stream=r_frame_rate,nb_frames -of csv=p=0 <file>`
(the frame count must equal duration × 12, or × the container fps if you used one).

### 6. Final check on the encoded file
```bash
node scripts/contact-sheet.mjs <project>/out/<slug>.mp4 --out <project>/review/final-sheet.png --every 1
python3 scripts/palette-check.py <project>/out/<slug>.mp4 --palette references/palette.json
```
Look at the final sheet made **from the MP4**, not the HTML, before you say it's done. Report the file path, its
duration, frame count and fps, and anything you knowingly left imperfect.

## Building characters well (most common failure points)
- Proportions: about 8 heads tall, legs about 52%. Keep the 960-unit rig and scale it with `scale(k)`. Don't stretch it with non-uniform scaling.
- For two or more people, vary the silhouette as well as the colour: hair shape (bun, swoosh, short), trouser width,
  a jacket shape over the torso, height ±5%.
- A **trainer** reads through props and pose: a whistle on a cord, a clipboard or phone, an upright posture,
  a pointing or high-five gesture. A **client** reads through workout props: a dumbbell, a mat, a water bottle.
  Use sporty garments: a tee, joggers, sneakers.
- Women in KOCHI content: modest sportswear (long sleeves, long trousers). Hijab or abaya options are welcome and
  are drawn as one flat shape with one shade tone, like any other garment.
- Seated, bent or lifting poses: rotate `thighF`/`shinF` and `uarmF`/`farmF` (the joints are nested).
  For a dumbbell curl, rotate `farmF` between −10° and −140° with `snappy`, holding at the top for 3 frames.
- Faces stay simple: dot eyes, a line mouth. Show emotion through body pose and timing, not facial detail.

## Gym and fitness props (flat recipes)
- **Dumbbell:** a bar `rect` with `rx` = half its height, plus two plates (rounded rects) in ink or an accent colour.
- **Bench:** a pill-shaped top plus two trapezoid legs in a shade colour.
- **Kettlebell:** a circle plus a handle drawn as a thick ring (a path with a hole, `fill-rule="evenodd"`).
- **Phone UI:** a rounded rect (rx 48) in ink, a screen in `#FEFEFE` or a pale tone, pill buttons, a check mark, and counting numbers.
- **Gym backdrop:** a few vertical rounded rects (mirrors or windows) in a background tint, a rack as pill lines.
  Keep it sparse: this style does not draw full detailed rooms.

## Output checklist (all must be true)
- [ ] 12 fps (`r_frame_rate=12/1`, or a container fps with 12 unique poses per second)
- [ ] H.264, yuv420p, faststart, with the right size for the requested ratio
- [ ] The Arabic is joined, right to left, uncut, in Readex Pro, and inside the safe area
- [ ] `palette-check.py` passes on the MP4
- [ ] The final contact sheet comes from the MP4 and you looked at it next to the reference examples
- [ ] There is no copied reference artwork, logo, brand UI or watermark, and every character is original
