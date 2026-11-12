# StudioMania على أي سيرفر بيشغّل Docker (السيرفر الحالي على Oracle: deploy/oracle)
# مثبّت على Debian 12 (bookworm): النسخة الجديدة من الصورة (Debian 13) بتكسر تثبيت متصفح Playwright
FROM python:3.12-slim-bookworm

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
# FFmpeg بييجي جاهز مع مكتبة imageio-ffmpeg، فمش محتاجين نثبّته من النظام
RUN pip install --no-cache-dir -r backend/requirements.txt \
 && python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
# متصفح Chromium: بيرسم فيديوهات التايبوجرافي فريم فريم (frontend/typo-engine.js)
RUN python -m playwright install --with-deps chromium
# خط الإيموجي الملوّن (عنصر emoji في التايبوجرافي) + ffmpeg/ffprobe ومكتبات الصور لمحرك قوالب الأسنان
RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-color-emoji ffmpeg libgl1 libegl1 libgles2 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
# 🦷 محرك قوالب الأسنان: نقط الوش وفصل الشخص (MediaPipe). MediaPipe بيسحب OpenCV بواجهة رسومية، فبنرجّع النسخة headless
RUN pip install --no-cache-dir "mediapipe>=0.10.14" \
 && (pip uninstall -y opencv-contrib-python opencv-python || true) \
 && pip install --no-cache-dir --force-reinstall --no-deps opencv-contrib-python-headless \
 && python -c "import ctypes, glob, os, mediapipe, cv2; [ctypes.CDLL(f) for f in glob.glob(os.path.dirname(mediapipe.__file__) + '/tasks/c/*.so')]; print(mediapipe.__version__, cv2.__version__)"
# تفريغ الكلام على السيرفر من غير خدمة برّه (اختياري): LOCAL_STT=1 وقت البناء + STT_LOCAL=1 في المتغيرات
# بيزوّد حوالي 700MB (المكتبة + موديل Whisper small) وبيفرّغ دقيقة الكلام في نص دقيقة تقريبًا على CPU
ARG LOCAL_STT=0
ENV STT_LOCAL_DIR=/opt/whisper
RUN if [ "$LOCAL_STT" = "1" ]; then pip install --no-cache-dir "faster-whisper>=1.0" \
 && python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8', download_root='/opt/whisper')"; fi
# موديل فصل الشخص عن الخلفية (16MB) بيتحمّل وقت البناء عشان أول فيديو مايستناش
ENV PERSON_MODELS=/opt/models
RUN mkdir -p /opt/models && python -c "import urllib.request; urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite', '/opt/models/selfie_multiclass_256x256.tflite'); urllib.request.urlretrieve('https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx', '/opt/models/rvm_mobilenetv3_fp32.onnx')" || true
COPY backend backend
COPY frontend frontend
COPY fonts fonts
COPY library library
# 🦷 محرك قوالب الأسنان (كود + أصول عامة بس، من غير صور مرضى)
COPY dental dental
# 🗺️ خريطة اللغة (لوحة الفحص): أداة الفحص وقايمة الاستثناءات وكود تطبيق الجوال عشان كلامه يتفحص هو كمان
COPY tools tools
COPY tests/i18n tests/i18n
COPY mobile/app mobile/app
COPY mobile/src mobile/src

# الفيديوهات وقاعدة البيانات هنا. لازم يتربط بـ volume عشان متضيعش مع كل تحديث
# (بيتعمل من إعدادات الاستضافة نفسها)
ENV STUDIOMANIA_DATA=/data

EXPOSE 8000
# البوابة (gateway.py) هي اللي بتفتح للناس: الحسابات والدخول، وكل عميل ليه نسخة من البرنامج لوحده (app.py على 127.0.0.1)
# متغيرات اختيارية: ADMIN_EMAIL، PUBLIC_URL، GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET، RESEND_API_KEY أو SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS، MAIL_FROM
CMD ["sh", "-c", "exec uvicorn gateway:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
