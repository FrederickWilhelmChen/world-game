# 资源产出模块

## 模块概述

本模块负责管理游戏中的9种资源：粮食、木材、铁矿、煤矿、石油、铜矿、铝矿、贵重金属、渔场。资源在地图上随机分布，受地形影响，通过建筑和人口进行开采/生产。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用 `Resource` 基类管理资源数据
- 使用 `Dictionary<ResourceType, ResourceDeposit>` 存储省份资源

### 核心数据结构

#### 1. ResourceType (资源类型枚举)
```csharp
public enum ResourceType
{
    Grain,           // 粮食 - 基础生存需求
    Wood,            // 木材 - 建筑、造船
    IronOre,         // 铁矿 - 钢铁生产
    Coal,            // 煤矿 - 工业燃料
    Oil,             // 石油 - 后期工业、海军
    CopperOre,       // 铜矿 - 电气工业
    Bauxite,         // 铝矿 - 航空工业（后期）
    PreciousMetal,   // 贵重金属 - 高价值贸易
    Fish             // 渔场 - 沿海省份专属
}
```

#### 2. ResourceDefinition (资源定义)
```csharp
public class ResourceDefinition
{
    public ResourceType Type { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public float BasePrice { get; set; }           // 市场基准价格
    public float Weight { get; set; }              // 重量（运输成本计算）
    public bool IsRenewable { get; set; }          // 是否可再生
    public bool IsDepletable { get; set; }         // 是否可枯竭
    public float DepletionRate { get; set; }       // 枯竭速度
    
    // 地形偏好 (每种地形发现的概率权重)
    public Dictionary<TerrainType, float> TerrainAffinity { get; set; }
    
    // 可生成建筑类型
    public List<BuildingType> ProducingBuildings { get; set; }
    
    // 最小/最大储量
    public int MinDepositSize { get; set; }
    public int MaxDepositSize { get; set; }
}
```

#### 3. ResourceDeposit (资源矿藏)
```csharp
public class ResourceDeposit
{
    public ResourceType Type { get; set; }
    public float TotalAmount { get; set; }         // 总储量
    public float RemainingAmount { get; set; }     // 剩余储量
    public float Accessibility { get; set; }       // 可开采度 0-1
    public QualityLevel Quality { get; set; }      // 矿藏品质
    public bool IsDiscovered { get; set; }         // 是否已发现
    public int DiscoveryYear { get; set; }         // 发现年份（历史事件用）
    
    // 当前开采状态
    public float CurrentProduction { get; set; }   // 当前产量/天
    public float ExtractionEfficiency { get; set; } // 开采效率
    
    // 开采
    public float Extract(float amount)
    {
        if (!IsDiscovered) return 0;
        
        float actualExtraction = Math.Min(amount, RemainingAmount);
        RemainingAmount -= actualExtraction;
        
        // 枯竭度检查
        if (IsDepletable && RemainingAmount <= 0)
        {
            TriggerResourceDepletedEvent();
        }
        
        return actualExtraction;
    }
    
    // 发现矿藏（科技或勘探触发）
    public void Discover()
    {
        IsDiscovered = true;
        DiscoveryYear = GameManager.Instance.CurrentDate.Year;
    }
}

public enum QualityLevel
{
    Poor,       // 贫瘠 - 产出-30%
    Normal,     // 普通
    Rich,       // 丰富 - 产出+30%
    Excellent   // 极品 - 产出+60%
}
```

