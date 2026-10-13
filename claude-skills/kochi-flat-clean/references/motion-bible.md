# kochi-flat-clean: motion bible

## 0. The frame rate rule: 12 fps
KOCHI's house rule is **12 frames per second** for every video.
- `render.mjs` samples the scene at `t = frame / 12` and writes a 12 fps MP4. Every frame is a new pose
  ("on ones at 12"). This is the hand-made, tactile rhythm the owner wants.
- The reference explainers move smoothly at 24 to 30 fps. At 12 fps the same moves look steppy unless
  you design for it. So:
  - **Favour pose-to-pose over drifting.** Strong key poses with fast transitions (3 to 6 frames) and
    holds (6 to 18 frames) read better at 12 fps than slow constant motion.
  - **Limit speed per frame.** Anything big that moves more than about 60 px per frame (at 1080 wide) strobes.
    Make it faster than that (a 2 to 3 frame snap with a smear shape) or slower.
  - **Camera moves must be slow and eased** (a push of 3 to 6% over 3 s or more), or replace them with a cut.
    A medium-speed pan at 12 fps judders. Avoid it.
  - **Loops** (breathing, floating) need a period that lasts a whole number of frames, so they repeat
    cleanly, e.g. 3.0 s = 36 frames.
  - If a platform needs 24 or 30 fps, use `--container-fps 24`. It duplicates frames, so the motion stays at 12.
    Prefer 24 to 30 (an even 2:2 cadence).

## 1. Easing and timing (named curves live in `KM.ease`)
| Use | Curve | Duration at 12 fps |
|---|---|---|
| Element enters (cards, icons, text plates) | `KM.spring` stiffness 180–240, damping 12–15 (one small overshoot) | 0.4–0.6 s (5–7 frames to settle) |
| UI and generic moves | `standard` (0.4, 0, 0.2, 1) | 0.33–0.5 s (4–6 frames) |
| Exits | `accel` (0.4, 0, 1, 1) | 0.25–0.33 s (3–4 frames) |
| Big pops and arm raises | `snappy` (0.7, 0, 0.15, 1) | 0.33–0.42 s |
| Scene wipes, shape transitions | `swoosh` (0.85, 0, 0.15, 1) | 0.5–0.67 s |
| Character idle (breath, sway) | `inOutSine` loops | 3–4 s period |
| Holds after a pose or text line | none | 0.5–1.5 s, longer for text (see arabic-text.md) |

Overshoot is friendly and bouncy but small: spring damping between 12 and 16. Never use an elastic wobble longer than 0.6 s.

## 2. Character acting (with the template rig)
- **Idle:** breathing via `KM.breathe(t, 3.2)` rotates the torso by about ±0.6° and the back arm by 2°.
  The head drifts with `KM.wiggle(t, 0.6, 3)`. Someone always moves a little. Never freeze a character for more than 1 s.
- **Blink:** `KM.blink(t, seed)`. Closed for 2 frames, every 3 to 4 s. Give each character a different seed.
- **Large arm moves** (reaching, pointing, high-fives): move the hand TARGET along an eased path and solve with `reach()` every frame.
  Blending joint angles directly between distant poses gives broken in-betweens.
- **Gestures:** anticipation (1–2 frames the other way), action (3–5 frames, `snappy`), overshoot (the spring),
  hold, then settle. The wave in the template shows all of this: down 6°, up 135°, waves, settle.
- **Head turns:** swap between a front face and a 3/4 face on one frame (the style draws the 3/4 face by shifting
  the features toward the turn side) and add a 2-frame 6° tilt. Don't rotate a flat face as if it were 3D.
- **Walk cycle at 12 fps:** 12 frames per two steps (1 s), or 8 frames for a brisk walk. Keys: contact, down,
  passing, up. The hip bobs 10 to 14 units, arms swing opposite to the legs by ±18°, and the head counter-bobs slightly.
- **Secondary motion:** hair swoosh and bag straps lag the head or body by 1 to 2 frames
  (`value(t - 2/12)`). Sleeves don't flap: this style is tidy.
- **Close-up hands** (phone, laptop) move pose to pose: tap (2 frames down, 2 up), scroll (a 4-frame swipe), and count-up numbers on screen.

## 3. Camera
- Use slow eased pushes (1.00 to 1.05) on the whole `#cam` group, about one per scene.
- Use parallax with 2 or 3 depth layers at most: background shapes move 0.3×, the hero 1×, foreground leaves or cards 1.4×.
  Use it only during transitions.
- Prefer **cuts and match cuts** to moving shots: hands close-up then the wide character, or phone screen then the world inside the phone.

## 4. Transitions (no crossfades)
1. **Halo or circle wipe:** a palette-coloured circle grows from an object (a button, a phone) to cover the frame
   over 5 to 7 frames with `swoosh`, then the next scene appears inside it.
2. **Line-art draw-on:** the next scene first appears as thin ink outlines (stroke 3 px, `stroke-dashoffset` driven by t)
   over 6 to 8 frames, then the flat fills snap in on one frame. This is taken from the reference explainer and is the style's signature move.
3. **Match cut on shape:** the shape of a card, a phone screen or a circle carries over and scales into the next scene.
4. **Slide push:** the whole scene pushes out sideways as the next pushes in, 6 frames, `swoosh`. In RTL videos, push from right to left.
5. **Pop-out:** elements scale to 0 one after another (staggered 1 frame each), then the new ones spring in.

Whatever the transition, never show a nearly empty frame for more than 4 frames (0.33 s). Overlap the next scene's entrance with the end of the wipe.

## 5. Reel tempo (9:16, 10–30 s)
- **Hook in the first 1.5 s:** by frame 18 the viewer has seen the hero and the first words. The first frame isn't empty:
  the background colour and halo are already there at frame 0.
- **One idea per beat:** a beat is 2 to 4 s = 24 to 48 frames. Each beat has one action and one text line.
- **Beat rhythm:** enter (≤ 0.5 s), act (1–2 s), hold to read (≥ 1.2 s + 0.25 s per word), transition (0.5 s).
- **End card:** the KOCHI wordmark plus a call to action, held for at least 1.5 s. Nothing moves except one small loop.
- **Sound cues** (optional): a soft pop when a card enters, a whoosh on transitions, a tick for each count-up step. Keep the music bed light.
