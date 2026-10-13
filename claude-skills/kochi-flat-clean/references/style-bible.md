# kochi-flat-clean: style bible

The source is folder `01 Flat Clean Vector`: 19 stills and 3 explainer videos (47 frames looked at).
The palette was measured with k-means over all of them (area-weighted for backgrounds,
saturation-filtered for accents). These rules describe the *style*. Never copy a reference
picture, character, logo or brand (the references include stock art and a brand product UI).

## 1. Palette

Every colour you use must come from `references/palette.json`, which `palette-check.py` enforces.
The groups below are the same as in that file.

| Group | Hex | Use |
|---|---|---|
| Background | `#FCE3CA` peach cream (most common in the folder) · `#FAF2EE` warm off-white · `#F7F6FE` cool off-white · `#FEFEFE` white · `#DDECFC` pale blue · `#E9F3F8` mist · `#F7EFE3` sand · `#E4E0F1` pale lavender · `#BBDEF3` sky · `#F4CDAE` peach shadow | Big flat fields, halo circles, floor shadows |
| Skin | `#FBD8C3` · `#F9BA86` · `#F99A7E` (default) · `#EDC397` · `#DC8176` · `#D77B68` (default shade) · `#AA5D5E` · `#7D414D` | A light, mid or deep tone plus the next darker tone as its shade |
| Clothing | `#3338F1` electric blue · `#118EF6` azure · `#F63F47` red · `#FBA919` amber · `#F8CC58` yellow · `#8162E3` violet · `#B680FA` lilac · `#EE7A86` pink · `#4B98AC` teal · `#3CAC71` green · `#205776` deep teal | One strong colour per garment. A cast of 2 to 4 people never shares a top colour |
| Ink | `#192D48` navy (text, eyes, dark trousers) · `#2A2C60` indigo · `#421783` deep violet · `#4E3858` plum · `#15324F` night | Text, hair, trousers, dark UI panels. There is **no pure black** except a few tiny details |
| Shadow | `#C4665E` · `#ACA7D8` · `#87C3E0` · `#3176A3` · `#6665AA` · `#7E599A` | The single darker tone for back limbs, hems and under-objects |

### Shade partners (use exactly these pairs)
| Base | Shade | | Base | Shade |
|---|---|---|---|---|
| skin `#FBD8C3` | `#F9BA86` | | top `#8162E3` | `#421783` |
| skin `#F9BA86` | `#D77B68` | | top `#B680FA` | `#8162E3` |
| skin `#F99A7E` | `#D77B68` | | top `#F63F47` | `#C4665E` |
| skin `#EDC397` | `#D77B68` | | top `#118EF6` | `#3176A3` |
| skin `#DC8176` | `#AA5D5E` | | top `#3338F1` | `#2A2C60` |
| skin `#AA5D5E` | `#7D414D` | | top `#4B98AC` | `#205776` |
| skin `#7D414D` | `#4E3858` | | top `#3CAC71` | `#205776` |
| white `#FEFEFE` | `#DDECFC` (cool) or `#F4CDAE` (warm) | | top `#FBA919` / `#F8CC58` | `#C4665E` |
| navy `#192D48` | `#15324F` | | top `#EE7A86` | `#C4665E` |
| indigo `#2A2C60` | `#192D48` | | lilac/lavender trousers `#ACA7D8` | `#6665AA` |

### Ready-made themes (the folder's three colour worlds)
The template has them as `THEMES` (`?theme=peach|blue|teal`).
- **peach** (default, most typical): peach-cream ground `#FCE3CA`, violet `#8162E3` with deep-violet shade `#421783`, yellow `#F8CC58` / amber `#FBA919`, pink `#EE7A86`, navy ink.
- **blue** (SaaS explainer): cool white `#F7F6FE`, pale-blue halo `#DDECFC`, red `#F63F47`, azure `#118EF6`, amber accents, navy trousers.
- **teal** (outdoor/lifestyle): mist ground `#E9F3F8`, sky `#BBDEF3`, teals `#4B98AC` / `#205776`, electric-blue trousers `#3338F1`, yellow roofs and accents `#F8CC58`.

KOCHI note: the brand has no fixed colours in this skill yet. If the owner gives brand hex codes,
add them to `palette.json` and the theme, and put them in the style bible.

## 2. Shapes and proportions
- **Figure height ≈ 8 to 8.5 heads.** Heads are small. Legs are long, about 52% of the height (hip to sole).
  The torso is a soft trapezoid, and shoulders are about 1.8 head-widths wide.
