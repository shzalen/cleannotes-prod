@echo off
:: 清记 (CleanNotes) 启动器
:: 使用 pythonw 无控制台窗口启动 pywebview 桌面应用

cd /d "%~dp0"

:: 优先使用 managed Python 3.13（已安装 pywebview）
set PYTHON="C:\Users\alen.liu.ZURU\.workbuddy\binaries\python\versions\3.13.12\pythonw.exe"
if exist %PYTHON% goto :launch

:: 回退到系统 Python
set PYTHON="pythonw"
where pythonw >nul 2>&1
if %errorlevel%==0 goto :launch

:: 都找不到，尝试 python
set PYTHON="python"
where python >nul 2>&1
if %errorlevel%==0 goto :launch_with_console

echo 错误：未找到 Python，请先安装 Python 3.10+
pause
exit /b 1

:launch
start "" %PYTHON% launcher.py
exit /b 0

:launch_with_console
start "" %PYTHON% launcher.py
exit /b 0