#### 4. ResourceProductionManager (资源管理器)
```csharp
public partial class ResourceProductionManager : Node
{
    public static ResourceProductionManager Instance { get; private set; }
    
    // 资源定义表
    public Dictionary<ResourceType, ResourceDefinition> ResourceDefinitions { get; private set; }
    
    // 全局资源统计
    public Dictionary<ResourceType, float> GlobalProduction { get; private set; }
    public Dictionary<ResourceType, float> GlobalConsumption { get; private set; }
    
    public override void _Ready()
    {
        Instance = this;
        LoadResourceDefinitions();
    }
    
    // 生成地图资源分布
    public void GenerateResourceDistribution(int seed)
    {
        var rng = new RandomNumberGenerator();
        rng.Seed = (uint)seed;
        
        foreach (var province in MapData.Instance.Provinces)
        {
            GenerateProvinceResources(province, rng);
        }
    }
    
    // 生成省份资源
    private void GenerateProvinceResources(Province province, RandomNumberGenerator rng)
    {
        province.Resources = new Dictionary<ResourceType, ResourceDeposit>();
        
        // 根据地形决定可能的资源
        var possibleResources = GetResourcesForTerrain(province.Terrain);
        
        // 每个省份1-3种资源
        int resourceCount = rng.RandiRange(1, 3);
        
        for (int i = 0; i < resourceCount && possibleResources.Count > 0; i++)
        {
            var resourceType = possibleResources[rng.RandiRange(0, possibleResources.Count - 1)];
            possibleResources.Remove(resourceType);
            
            var definition = ResourceDefinitions[resourceType];
            
            // 生成矿藏
            var deposit = new ResourceDeposit
            {
                Type = resourceType,
                TotalAmount = rng.RandfRange(definition.MinDepositSize, definition.MaxDepositSize),
                RemainingAmount = 0, // 初始未开采
                Accessibility = rng.RandfRange(0.3f, 1.0f),
                Quality = RollQuality(rng),
                IsDiscovered = resourceType != ResourceType.Oil, // 石油需要科技发现
                ExtractionEfficiency = 0.5f
            };
            deposit.RemainingAmount = deposit.TotalAmount;
            
            province.Resources[resourceType] = deposit;
        }
        
        // 沿海省份可能生成渔场
        if (province.IsCoastal && rng.Randf() < 0.6f)
        {
            province.Resources[ResourceType.Fish] = new ResourceDeposit
            {
                Type = ResourceType.Fish,
                TotalAmount = -1, // 无限
                RemainingAmount = -1,
                IsRenewable = true,
                IsDiscovered = true,
                Quality = RollQuality(rng),
                Accessibility = rng.RandfRange(0.5f, 1.0f)
            };
        }
    }
    
    // 每日资源生产计算
    public void CalculateDailyProduction()
    {
        GlobalProduction.Clear();
        
        foreach (var country in MapData.Instance.Countries)
        {
            CalculateCountryProduction(country);
        }
    }
    
    private void CalculateCountryProduction(Country country)
    {
        var production = new Dictionary<ResourceType, float>();
        
        foreach (var provId in country.OwnedProvinces)
        {
            var province = MapData.Instance.Provinces[provId];
            
            foreach (var building in province.Buildings)
            {
                if (building is IResourceProducer producer)
                {
                    var output = producer.Produce();
                    
                    foreach (var (resource, amount) in output)
                    {
                        if (!production.ContainsKey(resource))
                            production[resource] = 0;
                        production[resource] += amount;
                    }
                }
            }
        }
        
        // 更新全球市场
        foreach (var (resource, amount) in production)
        {
            if (!GlobalProduction.ContainsKey(resource))
                GlobalProduction[resource] = 0;
            GlobalProduction[resource] += amount;
        }
    }
}
```

## 资源配置表

