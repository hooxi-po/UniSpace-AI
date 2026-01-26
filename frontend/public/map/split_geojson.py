#!/usr/bin/env python3
"""
GeoJSON 拆分脚本
将 map_all.geojson 按照图层类型拆分为多个独立的 GeoJSON 文件
"""
import json
import sys
from pathlib import Path
from typing import Optional


def classify_feature(feature: dict) -> Optional[str]:
    """
    根据 Feature 的属性分类到对应的图层类型
    
    Args:
        feature: GeoJSON Feature 对象
        
    Returns:
        图层类型名称，如果不需要显示则返回 None
    """
    props = feature.get('properties', {})
    geom_type = feature.get('geometry', {}).get('type', '')
    
    # 跳过 Point 类型的 crossing 等不需要显示的点数据
    if geom_type == 'Point':
        return None
    
    # 水体
    if props.get('natural') == 'water' or props.get('water'):
        return 'water'
    
    # 绿地
    if (props.get('natural') == 'wood' or 
        props.get('landuse') == 'cemetery' or 
        props.get('natural') == 'wetland'):
        return 'green'
    
    # 建筑
    if props.get('building'):
        return 'buildings'
    
    # 道路
    if props.get('highway'):
        return 'roads'
    
    # 其他类型（保留但不分类到特定图层）
    return None


def split_geojson(input_file: str, output_dir: str):
    """
    拆分 GeoJSON 文件
    
    Args:
        input_file: 输入的 GeoJSON 文件路径
        output_dir: 输出目录路径
    """
    input_path = Path(input_file)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        print(f'错误: 输入文件不存在: {input_file}', file=sys.stderr)
        sys.exit(1)
    
    # 创建输出目录
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 读取原始 GeoJSON
    print(f'正在读取: {input_file}')
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 初始化各图层的 Feature 列表
    layers = {
        'water': [],
        'green': [],
        'buildings': [],
        'roads': [],
    }
    
    skipped_count = 0
    
    # 分类所有 Feature
    for feature in data.get('features', []):
        layer_type = classify_feature(feature)
        if layer_type and layer_type in layers:
            layers[layer_type].append(feature)
        else:
            skipped_count += 1
    
    # 写入各图层文件
    total_written = 0
    for layer_type, features in layers.items():
        if features:
            output_file = output_path / f'{layer_type}.geojson'
            layer_data = {
                'type': 'FeatureCollection',
                'features': features
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(layer_data, f, ensure_ascii=False, indent=2)
            
            file_size = output_file.stat().st_size / 1024  # KB
            print(f'✓ {layer_type}.geojson: {len(features)} 个 Feature, {file_size:.1f} KB')
            total_written += len(features)
        else:
            print(f'⚠ {layer_type}.geojson: 无数据，跳过')
    
    print(f'\n拆分完成!')
    print(f'总计写入: {total_written} 个 Feature')
    print(f'跳过: {skipped_count} 个 Feature (主要是 Point 类型)')


if __name__ == '__main__':
    script_dir = Path(__file__).parent
    input_file = script_dir / 'map_all.geojson'
    output_dir = script_dir
    
    split_geojson(str(input_file), str(output_dir))
