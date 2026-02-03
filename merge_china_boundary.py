#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合并中国官方边界数据到世界地图（增强版）
处理步骤：
1. 加载中国官方数据（中国_省.geojson）
2. 使用 shapely 融合所有省界，消除内部省线
3. 加载 world_50m.geojson
4. 替换中国 (CHN) 的几何为融合后的官方数据
5. 从印度 (IND) 裁剪掉与中国重叠的藏南区域
6. 将 Somaliland (SOL) 合并到 Somalia (SOM)
7. 删除 Taiwan (TWN)、Siachen Glacier (KAS) 等争议要素
8. 保存新文件 world_50m_custom.geojson
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Tuple
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union

def load_geojson(filepath: str) -> Dict:
    """加载 GeoJSON 文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_geojson(data: Dict, filepath: str):
    """保存 GeoJSON 文件"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

def find_feature_index(features: List[Dict], predicate) -> int:
    """查找满足条件的 feature 索引"""
    for i, feature in enumerate(features):
        if predicate(feature):
            return i
    return -1

def geojson_to_shapely(geometry: Dict) -> Any:
    """将 GeoJSON geometry 转为 shapely 对象"""
    if not geometry:
        return None
    try:
        return shape(geometry)
    except Exception as e:
        print(f"  转换几何失败: {e}")
        return None

def shapely_to_geojson(geom: Any) -> Dict:
    """将 shapely 对象转为 GeoJSON geometry"""
    if geom is None or geom.is_empty:
        return {'type': 'MultiPolygon', 'coordinates': []}
    return mapping(geom)