```csharp
public static class ResourceConfig
{
    public static readonly Dictionary<ResourceType, ResourceDefinition> Definitions = new()
    {
        [ResourceType.Grain] = new ResourceDefinition
        {
            Type = ResourceType.Grain,
            Name = "粮食",
            BasePrice = 1.0f,
            Weight = 1.0f,
            IsRenewable = true,
            IsDepletable = false,
            TerrainAffinity = new()
            {
                [TerrainType.Plains] = 1.0f,
                [TerrainType.Hills] = 0.5f,
                [TerrainType.Forest] = 0.3f,
                [TerrainType.Desert] = 0.1f
            },
            ProducingBuildings = new() { BuildingType.Farm },
            MinDepositSize = 1000,
            MaxDepositSize = 5000
        },
        
        [ResourceType.Wood] = new ResourceDefinition
        {
            Type = ResourceType.Wood,
            Name = "木材",
            BasePrice = 2.0f,
            Weight = 2.0f,
            IsRenewable = true,
            IsDepletable = false,
            TerrainAffinity = new()
            {
                [TerrainType.Forest] = 1.0f,
                [TerrainType.Hills] = 0.6f,
                [TerrainType.Plains] = 0.2f
            },
            ProducingBuildings = new() { BuildingType.LoggingCamp },
            MinDepositSize = 800,
            MaxDepositSize = 3000
        },
        
        [ResourceType.IronOre] = new ResourceDefinition
        {
            Type = ResourceType.IronOre,
            Name = "铁矿",
            BasePrice = 4.0f,
            Weight = 4.0f,
            IsRenewable = false,
            IsDepletable = true,
            DepletionRate = 0.001f,
            TerrainAffinity = new()
            {
                [TerrainType.Hills] = 0.8f,
                [TerrainType.Mountains] = 1.0f,
                [TerrainType.Plains] = 0.2f
            },
            ProducingBuildings = new() { BuildingType.IronMine },
            MinDepositSize = 500,
            MaxDepositSize = 2000
        },
        
        [ResourceType.Coal] = new ResourceDefinition
        {
            Type = ResourceType.Coal,
            Name = "煤矿",
            BasePrice = 3.0f,
            Weight = 3.0f,
            IsRenewable = false,
            IsDepletable = true,
            DepletionRate = 0.0008f,
            TerrainAffinity = new()
            {
                [TerrainType.Hills] = 0.9f,
                [TerrainType.Mountains] = 0.7f,
                [TerrainType.Plains] = 0.3f
            },
            ProducingBuildings = new() { BuildingType.CoalMine },
            MinDepositSize = 600,
            MaxDepositSize = 2500
        },
        
        [ResourceType.Oil] = new ResourceDefinition
        {
            Type = ResourceType.Oil,
            Name = "石油",
            BasePrice = 8.0f,
            Weight = 2.5f,
            IsRenewable = false,
            IsDepletable = true,
            DepletionRate = 0.002f,
            TerrainAffinity = new()
            {
                [TerrainType.Desert] = 0.8f,
                [TerrainType.Plains] = 0.5f,
                [TerrainType.Hills] = 0.4f
            },
            ProducingBuildings = new() { BuildingType.OilRig },
            MinDepositSize = 200,
            MaxDepositSize = 1000
        },
        
        [ResourceType.CopperOre] = new ResourceDefinition
        {
            Type = ResourceType.CopperOre,
            Name = "铜矿",
            BasePrice = 5.0f,
            Weight = 4.0f,
            IsRenewable = false,
            IsDepletable = true,
            DepletionRate = 0.001f,
            TerrainAffinity = new()
            {
                [TerrainType.Mountains] = 0.9f,
                [TerrainType.Hills] = 0.7f
            },
            ProducingBuildings = new() { BuildingType.CopperMine },
            MinDepositSize = 300,
            MaxDepositSize = 1200
        },
        
        [ResourceType.Bauxite] = new ResourceDefinition
        {
            Type = ResourceType.Bauxite,
            Name = "铝矿",
            BasePrice = 4.5f,
            Weight = 3.5f,
            IsRenewable = false,
            IsDepletable = true,
            DepletionRate = 0.0012f,
            TerrainAffinity = new()
            {
                [TerrainType.Hills] = 0.8f,
                [TerrainType.Mountains] = 0.6f
            },
            ProducingBuildings = new() { BuildingType.BauxiteMine },
            MinDepositSize = 250,
            MaxDepositSize = 1000
        },
        
        [ResourceType.PreciousMetal] = new ResourceDefinition
        {
            Type = ResourceType.PreciousMetal,
            Name = "贵重金属",
            BasePrice = 50.0f,
            Weight = 8.0f,
            IsRenewable = false,
            IsDepletable = true,
            DepletionRate = 0.005f,
            TerrainAffinity = new()
            {
                [TerrainType.Mountains] = 0.9f,
                [TerrainType.Hills] = 0.5f,
                [TerrainType.Desert] = 0.3f
            },
            ProducingBuildings = new() { BuildingType.PreciousMetalMine },
            MinDepositSize = 50,
            MaxDepositSize = 300
        },
        
        [ResourceType.Fish] = new ResourceDefinition
        {
            Type = ResourceType.Fish,
            Name = "鱼类",
            BasePrice = 1.5f,
            Weight = 1.0f,
            IsRenewable = true,
            IsDepletable = false,
            TerrainAffinity = new()
            {
                [TerrainType.Coastal] = 1.0f
            },
            ProducingBuildings = new() { BuildingType.FishingPort },
            MinDepositSize = -1,  // 无限
            MaxDepositSize = -1
        }
    };
}
```

