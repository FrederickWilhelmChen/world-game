# 地图设计模块

## 模块概述

本模块负责生成欧陆风云4风格的2D俯视虚拟世界地图，包含20个国家、500个省份，涵盖所有主要地形要素。地图采用程序生成方式，确保每次游戏体验的独特性。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用 `TileMap` 或 `Polygon2D` 进行省份绘制
- 使用 `FastNoiseLite` 进行地形噪声生成

### 核心数据结构

#### 1. TerrainType (地形类型枚举)
```csharp
public enum TerrainType
{
    Plains,      // 平原 - 农业基础地形
    Hills,       // 丘陵 - 采矿加成
    Mountains,   // 山地 - 防御加成，移动惩罚
    Forest,      // 森林 - 木材产出，视野限制
    Desert,      // 沙漠 - 发展度惩罚
    Coastal,     // 海岸 - 港口建设，渔业
    River        // 河流 - 贸易路线，穿越惩罚
}
```

#### 2. Province (省份类)
```csharp
public class Province
{
    public int Id { get; set; }                           // 唯一标识符 (0-499)
    public string Name { get; set; }                      // 省份名称
    public TerrainType Terrain { get; set; }             // 主要地形
    public Vector2I[] Cells { get; set; }                // 包含的格子坐标
    public Vector2 Centroid { get; set; }                // 几何中心
    public int CountryId { get; set; }                   // 所属国家ID (-1为无主)
    public int Development { get; set; }                 // 发展度 (1-100)
    public List<int> Neighbors { get; set; }            // 相邻省份ID列表
    public bool IsCoastal { get; set; }                  // 是否沿海
    public bool HasRiver { get; set; }                   // 是否有河流
    public InfrastructureLevel Infrastructure { get; set; } // 基础设施等级
    
    // 资源相关
    public Dictionary<ResourceType, ResourceDeposit> Resources { get; set; }
    
    // 人口相关
    public List<Pop> Population { get; set; }
    
    // 建筑
    public List<Building> Buildings { get; set; }
    
    // 军事
    public Army Garrison { get; set; }
    public float Fortification { get; set; }            // 要塞等级 0-10
}
```

#### 3. Country (国家类)
```csharp
public class Country
{
    public int Id { get; set; }                         // 唯一标识符 (0-19)
    public string Name { get; set; }                    // 国家名称
    public string Adjective { get; set; }              // 国家形容词 (如"法兰西")
    public Color Color { get; set; }                    // 地图颜色
    public int CapitalProvinceId { get; set; }         // 首都省份ID
    public List<int> OwnedProvinces { get; set; }      // 拥有的省份ID列表
    public GovernmentType Government { get; set; }     // 政体类型
    public int Prestige { get; set; }                  // 威望
    public float Stability { get; set; }               // 稳定性 0-100
    
    // 科技
    public List<int> ResearchedTechs { get; set; }
    public Technology CurrentResearch { get; set; }
    public float ResearchProgress { get; set; }
    
    // 资源储备
    public Dictionary<ResourceType, float> ResourceStockpile { get; set; }
    public float Treasury { get; set; }                // 国库
    
    // 军事
    public List<Army> Armies { get; set; }
    public List<Navy> Navies { get; set; }
    public float Manpower { get; set; }                // 可用人力
    
    // 法律
    public Laws CurrentLaws { get; set; }
    
    // 人口统计
    public int TotalPopulation { get; set; }
    public float LiteracyRate { get; set; }           // 识字率
}
```

#### 4. MapData (地图数据管理)
```csharp
public class MapData : Node
{
    public const int MAP_WIDTH = 200;                  // 地图宽度(格子数)
    public const int MAP_HEIGHT = 150;                 // 地图高度(格子数)
    public const int PROVINCE_COUNT = 500;            // 省份总数
    public const int COUNTRY_COUNT = 20;              // 国家总数
    
    public Province[] Provinces { get; set; }
    public Country[] Countries { get; set; }
    public int[,] ProvinceGrid { get; set; }          // 格子到省份的映射
    
    // 生成方法
    public void GenerateMap(int seed);
    public void AssignCountries();
    public void CalculateNeighbors();
    
    // 查询方法
    public Province GetProvinceAt(Vector2I cell);
    public List<Province> GetCountryProvinces(int countryId);
    public bool AreProvincesAdjacent(int provId1, int provId2);
}
```

## 地图生成算法

### 第一阶段：基础地形生成

使用多层噪声生成基础地形：

