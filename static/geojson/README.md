地图数据说明

当前使用自定义边界数据：`world_50m_custom.geojson`

数据来源：
- 基础数据：Natural Earth 1:50m admin-0 countries
- 中国边界：中国自然资源部官方标准地图数据（中国_省.geojson）

处理方式（使用 shapely 库）：
1. 加载中国官方省界数据
2. 使用 `unary_union` 融合所有省多边形，消除内部省界，生成统一的中国边界
3. 替换原 world_50m.geojson 中的中国边界几何
4. 从印度 (IND) 几何中使用 `difference` 裁剪与中国重叠的藏南区域
5. 将 Somaliland (SOL) 使用 `unary_union` 合并到 Somalia (SOM)
6. 删除 Taiwan (TWN) 独立要素 - 已并入中国
7. 删除 Siachen Glacier (KAS) 争议区要素

结果特征：
- 中国边界：514 个多边形组成的统一 MultiPolygon，无内部省界线条
- 中印边界：藏南区域不再重叠，印度边界已裁剪与中国边界匹配
- 索马里：包含索马里兰地区，无独立空白区域
- 台湾：已并入中国，无独立可点击区域

依赖：
```bash
pip install shapely
```

生成命令：
```bash
python merge_china_boundary.py
```

文件说明：
- `world_50m.geojson` - 原始 Natural Earth 数据（备份）
- `world_50m_custom.geojson` - 处理后的地图数据（实际使用）
- `中国_省.geojson` - 中国官方边界数据源
- `merge_china_boundary.py` - 处理脚本