- **Limbs are tapered, round-ended single shapes** (`seg()` in the template): upper arm 50→42 units,
  forearm 30→24, thigh 74→62, shin 62→56 when the figure is 960 units tall. No elbows or knees drawn, no muscle bumps.
- **Hands are simple mittens** (an ellipse, or a mitten with a thumb). Draw separate fingers only in close-ups
  (hands on a phone or laptop). Close-up hands are big, smooth and skin-coloured, and nails can be a shade tone.
- **Faces:** dot eyes (small vertical ellipses in ink), a tiny curved nose stroke in the skin shade,
  a one-line mouth, no eyebrows or a short dash for them. Heads often turn 3/4 while the body faces front. Glasses are thin rounded frames.
- **Hair** is one solid shape, often with a single big swoosh or bun. Hair is in ink or a deep tone.
- **Outlines: none.** Shapes are flat fills. A few thin *interior* lines in the shade colour are fine
  (sleeve seams, a nose, a pocket) at 3 to 5 px for a 1080-wide frame. Never draw a dark contour around a figure.
- **Corner radius:** UI cards 30 to 40 px, buttons are pills, phones about 48 px. Nothing has a sharp corner except floors and walls.
- **Shoes:** chunky white or coloured sneakers with a separate sole strip.

## 3. Texture and light
- **No texture, no grain, no gradients on figures.** (Grain plus gradient light belongs to `kochi-textured-editorial`.)
- **At most one shadow tone per colour:** back limbs, the hem band, the side of the trousers.
  Shade tones are fixed partner colours from the palette. Never make them with opacity or `filter`.
- **Cast shadows** are flat ellipses under feet (`#F4CDAE` on peach, `#BBDEF3` on blue)
  or flat offset rectangles under UI cards (+10, +12 px).
- **Backdrop light:** one big pale circle (a halo) behind the hero, or soft light-ray wedges in a paler
  version of the background. These are flat shapes.

## 4. Composition
- Lots of negative space: 35 to 55% of the frame is plain background. One hero (or a small group) sits in the centre or on a third.
- The floor is implied by a thin line or a shadow ellipse. There is no horizon in studio shots. Outdoor scenes use
  rounded hills in 3 or 4 flat tones of teal, with flat clouds.
- Floating UI satellites go around the hero: rounded cards with one icon each, charts, chat bubbles, check marks.
  Use 3 to 5 of them and keep them off the face.
- Close-up match cuts: hands with a phone or laptop fill the frame, then cut wide to the full character.
- Small confetti: dots, short pill dashes and plus signs in ink or accent, 5 to 12 px, sparse.
- 9:16 zones: **y 0–250** is platform UI (background only). **y 250–620** is the text block. **y 560–1520** holds the hero and action
  (feet on a floor line at about y 1500). **y 1520–1920** is platform UI too: background and floor colour only, with nothing that needs to be seen.

## 5. Type
- **Readex Pro** (Google Fonts, bundled in `templates/fonts/`) covers Arabic and Latin with
  one geometric, rounded design. That matches this style's clean, friendly UI look.
  - Headline: Readex Pro 700, 80 to 96 px (9:16), in ink `#192D48`.
  - Secondary: Readex Pro 400, 40 to 48 px, in ink2 (`#4E3858` / `#3176A3` / `#205776`).
  - Numbers and stats: Readex Pro 700. Count them up with `Math.round`.
- English-only lines may use the same font. Do not mix in a serif.
- KOCHI wordmark (until a logo file is supplied): "KOCHI" in Readex Pro 700, Latin, ink colour, on its own.
  Animate it as one unit: a spring scale and a mask wipe.

## 6. Do / Don't
**Do**
- Use flat fills, one shade tone, and rounded everything.
- Use small heads, long legs, dot eyes and a calm smile.
- Use pale, airy backgrounds with one saturated garment colour per person.
- Put white UI cards with a flat offset shadow and one icon around the hero.
- Leave negative space and hold a clean composition for a moment.

**Don't**
- Don't draw outlines around figures, use black (`#000`), or use photo textures, grain or gradients on characters.
- Don't use realistic anatomy, detailed faces, eyelashes or nostrils.
- Don't use more than 3 saturated colours in one shot (not counting skin and ink).
- Don't use drop shadows with blur, glows, bevels or 3D lighting.
- Don't put text over a busy area without a plate, or animate Arabic letter by letter.
- Don't copy any reference character, logo, brand UI (e.g. the search-tool laptop screen) or watermark.
