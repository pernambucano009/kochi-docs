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
- **Frame 0 is a real picture:** the background, the set and the hero are already visible (the hero can settle or turn,
  but must not spring in from nothing). Text may start entering at frame 0.
- Give every beat duration in frames as well (×12).
- If the video is longer than 15 s, **show the beat sheet to the user and wait for an OK** before building.
- If the brief has no Arabic copy, write short Gulf-friendly Arabic yourself and show it in the beat sheet.

### 2. Build from the template
1. Copy the whole `templates/` folder to a new project folder (e.g. `./kochi-<slug>/`). Keep `lib/` and `fonts/` next to the HTML.
2. Edit `scene.html`:
   - Set `DURATION` and pick a theme (`peach`, `blue`, `teal`) or define a new one **using only palette colours**.
   - Build characters with `buildCharacter(root, colours, { hair: 'short'|'bun'|'hijab', sleeves: 'short'|'long' })`
     and position them with `place(root, x, y, k, facing)`. Pass a different colour object per person (with `hijab`/`hijabShade` for a hijab),
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
**Look at the sheet** (open the PNG) next to 2 or 3 images in `references/examples/`
(if that folder has no images, ask the user for references or compare with `style-bible.md` sections 2–4 instead). Fix anything that is:
off-style (outlines, black, gradients, realistic faces), cluttered (more than 5 floating items, under 35% empty space),
cropped (limbs or text cut off by the frame edge or by the safe area), unreadable (text over busy shapes, under 64 px),
or awkward (crossed arms, props hitting faces, hands meeting over text, near-empty frames during transitions).
Also do the Arabic check from `references/arabic-text.md` on one full-size still (`--times <t> --thumb-w 1080 --cols 1`).

### 4. Palette check
```bash
node scripts/contact-sheet.mjs <project>/scene.html --out <project>/review/sheet-palette.png --every 0.5 --frames-dir <project>/review/frames
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
- Proportions: about 8 heads tall, legs about 52%. Keep the 960-unit rig and scale it with `place(root, x, y, k, facing)`.
  **Mirroring is allowed:** `facing = -1` flips the character to face screen-left (`scale(-k, k)`). Other
  non-uniform scaling is not.
- **Which arm does what.** The face points to the rig's right (+x). The **back arm** (`uarmB`/`farmB`, shade colour, behind the torso)
  is on the side the character faces, so use it for pointing, handing over and high-fives. The front arm (`uarmF`/`farmF`)
  is on the far side, for holding a phone or clipboard, waving outward and curls toward the viewer.
  The sign conventions are in the comment above `pose()` in the template.
- **Reaching a point: use `reach(side, x, y)`** (a two-joint solver, `KM.ik2`). Targets are in the rig's local units
  (hip = 0,0, y down, unmirrored). Convert screen points with `toLocal(...)`. For two characters touching
  (a high-five, handing over a phone), compute ONE shared screen point, convert it into each rig's local space and call `reach`
  for both. For big moves, **animate the target point** with `KM.keys`/`KM.spring` and solve every frame.
  Never blend joint angles between far-apart poses: the in-betweens swing through ugly poses.
  Keep shared touch points below the text block, so arms never cover the copy.
- **Holding props:** append the prop to the forearm group (`R.farmF.g` / `R.farmB.g`) at the hand point
  (`ARM.F.hx, ARM.F.hy`) so it follows the hand. To keep it upright (a phone, a clipboard), counter-rotate it by
  `-(uarm + farm + torso + body)` around the hand point. A dumbbell bar crosses the hand; the plates sit on each side of the fist.
- **Curls:** `farmF` from −10° to about −105° (−140° hits the face) with `snappy`, holding 3 frames at the top. 2 or 3 reps per beat.
- For two or more people, vary the silhouette as well as the colour: hair shape (bun, swoosh, short), trouser width,
  a jacket shape over the torso, height ±5%.
- A **trainer** reads through props and pose: a whistle on a cord, a clipboard or phone, an upright posture,
  a pointing or high-five gesture. A **client** reads through workout props: a dumbbell, a mat, a water bottle.
  Use sporty garments: a tee, joggers, sneakers.
- Women in KOCHI content: modest sportswear by default (long sleeves, long trousers). **Hijab:** use `{ hair: 'hijab' }`, which is built in
  (it also turns on long sleeves). It is drawn as one flat
  shape that covers the hair and neck: a rounded hood path around the head (about 12 units outside the head ellipse) plus a drape
  that ends on the upper chest, with the face left open as an ellipse. Use one garment colour and its shade for the inner fold.
  An abaya is a long A-line shape over the torso and legs, with sneakers showing.
- Faces stay simple: dot eyes, a line mouth. Show emotion through body pose and timing, not facial detail.

## Gym and fitness props (flat recipes)
- **Dumbbell:** a bar `rect` with `rx` = half its height, plus two plates (rounded rects) in ink or an accent colour.
  Make it at least 90 units wide on the 960-unit rig, or it reads as a blob at 1080 px.
- **Whistle:** a small pill (20×12) in an accent colour on a thin cord (two lines in ink, 3 px) hanging from the collar.
- **Clipboard:** a rounded rect (60×80, rx 8) in an accent colour, a white paper rect inset by 6, 3 grey lines, and a small
  ink clip on top. Hold it at the side (it reads badly flat across the chest).
- **Bench:** a pill-shaped top plus two trapezoid legs in a shade colour.
- **Kettlebell:** a circle plus a handle drawn as a thick ring (a path with a hole, `fill-rule="evenodd"`).
- **Phone UI:** a rounded rect (rx 48) in ink, a screen in `#FEFEFE` or a pale tone, pill buttons, a check mark, and counting numbers.
- **Gym backdrop:** a few vertical rounded rects (mirrors or windows) and a rack as pill lines, kept sparse.
  Backdrop shapes must be visibly different from the ground: use the halo or a shadow tone (e.g. `#F4CDAE` or `#FAF2EE` on peach),
  never a tint that differs from the background by less than about 6 ΔE. `palette-check` can't catch invisible shapes, so look at the sheet.

## End card
- The brief wins. If it only asks for the logo, show the logo only. If it doesn't mention a call to action, add a short one
  (e.g. «حمّل التطبيق») only if it fits the brief, and say you added it.
- Layout (9:16): the background or halo colour fills the frame. The wordmark is centred at y ≈ 860, 140–180 px tall, in ink.
  An optional line sits 120 px below it at 44–48 px. Leave one small accent (3 dots, a check) looping gently.
- Wordmark: `<div id="logo" dir="ltr">KOCHI</div>` in Readex Pro 700, positioned absolutely and centred; reveal it with `KM.wipeLine(el, p, false)` (Latin wipes left to right)
  plus a spring scale from 0.9 to 1.
- A wipe into the end card must contrast with what it covers: lead it with an accent or ink circle, then follow with the end-card colour.
  A wipe in the halo colour is invisible over backdrop shapes that use the halo colour.
- Hold it for at least 1.5 s (18 frames). The transition into it must never show an almost empty frame for more than 4 frames:
  start the wordmark entering while the wipe is still finishing.

## Output checklist (all must be true)
- [ ] 12 fps (`r_frame_rate=12/1`, or a container fps with 12 unique poses per second)
- [ ] H.264, yuv420p, faststart, with the right size for the requested ratio
- [ ] The Arabic is joined, right to left, uncut, in Readex Pro, and inside the safe area
- [ ] `palette-check.py` passes on the MP4
- [ ] The final contact sheet comes from the MP4 and you looked at it next to the reference examples
- [ ] There is no copied reference artwork, logo, brand UI or watermark, and every character is original
