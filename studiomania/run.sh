#!/usr/bin/env bash
# تشغيل StudioMania على http://localhost:8000
set -e
cd "$(dirname "$0")"
pip install -q -r backend/requirements.txt
exec python3 -m uvicorn app:app --app-dir backend --host 0.0.0.0 --port "${PORT:-8000}"