def process_world_geojson():
    """主处理函数"""
    
    # 路径
    china_path = 'static/geojson/中国_省.geojson'
    world_path = 'static/geojson/world_50m.geojson'
    output_path = 'static/geojson/world_50m_custom.geojson'
    
    print(f"加载中国官方数据: {china_path}")
    china_data = load_geojson(china_path)
    
    # 只保留 MultiPolygon 类型的要素（过滤掉 MultiLineString）
    china_features = [
        f for f in china_data.get('features', [])
        if f.get('geometry', {}).get('type') == 'MultiPolygon'
    ]
    print(f"找到 {len(china_features)} 个有效省界要素")
    
    # 将省界转为 shapely 对象并融合
    print("融合省界，消除内部边界...")
    china_geoms = []
    for f in china_features:
        g = geojson_to_shapely(f.get('geometry'))
        if g and not g.is_empty:
            china_geoms.append(g)
    
    if not china_geoms:
        print("错误: 没有有效的中国省界几何")
        return False
    
    # 使用 unary_union 融合所有多边形，消除内部边界
    china_merged = unary_union(china_geoms)
    print(f"融合后几何类型: {china_merged.geom_type}")
    print(f"融合完成，消除了内部省界")
    
    # 转回 GeoJSON
    china_geometry = shapely_to_geojson(china_merged)
    
    print(f"\n加载世界地图: {world_path}")
    world_data = load_geojson(world_path)
    features = world_data.get('features', [])
    print(f"原世界地图要素数: {len(features)}")
    
    # ========== 1. 处理中国 ==========
    china_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'CHN' or 
        f.get('properties', {}).get('ISO_A3') == 'CHN'
    )
    
    if china_idx == -1:
        print("错误: 未找到中国 (CHN) 要素")
        return False
    
    print(f"\n1. 处理中国 (索引 {china_idx})")
    china_feature = features[china_idx]
    print(f"   原中国几何类型: {china_feature.get('geometry', {}).get('type')}")
    
    # 替换中国的几何
    features[china_idx]['geometry'] = china_geometry
    print("   [OK] 已替换中国几何为融合后的官方数据（无省界）")
    
    # ========== 2. 处理印度（裁剪藏南重叠区） ==========
    india_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'IND' or 
        f.get('properties', {}).get('ISO_A3') == 'IND'
    )
    
    if india_idx != -1:
        print(f"\n2. 处理印度 (索引 {india_idx}) - 裁剪藏南重叠区")
        india_feature = features[india_idx]
        india_geom = geojson_to_shapely(india_feature.get('geometry'))
        
        if india_geom and not india_geom.is_empty:
            # 计算印度与中国新边界的重叠区
            overlap = india_geom.intersection(china_merged)
            if not overlap.is_empty:
                print(f"   检测到重叠区域: {overlap.geom_type}, 面积: {overlap.area:.6f}")
                # 从印度中减去重叠区
                india_new = india_geom.difference(china_merged)
                if not india_new.is_empty:
                    features[india_idx]['geometry'] = shapely_to_geojson(india_new)
                    print(f"   [OK] 已从印度裁剪重叠区，新几何类型: {india_new.geom_type}")
                else:
                    print("   警告: 裁剪后印度几何为空，保留原几何")
            else:
                print("   未检测到与中国边界的重叠")
    else:
        print("\n2. 未找到印度 (IND) 要素")
    
    # ========== 3. 处理索马里兰（合并到索马里） ==========
    print(f"\n3. 处理 Somaliland - 合并到 Somalia")
    
    somalia_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'SOM' or 
        f.get('properties', {}).get('ISO_A3') == 'SOM'
    )
    
    somaliland_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'SOL' or 
        f.get('properties', {}).get('SOV_A3') == 'SOL'
    )
    
    if somalia_idx != -1 and somaliland_idx != -1:
        print(f"   找到 Somalia (索引 {somalia_idx}) 和 Somaliland (索引 {somaliland_idx})")
        
        # 获取两个几何
        somalia_geom = geojson_to_shapely(features[somalia_idx].get('geometry'))
        somaliland_geom = geojson_to_shapely(features[somaliland_idx].get('geometry'))
        
        if somalia_geom and somaliland_geom:
            # 合并几何
            merged_somalia = unary_union([somalia_geom, somaliland_geom])
            features[somalia_idx]['geometry'] = shapely_to_geojson(merged_somalia)
            print(f"   [OK] 已合并 Somaliland 到 Somalia")
            
            # 删除 Somaliland 要素（注意：如果 somaliland_idx > somalia_idx，删除后索引不变）
            del features[somaliland_idx]
            print(f"   [OK] 已删除 Somaliland 独立要素")
        else:
            print("   错误: 几何转换失败，跳过合并")
    elif somaliland_idx != -1:
        # 只有 Somaliland 没有 Somalia，直接删除
        print(f"   未找到 Somalia，直接删除 Somaliland (索引 {somaliland_idx})")
        del features[somaliland_idx]
        print(f"   [OK] 已删除 Somaliland 要素")
    else:
        print("   未找到 Somaliland 要素")
    
    # ========== 4. 处理科索沃（并入塞尔维亚） ==========
    print(f"\n4. 处理 Kosovo - 并入 Serbia")
    
    serbia_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'SRB' or 
        f.get('properties', {}).get('ISO_A3') == 'SRB'
    )
    
    kosovo_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'KOS' or 
        f.get('properties', {}).get('ADM0_A3') == 'XKX'
    )
    
    if serbia_idx != -1 and kosovo_idx != -1:
        print(f"   找到 Serbia (索引 {serbia_idx}) 和 Kosovo (索引 {kosovo_idx})")
        
        serbia_geom = geojson_to_shapely(features[serbia_idx].get('geometry'))
        kosovo_geom = geojson_to_shapely(features[kosovo_idx].get('geometry'))
        
        if serbia_geom and kosovo_geom:
            merged_serbia = unary_union([serbia_geom, kosovo_geom])
            features[serbia_idx]['geometry'] = shapely_to_geojson(merged_serbia)
            print(f"   [OK] 已合并 Kosovo 到 Serbia")
            
            del features[kosovo_idx]
            print(f"   [OK] 已删除 Kosovo 独立要素")
        else:
            print("   错误: 几何转换失败，跳过合并")
    elif kosovo_idx != -1:
        print(f"   未找到 Serbia，直接删除 Kosovo (索引 {kosovo_idx})")
        del features[kosovo_idx]
        print(f"   [OK] 已删除 Kosovo 要素")
    else:
        print("   未找到 Kosovo 要素")
    
    # ========== 5. 处理北塞浦路斯（并入塞浦路斯） ==========
    print(f"\n5. 处理 N. Cyprus - 并入 Cyprus")
    
    cyprus_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'CYP' or 
        f.get('properties', {}).get('ISO_A3') == 'CYP'
    )
    
    ncyprus_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'CYN' or 
        f.get('properties', {}).get('SOV_A3') == 'CYN'
    )
    
    if cyprus_idx != -1 and ncyprus_idx != -1:
        print(f"   找到 Cyprus (索引 {cyprus_idx}) 和 N. Cyprus (索引 {ncyprus_idx})")
        
        cyprus_geom = geojson_to_shapely(features[cyprus_idx].get('geometry'))
        ncyprus_geom = geojson_to_shapely(features[ncyprus_idx].get('geometry'))
        
        if cyprus_geom and ncyprus_geom:
            merged_cyprus = unary_union([cyprus_geom, ncyprus_geom])
            features[cyprus_idx]['geometry'] = shapely_to_geojson(merged_cyprus)
            print(f"   [OK] 已合并 N. Cyprus 到 Cyprus")
            
            del features[ncyprus_idx]
            print(f"   [OK] 已删除 N. Cyprus 独立要素")
        else:
            print("   错误: 几何转换失败，跳过合并")
    elif ncyprus_idx != -1:
        print(f"   未找到 Cyprus，直接删除 N. Cyprus (索引 {ncyprus_idx})")
        del features[ncyprus_idx]
        print(f"   [OK] 已删除 N. Cyprus 要素")
    else:
        print("   未找到 N. Cyprus 要素")
    
    # ========== 6. 删除其他争议要素 ==========
    print(f"\n6. 删除其他争议要素")
    
    # 删除 Taiwan (TWN)
    taiwan_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'TWN' or 
        f.get('properties', {}).get('ISO_A3') == 'TWN'
    )
    if taiwan_idx != -1:
        del features[taiwan_idx]
        print(f"   [OK] 已删除 Taiwan 要素")
    else:
        print("   未找到 Taiwan 要素")
    
    # 删除 Siachen Glacier (KAS)
    kas_idx = find_feature_index(features, lambda f: 
        f.get('properties', {}).get('ADM0_A3') == 'KAS'
    )
    if kas_idx != -1:
        del features[kas_idx]
        print(f"   [OK] 已删除 Siachen Glacier (KAS) 要素")
    else:
        print("   未找到 Siachen Glacier (KAS) 要素")
    
    print(f"\n处理后世界地图要素数: {len(features)}")
    
    # 保存新文件
    save_geojson(world_data, output_path)
    print(f"\n保存到: {output_path}")
    
    # 统计文件大小
    original_size = Path(world_path).stat().st_size
    new_size = Path(output_path).stat().st_size
    print(f"原文件大小: {original_size / 1024 / 1024:.2f} MB")
    print(f"新文件大小: {new_size / 1024 / 1024:.2f} MB")
    
    return True

if __name__ == '__main__':
    success = process_world_geojson()
    exit(0 if success else 1)
