# Arabic on-screen text (RTL) — rules for every KOCHI style skill

KOCHI reels are for Saudi and Gulf viewers. Arabic text must be set and animated correctly.

## Setup
- Put Arabic in an HTML element with `dir="rtl"` and `lang="ar"`, e.g.
  `<div class="headline" dir="rtl" lang="ar">مدربك الشخصي… في جيبك</div>`.
  English or numbers inside it stay as they are. Never reverse the string yourself.
- Use the bundled fonts in `templates/fonts/` (loaded by `fonts.css`). List the faces you use in
  `KM.mount({ fonts: ['800 64px "Readex Pro"', ...] })` so the renderer waits for them.
  `render.mjs` also waits for `document.fonts.ready`. A frame rendered before the font loads
  shows a fallback font: that is a failed render.
- Use HTML text for Arabic, not SVG `<text>` and not text drawn on a canvas letter by letter.
- Line height of 1.35 or more. Arabic has tall ascenders and deep descenders (ي، ج، ع).
  Don't crop them with `overflow:hidden` boxes that are too tight. `KM.splitWords` already pads its masks.
- Do not use `letter-spacing` on Arabic. It breaks the connections between letters.
  Use `font-weight` and size for emphasis. Kashida (ـ) stretching is not allowed.
- Numerals: use Western digits (0-9) for stats and prices unless the brief asks for Arabic-Indic digits (٠-٩).

## Animation
- **Never animate Arabic letter by letter.** Splitting a word into letters breaks the joined
  letter forms (the word falls apart into isolated letters). Animate by **word** or by **line**.
- Word reveal: `KM.revealWords(el, t, t0, {stagger, dur})` raises each word through a mask, rightmost word first.
- Line reveal: `KM.wipeLine(el, p, true)` wipes from right to left, in reading order.
- Scale, fade, slide and mask the whole line or word. Never use a typewriter effect.
- At 12 fps a word needs at least 4 frames (0.33 s) to come in, or it pops. Hold a finished line
  at least 1.2 s plus 0.25 s per word, so it can be read.

## Layout
- 9:16 (1080×1920): the **top 250 px** and **bottom 400 px** are taken by the platform UI.
  Keep every word inside y = 250…1520 and x = 60…1020 (an extra 60 px side margin).
- Right-align Arabic blocks (or centre them). Don't left-align Arabic.
- Max 2 lines per beat, about 12 words. If it doesn't fit, split it into two beats.
- Minimum size for 9:16: 64 px for the main line, 44 px for the secondary line. For 16:9 at 1920×1080: 72 / 48 px.
- Contrast: text on a busy area gets a solid plate in a palette colour. Never use a drop shadow just to make it readable.

## Verify before the full render
1. Render one still of the frame where the text is complete (`contact-sheet.mjs scene.html --times 3.0`).
2. Look at it zoomed in:
   - letters are **joined** (no isolated forms inside a word),
   - words read **right to left** in the order of the brief,
   - nothing is clipped (dots, hamzas, descenders),
   - the font is the intended one, not a fallback serif or sans.
3. Only then run the full render.