## 产出计算公式

### 基础产出公式

```csharp
public float CalculateProductionOutput(Building building, ResourceDeposit deposit)
{
    // 基础公式
    float baseOutput = building.BaseProduction;
    
    // 地形系数
    float terrainMultiplier = GetTerrainMultiplier(building, deposit);
    
    // 矿藏品质系数
    float qualityMultiplier = deposit.Quality switch
    {
        QualityLevel.Poor => 0.7f,
        QualityLevel.Normal => 1.0f,
        QualityLevel.Rich => 1.3f,
        QualityLevel.Excellent => 1.6f,
        _ => 1.0f
    };
    
    // 可开采度
    float accessibilityMultiplier = deposit.Accessibility;
    
    // 建筑等级
    float levelMultiplier = 1.0f + (building.Level - 1) * 0.5f;
    
    // 科技加成
    float techMultiplier = GetTechMultiplier(building, deposit.Type);
    
    // 工人效率 (POP相关)
    float workerEfficiency = CalculateWorkerEfficiency(building);
    
    // 综合计算
    float output = baseOutput 
        * terrainMultiplier 
        * qualityMultiplier 
        * accessibilityMultiplier 
        * levelMultiplier 
        * techMultiplier 
        * workerEfficiency;
    
    // 枯竭惩罚
    if (deposit.IsDepletable)
    {
        float depletionRatio = 1.0f - (deposit.RemainingAmount / deposit.TotalAmount);
        output *= (1.0f - depletionRatio * 0.5f); // 最多减产50%
    }
    
    return output;
}
```

### 工人效率计算

```csharp
public float CalculateWorkerEfficiency(Building building)
{
    int currentWorkers = building.CurrentWorkers;
    int maxWorkers = building.MaxWorkers;
    
    // 人员不足惩罚
    if (currentWorkers < maxWorkers * 0.5f)
        return 0.5f + (currentWorkers / (maxWorkers * 0.5f)) * 0.5f;
    
    // 满员效率
    float baseEfficiency = 1.0f;
    
    // 工人资质加成
    float qualificationBonus = building.AverageWorkerQualification * 0.2f;
    
    // 基础设施加成
    float infrastructureBonus = building.Province.Infrastructure.GetProductionBonus();
    
    return baseEfficiency + qualificationBonus + infrastructureBonus;
}
```

## 资源发现机制

### 勘探系统

```csharp
public class ExplorationSystem
{
    // 勘探省份
    public ExplorationResult ExploreProvince(Province province, float explorationBudget)
    {
        var result = new ExplorationResult();
        
        // 勘探成功率 = 基础成功率 + 预算加成 + 科技加成
        float successChance = 0.1f 
            + (explorationBudget / 1000f) * 0.3f 
            + GetExplorationTechBonus();
        
        // 检查隐藏资源
        foreach (var (resourceType, deposit) in province.Resources)
        {
            if (!deposit.IsDiscovered && RNG.Randf() < successChance)
            {
                deposit.Discover();
                result.DiscoveredResources.Add(resourceType);
                
                // 触发发现事件
                EventManager.Instance.TriggerEvent(
                    new ResourceDiscoveredEvent(province, resourceType));
            }
        }
        
        // 发现新矿藏的概率（即使之前没有该资源）
        if (RNG.Randf() < successChance * 0.2f)
        {
            var newResource = TryDiscoverNewDeposit(province);
            if (newResource.HasValue)
            {
                result.DiscoveredResources.Add(newResource.Value);
            }
        }
        
        return result;
    }
}
```