```csharp
public TerrainType GenerateTerrain(Vector2I pos, int seed)
{
    var noise = new FastNoiseLite();
    noise.Seed = seed;
    
    // 大陆形状 (低频大尺度)
    noise.Frequency = 0.01f;
    float continentNoise = noise.GetNoise2D(pos.X, pos.Y);
    
    // 地形细节 (高频小尺度)
    noise.Frequency = 0.05f;
    float detailNoise = noise.GetNoise2D(pos.X, pos.Y);
    
    // 湿度 (影响森林/沙漠)
    noise.Frequency = 0.03f;
    float moistureNoise = noise.GetNoise2D(pos.X + 1000, pos.Y + 1000);
    
    if (continentNoise < -0.3f)
        return TerrainType.Coastal;  // 海洋/海岸
    
    if (continentNoise > 0.6f && detailNoise > 0.4f)
        return TerrainType.Mountains;
    
    if (detailNoise > 0.2f)
        return TerrainType.Hills;
    
    if (moistureNoise > 0.3f && continentNoise > 0)
        return TerrainType.Forest;
    
    if (moistureNoise < -0.5f && continentNoise > 0)
        return TerrainType.Desert;
    
    return TerrainType.Plains;
}
```

### 第二阶段：河流生成

使用随机游走算法生成河流：

```csharp
public void GenerateRivers(int seed)
{
    var rng = new RandomNumberGenerator();
    rng.Seed = (uint)seed;
    
    int riverCount = 15;
    
    for (int i = 0; i < riverCount; i++)
    {
        // 在山地寻找源头
        Vector2I source = FindMountainSource(rng);
        
        // 向下游走直到海洋
        List<Vector2I> riverPath = new();
        Vector2I current = source;
        
        while (IsInBounds(current) && GetTerrain(current) != TerrainType.Coastal)
        {
            riverPath.Add(current);
            
            // 向海拔最低的方向移动
            Vector2I next = GetLowestNeighbor(current);
            if (next == current) break; // 到达局部最低点
            current = next;
        }
        
        // 标记河流经过的省份
        foreach (var cell in riverPath)
        {
            MarkRiver(cell);
        }
    }
}
```

### 第三阶段：省份划分 (Voronoi图)

```csharp
public void GenerateProvinces(int seed)
{
    var rng = new RandomNumberGenerator();
    rng.Seed = (uint)seed;
    
    // 生成省份中心点
    List<Vector2I> centers = new();
    for (int i = 0; i < PROVINCE_COUNT; i++)
    {
        Vector2I center = new(
            rng.RandiRange(0, MAP_WIDTH - 1),
            rng.RandiRange(0, MAP_HEIGHT - 1)
        );
        centers.Add(center);
        Provinces[i].Centroid = center;
    }
    
    // 为每个格子分配到最近的中心
    for (int x = 0; x < MAP_WIDTH; x++)
    {
        for (int y = 0; y < MAP_HEIGHT; y++)
        {
            Vector2I cell = new(x, y);
            if (GetTerrain(cell) == TerrainType.Coastal) continue;
            
            int nearestProv = FindNearestCenter(cell, centers);
            ProvinceGrid[x, y] = nearestProv;
            Provinces[nearestProv].Cells.Add(cell);
        }
    }
    
    // 移除太小的省份
    ConsolidateSmallProvinces(minSize: 10);
}
```

### 第四阶段：国家分配

```csharp
public void AssignCountries(int seed)
{
    var rng = new RandomNumberGenerator();
    rng.Seed = (uint)seed;
    
    // 选择20个起始省份作为各国首都
    List<int> capitals = SelectCapitalProvinces(rng);
    
    // BFS扩张分配剩余省份
    Queue<(int provinceId, int countryId)> expansionQueue = new();
    bool[] assigned = new bool[PROVINCE_COUNT];
    
    for (int i = 0; i < COUNTRY_COUNT; i++)
    {
        int capital = capitals[i];
        Countries[i].CapitalProvinceId = capital;
        Provinces[capital].CountryId = i;
        Countries[i].OwnedProvinces.Add(capital);
        assigned[capital] = true;
        
        foreach (var neighbor in Provinces[capital].Neighbors)
            expansionQueue.Enqueue((neighbor, i));
    }
    
    // BFS分配
    while (expansionQueue.Count > 0)
    {
        var (provId, countryId) = expansionQueue.Dequeue();
        if (assigned[provId]) continue;
        
        Provinces[provId].CountryId = countryId;
        Countries[countryId].OwnedProvinces.Add(provId);
        assigned[provId] = true;
        
        foreach (var neighbor in Provinces[provId].Neighbors)
        {
            if (!assigned[neighbor])
                expansionQueue.Enqueue((neighbor, countryId));
        }
    }
    
    // 平衡国家大小（可选）
    BalanceCountries();
}
```

### 第五阶段：计算相邻关系

```csharp
public void CalculateNeighbors()
{
    for (int x = 0; x < MAP_WIDTH; x++)
    {
        for (int y = 0; y < MAP_HEIGHT; y++)
        {
            int provId = ProvinceGrid[x, y];
            if (provId < 0) continue;
            
            // 检查4个方向的邻居格子
            Vector2I[] directions = { new(0, 1), new(0, -1), new(1, 0), new(-1, 0) };
            
            foreach (var dir in directions)
            {
                Vector2I neighborCell = new(x + dir.X, y + dir.Y);
                if (!IsInBounds(neighborCell)) continue;
                
                int neighborProvId = ProvinceGrid[neighborCell.X, neighborCell.Y];
                if (neighborProvId != provId && neighborProvId >= 0)
                {
                    if (!Provinces[provId].Neighbors.Contains(neighborProvId))
                        Provinces[provId].Neighbors.Add(neighborProvId);
                }
            }
        }
    }
}
```

