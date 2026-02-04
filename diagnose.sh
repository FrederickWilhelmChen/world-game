# 诊断和修复脚本

echo "🔍 开始诊断问题..."
echo ""

# 检查端口占用
PORT_CHECK=$(lsof -i:5000 2>/dev/null | grep LISTEN || netstat -ano | findstr ":5000.*LISTENING" 2>/dev/null || echo "")
if [ ! -z "$PORT_CHECK" ]; then
    echo "⚠️  端口5000已被占用，正在停止旧进程..."
    ps aux | grep "python.*app.py" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
    sleep 2
fi

echo "✅ 端口检查完成"
echo ""

# 启动服务器
echo "🚀 启动服务器..."
cd backend
python app.py > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

sleep 3

echo "✅ 服务器已启动 (PID: $SERVER_PID)"
echo ""

# 测试各个端点
echo "📡 测试API端点..."
echo ""

echo "1. 测试主页..."
curl -s -o /dev/null -w "  状态码: %{http_code}\n" http://localhost:5000/

echo "2. 测试formatters.js..."
curl -s -o /dev/null -w "  状态码: %{http_code}\n" http://localhost:5000/frontend/js/formatters.js

echo "3. 测试data_viz.js..."
curl -s -o /dev/null -w "  状态码: %{http_code}\n" http://localhost:5000/frontend/js/data_viz.js

echo "4. 测试countries_data.json..."
curl -s -o /dev/null -w "  状态码: %{http_code}\n" http://localhost:5000/static/data/countries_data.json

echo ""
echo "📋 服务器日志 (最后10行):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -10 server.log
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ 诊断完成"
echo ""
echo "📖 访问地址: http://localhost:5000"
echo "📝 查看完整日志: tail -f server.log"
echo "🛑 停止服务器: kill $SERVER_PID"
