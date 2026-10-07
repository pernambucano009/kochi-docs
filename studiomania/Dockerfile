# StudioMania على أي سيرفر بيشغّل Docker (Railway أو Render أو Fly.io أو VPS)
FROM python:3.12-slim

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
# FFmpeg بييجي جاهز مع مكتبة imageio-ffmpeg، فمش محتاجين نثبّته من النظام
RUN pip install --no-cache-dir -r backend/requirements.txt \
 && python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
# متصفح Chromium: بيرسم فيديوهات التايبوجرافي فريم فريم (frontend/typo-engine.js)
RUN python -m playwright install --with-deps chromium
COPY backend backend
COPY frontend frontend
COPY fonts fonts

# الفيديوهات وقاعدة البيانات هنا. لازم يتربط بـ volume عشان متضيعش مع كل تحديث
# (بيتعمل من إعدادات الاستضافة نفسها)
ENV STUDIOMANIA_DATA=/data

EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
