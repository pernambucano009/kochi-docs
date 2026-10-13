#!/usr/bin/env bash
# Copy the shared pieces into every kochi-* skill so each skill folder is self-contained.
set -e
cd "$(dirname "$0")/.."
for s in kochi-*/; do
  s=${s%/}
  mkdir -p "$s/scripts" "$s/templates/lib" "$s/references"
  cp _shared/scripts/render.mjs _shared/scripts/contact-sheet.mjs _shared/scripts/palette-check.py "$s/scripts/"
  cp _shared/lib/kochi-motion.js "$s/templates/lib/"
  cp _shared/references/arabic-text.md "$s/references/"
  echo "synced $s"
done
