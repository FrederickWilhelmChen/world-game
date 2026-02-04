#!/bin/bash

# 世界游戏图鉴 - 数据可视化功能快速启动

echo "🌍 世界游戏图鉴 - 启动中..."
echo ""

# 检查Python环境
if ! command -v python &> /dev/null; then
    echo "❌ 错误: 未找到Python"
    echo "请先安装Python 3.7或更高版本"
    exit 1
fi

echo "✅ Python环境检查通过"

# 检查依赖
echo "📦 检查依赖包..."
cd backend

if ! python -c "import flask" 2>/dev/null; then
    echo "⚠️  Flask未安装，正在安装依赖..."
    pip install -r requirements.txt
fi

echo "✅ 依赖检查完成"
echo ""

# 启动应用
echo "🚀 启动应用服务器..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📊 数据可视化功能已启用"
echo "  🌐 访问地址: http://localhost:5000"
echo ""
echo "  功能说明："
echo "  • GDP、粮食、石油、黄金等8种资源数据可视化"
echo "  • 排名前十国家展示"
echo "  • 交互式柱状图对比"
echo "  • 地图自动着色"
echo "  • 点击排名定位国家"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

python app.py