### 科技解锁资源

```csharp
public void OnTechnologyResearched(Country country, Technology tech)
{
    switch (tech.Type)
    {
        case TechType.GeologicalSurvey:
            // 解锁所有省份的隐藏矿产显示
            RevealAllMinerals(country);
            break;
            
        case TechType.OilDrilling:
            // 允许发现石油
            EnableOilDiscovery(country);
            break;
            
        case TechType.DeepMining:
            // 提高可开采度
            ImproveAccessibility(country, 0.2f);
            break;
    }
}
```

## 资源可视化

### Godot实现

```csharp
public partial class ResourceVisual : Node2D
{
    [Export] public ResourceType ResourceType { get; set; }
    [Export] public Sprite2D Icon { get; set; }
    [Export] public Label AmountLabel { get; set; }
    
    private ResourceDeposit _deposit;
    
    public void Setup(ResourceDeposit deposit)
    {
        _deposit = deposit;
        UpdateVisual();
    }
    
    public void UpdateVisual()
    {
        // 根据储量调整图标大小
        float scale = Mathf.Clamp(_deposit.RemainingAmount / 1000f, 0.5f, 2.0f);
        Icon.Scale = new Vector2(scale, scale);
        
        // 根据品质着色
        Icon.Modulate = _deposit.Quality switch
        {
            QualityLevel.Poor => new Color(0.6f, 0.6f, 0.6f),
            QualityLevel.Normal => new Color(1.0f, 1.0f, 1.0f),
            QualityLevel.Rich => new Color(1.0f, 0.8f, 0.2f),
            QualityLevel.Excellent => new Color(1.0f, 0.6f, 0.0f),
            _ => Colors.White
        };
        
        // 未发现时隐藏
        Visible = _deposit.IsDiscovered;
    }
}
```

## 配置文件示例

```json
{
  "resource_definitions": {
    "grain": {
      "base_price": 1.0,
      "weight": 1.0,
      "renewable": true,
      "depletable": false,
      "terrain_affinity": {
        "plains": 1.0,
        "hills": 0.5,
        "forest": 0.3
      }
    },
    "iron_ore": {
      "base_price": 4.0,
      "weight": 4.0,
      "renewable": false,
      "depletable": true,
      "depletion_rate": 0.001,
      "terrain_affinity": {
        "hills": 0.8,
        "mountains": 1.0
      }
    },
    "oil": {
      "base_price": 8.0,
      "requires_tech": "oil_drilling",
      "terrain_affinity": {
        "desert": 0.8,
        "plains": 0.5
      }
    }
  },
  "production_formulas": {
    "base_multiplier": 1.0,
    "terrain_weight": 0.3,
    "quality_weight": 0.3,
    "tech_weight": 0.2,
    "worker_weight": 0.2
  }
}
```

## 依赖关系

- **被依赖**: market_system, industrial_system
- **依赖**: map_design

## 性能考虑

1. **每日计算优化**: 只重新计算有变化的建筑产出
2. **缓存机制**: 缓存省份总产出，避免重复计算
3. **批处理**: 资源枯竭事件批量处理
4. **LOD**: 缩放地图时简化资源图标显示

## 测试要点

1. 资源分布是否符合地形偏好权重
2. 枯竭机制是否正确减少产出
3. 勘探成功率公式是否合理
4. 科技解锁资源是否正常工作
5. 极端情况（储量耗尽）的处理
