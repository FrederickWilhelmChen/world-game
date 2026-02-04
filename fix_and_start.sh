#!/bin/bash

echo "🔧 自动修复脚本"
echo "================="
echo ""

# 1. 停止所有Python进程
echo "📛 停止旧的服务器进程..."
ps aux | grep "python.*app.py" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
sleep 2
echo "✅ 已清理旧进程"
echo ""

# 2. 清理临时文件
echo "🗑️  清理临时文件..."
rm -f *.log 2>/dev/null
rm -f nohup.out 2>/dev/null
echo "✅ 临时文件已清理"
echo ""

# 3. 验证文件完整性
echo "📋 验证文件完整性..."
FILES=(
    "frontend/js/map.js"
    "frontend/js/data_viz.js"
    "frontend/js/formatters.js"
    "frontend/js/data_loader.js"
    "frontend/js/tooltip.js"
    "frontend/index.html"
    "frontend/css/style.css"
)

ALL_OK=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        SIZE=$(wc -c < "$file")
        if [ $SIZE -gt 0 ]; then
            echo "  ✓ $file (${SIZE} bytes)"
        else
            echo "  ✗ $file 是空文件！"
            ALL_OK=false
        fi
    else
        echo "  ✗ $file 不存在！"
        ALL_OK=false
    fi
done
echo ""

if [ "$ALL_OK" = false ]; then
    echo "❌ 文件检查失败！请检查以上错误。"
    exit 1
fi

# 4. 启动服务器
echo "🚀 启动服务器..."
cd backend
python app.py > ../server_output.log 2>&1 &
SERVER_PID=$!
cd ..

echo "  服务器PID: $SERVER_PID"
sleep 4

# 5. 测试服务器
echo ""
echo "🔍 测试服务器响应..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/)

if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ 主页: HTTP $HTTP_CODE"
else
    echo "  ✗ 主页: HTTP $HTTP_CODE (期望 200)"
    echo ""
    echo "服务器日志:"
    cat server_output.log
    exit 1
fi

# 测试JS文件
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/frontend/js/map.js)
echo "  ✓ map.js: HTTP $HTTP_CODE"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/frontend/js/data_viz.js)
echo "  ✓ data_viz.js: HTTP $HTTP_CODE"

# 6. 显示结果
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 修复完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 访问地址:"
echo "   • 主页: http://localhost:5000"
echo "   • 模块测试: http://localhost:5000/frontend/module_test.html"
echo "   • 简单地图测试: http://localhost:5000/frontend/simple_test.html"
echo ""
echo "🔧 调试信息:"
echo "   • 服务器PID: $SERVER_PID"
echo "   • 日志文件: server_output.log"
echo "   • 停止服务器: kill $SERVER_PID"
echo ""
echo "⚠️  重要提示:"
echo "   如果页面显示不正常,请:"
echo "   1. 按 Ctrl+Shift+R 硬刷新页面"
echo "   2. 或使用无痕模式访问"
echo "   3. 查看浏览器Console (F12) 的错误信息"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
