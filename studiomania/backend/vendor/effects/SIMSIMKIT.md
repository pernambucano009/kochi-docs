# Video effects (vendored)

Source: https://github.com/mo3tawesome/claude-arabic-effects (commit in SOURCE.txt), an Arabic fork of
https://github.com/Vibha-Ramprakash/claude-video-effects. MIT licence, see LICENSE. Fonts are under their own
OFL / Apache licences (files in fonts/). YuNet face model: MIT (models/NOTICE.md).

Changes for SimsimKit (scripts/fx.py):
- Removed the optional `fx_private.py` loader (it ran `exec()` on a file next to the script).
- The person mask comes from `backend/person.py` (RobustVideoMatting / MediaPipe selfie on ai-edge-litert),
  not the `mediapipe` package, so the MediaPipe selfie_segmenter model is not included.
- ffmpeg path from `FX_FFMPEG`, and no ffprobe needed.

Used by `backend/effects.py`, which picks 15 of the 42 effects and always passes the on-screen text
(the library's default texts are not used).
