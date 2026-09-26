#!/usr/bin/env bash
# ماك: دبل كليك على الملف ده يشغّل StudioMania ويفتحه في المتصفح
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null; then
  echo "Python مش متثبت. نزّله من https://www.python.org/downloads/"
  read -r -p "دوس Enter للخروج"
  exit 1
fi
echo "بيجهّز البرنامج... أول مرة ممكن تاخد دقيقة"
python3 -m pip install -q -r backend/requirements.txt
(sleep 3 && open http://localhost:8000) &
echo "StudioMania شغال على http://localhost:8000 - متقفلش الشباك ده طول ما إنت شغال"
exec python3 -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8000