## 渲染实现

### Godot场景结构

```
MapScene (Node2D)
├── TerrainLayer (TileMapLayer)        # 基础地形
├── ProvinceBorders (Line2D)           # 省份边界
├── ProvinceFill (Polygon2D/Shader)    # 省份填充色
├── RiverLayer (Line2D)                # 河流
├── UnitLayer (Node2D)                 # 军事单位
└── UILayer (CanvasLayer)              # 地图UI
```

### 省份着色器

```glsl
shader_type canvas_item;

uniform sampler2D province_data;        // 省份ID纹理
uniform sampler2D country_colors;       // 国家颜色表
uniform vec2 map_size;
uniform float zoom_level;

void fragment() {
    vec2 uv = UV;
    float provId = texture(province_data, uv).r * 255.0;
    
    // 获取国家颜色
    vec4 countryColor = texture(country_colors, vec2(provId / 20.0, 0.0));
    
    // 边界检测
    float edge = detectProvinceEdge(uv, province_data);
    
    // 混合颜色和边界
    COLOR = mix(countryColor, vec4(0.2, 0.2, 0.2, 1.0), edge * 0.5);
    
    // 选中高亮
    if (isSelected(provId)) {
        COLOR = mix(COLOR, vec4(1.0, 1.0, 0.8, 1.0), 0.3);
    }
}
```

### 交互系统

```csharp
public partial class MapInteraction : Node2D
{
    [Signal]
    public delegate void ProvinceSelectedEventHandler(int provinceId);
    
    [Signal]
    public delegate void ProvinceHoverEventHandler(int provinceId);
    
    private int hoveredProvince = -1;
    private int selectedProvince = -1;
    
    public override void _Input(InputEvent @event)
    {
        if (@event is InputEventMouseButton mouseButton && mouseButton.Pressed)
        {
            if (mouseButton.ButtonIndex == MouseButton.Left)
            {
                Vector2I cell = GetCellAtMouse();
                int provId = MapData.Instance.GetProvinceAt(cell)?.Id ?? -1;
                
                if (provId != selectedProvince)
                {
                    selectedProvince = provId;
                    EmitSignal(SignalName.ProvinceSelected, provId);
                }
            }
        }
        
        if (@event is InputEventMouseMotion)
        {
            Vector2I cell = GetCellAtMouse();
            int provId = MapData.Instance.GetProvinceAt(cell)?.Id ?? -1;
            
            if (provId != hoveredProvince)
            {
                hoveredProvince = provId;
                EmitSignal(SignalName.ProvinceHover, provId);
            }
        }
    }
    
    private Vector2I GetCellAtMouse()
    {
        Vector2 mousePos = GetGlobalMousePosition();
        return (Vector2I)(mousePos / CELL_SIZE);
    }
}
```

## 性能优化

1. **视锥剔除**: 只渲染屏幕内的省份
2. **LOD系统**: 缩放时切换不同精度的网格
3. **对象池**: 复用省份UI对象
4. **分块加载**: 大地图时按区域加载

## 数据持久化

```csharp
public class MapSaveData
{
    public int Seed { get; set; }
    public List<ProvinceSaveData> Provinces { get; set; }
    public List<CountrySaveData> Countries { get; set; }
    
    public static MapSaveData FromMapData(MapData data) { /* ... */ }
    public static MapData ToMapData(MapSaveData save) { /* ... */ }
}
```

## 配置文件示例

```json
{
  "map_generation": {
    "width": 200,
    "height": 150,
    "province_count": 500,
    "country_count": 20,
    "min_province_size": 10,
    "river_count": 15,
    "sea_level": -0.3
  },
  "terrain_modifiers": {
    "plains": { "movement_cost": 1.0, "combat_width": 1.0 },
    "hills": { "movement_cost": 1.5, "combat_width": 0.8, "defense_bonus": 0.2 },
    "mountains": { "movement_cost": 2.5, "combat_width": 0.5, "defense_bonus": 0.5 },
    "forest": { "movement_cost": 1.3, "combat_width": 0.7 },
    "desert": { "movement_cost": 1.8, "attrition": 0.01 },
    "river": { "crossing_penalty": 0.3 }
  }
}
```

## 依赖关系

- **被依赖**: resource_production, population_system, industrial_system, war_system
- **依赖**: 无（基础模块）

## 测试要点

1. 生成不同seed验证地图多样性
2. 确保所有省份都有邻国
3. 验证国家连通性（没有飞地）
4. 性能测试：500个省份的渲染帧率
5. 边界检测准确性
