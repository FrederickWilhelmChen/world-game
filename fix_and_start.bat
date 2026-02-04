@echo off
chcp 65001 >nul
cls

echo 🔧 自动修复脚本
echo =================
echo.

REM 停止Python进程
echo 📛 停止旧的服务器进程...
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 >nul
echo ✅ 已清理旧进程
echo.

REM 清理临时文件  
echo 🗑️  清理临时文件...
del /Q *.log >nul 2>&1
del /Q nohup.out >nul 2>&1
echo ✅ 临时文件已清理
echo.

REM 验证文件
echo 📋 验证文件完整性...
set "ALL_OK=1"

if exist "frontend\js\map.js" (
    echo   ✓ frontend\js\map.js
) else (
    echo   ✗ frontend\js\map.js 不存在！
    set "ALL_OK=0"
)

if exist "frontend\js\data_viz.js" (
    echo   ✓ frontend\js\data_viz.js
) else (
    echo   ✗ frontend\js\data_viz.js 不存在！
    set "ALL_OK=0"
)

if exist "frontend\js\formatters.js" (
    echo   ✓ frontend\js\formatters.js
) else (
    echo   ✗ frontend\js\formatters.js 不存在！
    set "ALL_OK=0"
)

if exist "frontend\index.html" (
    echo   ✓ frontend\index.html
) else (
    echo   ✗ frontend\index.html 不存在！
    set "ALL_OK=0"
)

echo.

if "%ALL_OK%"=="0" (
    echo ❌ 文件检查失败！
    pause
    exit /b 1
)

REM 启动服务器
echo 🚀 启动服务器...
cd backend
start /B python app.py > ..\server_output.log 2>&1
cd ..
timeout /t 4 >nul

REM 测试服务器
echo.
echo 🔍 测试服务器...
curl -s http://localhost:5000/ >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   ✓ 服务器响应正常
) else (
    echo   ✗ 服务器未响应
    echo.
    echo 查看日志:
    type server_output.log
    pause
    exit /b 1
)

REM 显示结果
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ✅ 修复完成！
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📖 访问地址:
echo    • 主页: http://localhost:5000
echo    • 模块测试: http://localhost:5000/frontend/module_test.html  
echo    • 简单地图测试: http://localhost:5000/frontend/simple_test.html
echo.
echo 🔧 调试信息:
echo    • 日志文件: server_output.log
echo    • 停止服务器: taskkill /F /IM python.exe
echo.
echo ⚠️  重要提示:
echo    如果页面显示不正常,请:
echo    1. 按 Ctrl+Shift+R 硬刷新页面
echo    2. 或使用无痕模式访问 (Ctrl+Shift+N)
echo    3. 查看浏览器Console (F12) 的错误信息
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 按任意键打开浏览器...
pause >nul

start http://localhost:5000
