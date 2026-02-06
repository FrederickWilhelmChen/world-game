# Grand Strategy Game - 地图模块

## 项目结构

```
E:\world-game/
├── project.godot              # Godot项目配置
├── GrandStrategyGame.csproj   # C#项目文件
├── scenes/
│   └── Main.tscn             # 主场景
└── game/
    ├── src/
    │   ├── Core/
    │   │   ├── Enums.cs      # 枚举定义
    │   │   └── GameManager.cs # 游戏管理器
    │   ├── Map/
    │   │   ├── Province.cs    # 省份类
    │   │   ├── Country.cs     # 国家类
    │   │   ├── MapData.cs     # 地图数据
    │   │   ├── MapGenerator.cs # 地图生成器
    │   │   ├── MapRenderer.cs  # 地图渲染器
    │   │   ├── MapCamera.cs    # 相机控制
    │   │   └── MapInteraction.cs # 地图交互
    │   └── UI/
    │       └── GameUI.cs      # 游戏UI
    └── dev_md/               # 设计文档
        └── *.md
```

## 地图模块功能

### 地图生成
- 使用Perlin/Simplex噪声生成基础地形
- Voronoi图划分500个省份
- 随机生成20个国家，BFS扩张分配省份
- 生成15条河流

### 地形类型
- 平原 (Plains) - 绿色
- 丘陵 (Hills) - 黄绿色
- 山地 (Mountains) - 棕色
- 森林 (Forest) - 深绿色
- 沙漠 (Desert) - 黄色
- 海岸 (Coastal) - 浅绿色
- 海洋 (Ocean) - 蓝色

### 交互功能
- 左键点击选择省份
- 滚轮缩放
- 中键或方向键平移
- UI显示当前日期、选中省份和国家

## 如何运行

1. 确保已安装 Godot 4.3 或更高版本（带.NET支持）
2. 打开 Godot 引擎
3. 点击"导入项目"
4. 选择 `E:\world-game\project.godot`
5. 点击"运行项目"或按 F5

## 地图生成参数

在 `MapGenerator` 节点中可以调整：
- **Seed**: 地图种子（12345为默认值）
- **SeaLevel**: 海平面阈值（-0.3）
- **RiverCount**: 河流数量（15）

## 技术栈

- **引擎**: Godot 4.3+
- **语言**: C# (.NET 8.0)
- **平台**: Windows (导出为.exe)

## 后续开发

地图模块完成后，可以按以下顺序继续：
1. 资源系统 - 在省份上生成资源
2. 人口系统 - 生成POP和人口
3. 市场系统 - 实现经济循环
4. 工业系统 - 建造建筑
5. 科技/战争/外交/内政/事件系统
