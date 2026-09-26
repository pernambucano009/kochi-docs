@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul && (set PY=py) || (set PY=python)
%PY% --version >nul 2>nul || (
  echo Python مش متثبت. نزّله من https://www.python.org/downloads/ وعلّم على "Add Python to PATH" وقت التثبيت.
  pause
  exit /b 1
)
echo بيجهّز البرنامج... أول مرة ممكن تاخد دقيقة
%PY% -m pip install -q -r backend\requirements.txt
start "" http://localhost:8000
echo StudioMania شغال على http://localhost:8000 - متقفلش الشباك ده طول ما إنت شغال
%PY% -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8000
pause
