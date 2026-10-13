#!/usr/bin/env bash
# تشغيل StudioMania على http://localhost:8000
set -e
cd "$(dirname "$0")"
pip install -q -r backend/requirements.txt
exec python3 -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port "${PORT:-8000}"
