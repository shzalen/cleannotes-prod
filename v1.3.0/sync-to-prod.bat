@echo off
chcp 65001 >nul
cd /d "D:\CleanNotepad\v1.3.0"

echo ============================================
echo   GitHub Pages 构建 + 同步
echo ============================================
echo.

echo [1/3] 构建 GitHub Pages 版本 (base=/cleannotes-prod/)...
call npm run build:gh-pages
if %errorlevel% neq 0 (
    echo ❌ GitHub Pages 构建失败！
    pause
    exit /b %errorlevel%
)
echo.

echo [2/3] 复制到 D:\CleanNotepad-Prod\v1.3.0\...
rd /s /q "D:\CleanNotepad-Prod\v1.3.0" 2>nul
mkdir "D:\CleanNotepad-Prod\v1.3.0" 2>nul
xcopy /e /y "dist\*" "D:\CleanNotepad-Prod\v1.3.0\"
echo ✅ 复制完成
echo.

echo [3/3] 恢复 IIS 本地版本 (base=/)...
call npx vite build
if %errorlevel% neq 0 (
    echo ⚠️ IIS 版本构建失败（本地 dist 可能仍是 GitHub Pages 版本）
    pause
    exit /b %errorlevel%
)
echo.

echo ============================================
echo   ✅ 全部完成！
echo.
echo   IIS 本地: dist\ 已恢复
echo   GitHub Pages: D:\CleanNotepad-Prod\v1.3.0\ 已更新
echo   记得去 prod 目录 git commit + push
echo ============================================
pause
