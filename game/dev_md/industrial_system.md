# 工业系统模块

## 模块概述

本模块负责管理游戏中的全面工业系统，包含建筑类型、投入产出、产能计算、原料周转、规模经济和工业升级等机制。工业建筑需要投入原料和劳动力，产出商品。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用 `Building` 基类管理所有建筑
- 使用 `Queue` 管理建造队列

### 核心数据结构

#### 1. BuildingType (建筑类型枚举)
```csharp
public enum BuildingType
{
    // 农业
    Farm,               // 农场 - 产出粮食
    
    // 原材料
    LoggingCamp,        // 伐木营地 - 产出木材
    IronMine,           // 铁矿 - 产出铁矿
    CoalMine,           // 煤矿 - 产出煤矿
    CopperMine,         // 铜矿 - 产出铜矿
    BauxiteMine,        // 铝矿 - 产出铝矿
    PreciousMetalMine,  // 贵金属矿 - 产出贵金属
    OilRig,             // 油井 - 产出石油
    FishingPort,        // 渔港 - 产出鱼类
    
    // 制造业
    TextileMill,        // 纺织厂 - 消耗棉花/羊毛，产出布料
    SteelMill,          // 钢铁厂 - 消耗铁矿/煤炭，产出钢铁
    ArmsFactory,        // 军工厂 - 消耗钢铁/木材，产出武器
    Shipyard,           // 造船厂 - 消耗钢铁/木材，产出舰船
    FurnitureFactory,   // 家具厂 - 消耗木材，产出家具
    ToolFactory,        // 工具厂 - 消耗钢铁/木材，产出工具
    
    // 基础设施
    Railroad,           // 铁路 - 提高市场整合度
    Port,               // 港口 - 提高贸易效率
    Fort,               // 要塞 - 防御加成
    University,         // 大学 - 提高识字率
    GovernmentBuilding  // 政府建筑 - 提供官僚岗位
}
```

#### 2. BuildingDefinition (建筑定义)
```csharp
public class BuildingDefinition
{
    public BuildingType Type { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    
    // 建造费用
    public Dictionary<ResourceType, float> ConstructionCost { get; set; }
    public float ConstructionTime { get; set; }  // 天数
    
    // 规模
    public int BaseMaxWorkers { get; set; }
    public int MaxLevel { get; set; }
    
    // 投入产出
    public Dictionary<ResourceType, float> InputResources { get; set; }   // 每日消耗
    public Dictionary<ResourceType, float> OutputResources { get; set; }  // 每日产出
    
    // 岗位配置
    public Dictionary<PopType, int> JobSlots { get; set; }  // 各职业岗位数
    
    // 维护费用
    public float DailyMaintenanceCost { get; set; }
    
    // 特殊要求
    public List<TerrainType> RequiredTerrain { get; set; }
    public bool RequiresCoast { get; set; }
    public bool RequiresRiver { get; set; }
    public List<Technology> RequiredTechnologies { get; set; }
    
    // 规模经济
    public float EconomyOfScaleFactor { get; set; }  // 每级规模加成
}
```

#### 3. Building (建筑基类)
```csharp
public abstract class Building
{
    public int Id { get; set; }
    public BuildingType Type { get; set; }
    public int ProvinceId { get; set; }
    public int CountryId { get; set; }
    
    // 等级
    public int Level { get; set; } = 1;
    public int MaxLevel => Definition.MaxLevel;
    
    // 工人
    public List<Pop> Workers { get; set; } = new();
    public int CurrentWorkers => Workers.Sum(w => w.Count);
    public int MaxWorkers => Definition.BaseMaxWorkers * Level;
    public float EmploymentRate => (float)CurrentWorkers / MaxWorkers;
    
    // 生产状态
    public bool IsOperating { get; set; } = true;
    public float Efficiency { get; set; } = 1.0f;  // 当前效率
    public float UtilizationRate { get; set; } = 1.0f;  // 开工率
    
    // 库存
    public Dictionary<ResourceType, float> InputStockpile { get; set; } = new();
    public Dictionary<ResourceType, float> OutputStockpile { get; set; } = new();
    
    // 定义缓存
    protected BuildingDefinition Definition => BuildingConfig.Definitions[Type];
    
    // 每日更新
    public virtual void DailyUpdate()
    {
        if (!IsOperating) return;
        
        // 雇佣工人
        HireWorkers();
        
        // 采购原料
        PurchaseInputs();
        
        // 生产
        Produce();
        
        // 支付工资
        PayWages();
        
        // 维护
        PayMaintenance();
        
        // 销售产出
        SellOutputs();
    }
    
    protected virtual void HireWorkers()
    {
        // 招聘空缺岗位
        int neededWorkers = MaxWorkers - CurrentWorkers;
        if (neededWorkers <= 0) return;
        
        var province = MapData.Instance.Provinces[ProvinceId];
        
        foreach (var (popType, slotCount) in Definition.JobSlots)
        {
            int neededForType = (int)(slotCount * Level * EmploymentRate);
            int currentForType = Workers.Where(w => w.Type == popType).Sum(w => w.Count);
            int toHire = Math.Min(neededForType - currentForType, neededWorkers);
            
            if (toHire <= 0) continue;
            
            // 从省份POP中雇佣
            var availablePops = province.Population
                .Where(p => p.Type == popType && p.Workplace == null)
                .ToList();
            
            foreach (var pop in availablePops)
            {
                int hireCount = Math.Min(pop.Count, toHire);
                if (hireCount <= 0) continue;
                
                // 创建子POP用于工作
                if (hireCount < pop.Count)
                {
                    var workerPop = SplitPop(pop, hireCount);
                    workerPop.Workplace = this;
                    Workers.Add(workerPop);
                }
                else
                {
                    pop.Workplace = this;
                    Workers.Add(pop);
                }
                
                toHire -= hireCount;
                if (toHire <= 0) break;
            }
        }
    }
    
    protected virtual void PurchaseInputs()
    {
        // 采购所需原料
        foreach (var (resource, amount) in Definition.InputResources)
        {
            float needed = amount * Level * UtilizationRate;
            float inStock = InputStockpile.GetValueOrDefault(resource, 0);
            float toBuy = Math.Max(0, needed - inStock);
            
            if (toBuy > 0)
            {
                bool success = MarketManager.Instance.Buy(resource, toBuy, this);
                if (success)
                {
                    InputStockpile[resource] = inStock + toBuy;
                }
            }
        }
    }
    
    public virtual Dictionary<ResourceType, float> Produce()
    {
        var output = new Dictionary<ResourceType, float>();
        
        // 检查原料是否充足
        bool hasEnoughInputs = CheckInputsAvailability();
        if (!hasEnoughInputs)
        {
            UtilizationRate *= 0.9f;  // 原料不足，降低开工率
            return output;
        }
        
        UtilizationRate = Mathf.Min(UtilizationRate * 1.1f, 1.0f);  // 恢复开工率
        
        // 计算生产效率
        float productionEfficiency = CalculateProductionEfficiency();
        
        // 消耗原料
        foreach (var (resource, amount) in Definition.InputResources)
        {
            float consumed = amount * Level * productionEfficiency;
            InputStockpile[resource] -= consumed;
        }
        
        // 生产产出
        foreach (var (resource, amount) in Definition.OutputResources)
        {
            float produced = amount * Level * productionEfficiency;
            
            // 规模经济加成
            float scaleBonus = 1 + (Level - 1) * Definition.EconomyOfScaleFactor;
            produced *= scaleBonus;
            
            output[resource] = produced;
            
            // 存入库存
            if (!OutputStockpile.ContainsKey(resource))
                OutputStockpile[resource] = 0;
            OutputStockpile[resource] += produced;
        }
        
        return output;
    }
    
    protected float CalculateProductionEfficiency()
    {
        float efficiency = Efficiency;
        
        // 人员充足度
        efficiency *= EmploymentRate;
        
        // 基础设施加成
        var province = MapData.Instance.Provinces[ProvinceId];
        efficiency *= (1 + province.Infrastructure.GetProductionBonus());
        
        // 科技加成
        var country = MapData.Instance.Countries[CountryId];
        efficiency *= (1 + GetTechnologyBonus(country));
        
        // 市场整合度
        var market = MarketManager.Instance.GetMarketForCountry(CountryId);
        efficiency *= (0.8f + market.IntegrationLevel * 0.2f);
        
        return efficiency;
    }
    
    protected virtual void PayWages()
    {
        var country = MapData.Instance.Countries[CountryId];
        float totalWages = 0;
        
        foreach (var worker in Workers)
        {
            float wage = GetWageForPopType(worker.Type) * worker.Count;
            worker.Savings += wage * 0.9f;  // 90%给工人，10%税收
            totalWages += wage;
        }
        
        country.Treasury -= totalWages;
    }
    
    protected virtual void SellOutputs()
    {
        // 销售产出到市场
        foreach (var (resource, amount) in OutputStockpile.ToList())
        {
            if (amount > 0)
            {
                MarketManager.Instance.Sell(resource, amount, this);
                OutputStockpile[resource] = 0;
            }
        }
    }
    
    // 升级建筑
    public virtual bool Upgrade()
    {
        if (Level >= MaxLevel) return false;
        
        // 检查升级费用
        var country = MapData.Instance.Countries[CountryId];
        float upgradeCost = CalculateUpgradeCost();
        
        if (country.Treasury < upgradeCost) return false;
        
        // 扣除费用
        country.Treasury -= upgradeCost;
        
        // 升级
        Level++;
        
        // 触发升级事件
        EventManager.Instance.TriggerEvent(
            new BuildingUpgradedEvent(this));
        
        return true;
    }
}
```

#### 4. ConstructionQueue (建造队列)
```csharp
public class ConstructionQueue
{
    public int CountryId { get; set; }
    public List<ConstructionProject> Projects { get; set; } = new();
    public int MaxConcurrentProjects { get; set; } = 5;
    
    // 添建筑项目
    public bool AddProject(BuildingType type, int provinceId)
    {
        var country = MapData.Instance.Countries[CountryId];
        var definition = BuildingConfig.Definitions[type];
        var province = MapData.Instance.Provinces[provinceId];
        
        // 检查建造权限 (市场法限制)
        if (!CanBuildType(type, country)) return false;
        
        // 检查地形要求
        if (!MeetsTerrainRequirements(definition, province)) return false;
        
        // 检查科技要求
        if (!MeetsTechRequirements(definition, country)) return false;
        
        // 检查建造费用
        float totalCost = CalculateConstructionCost(definition);
        if (country.Treasury < totalCost * 0.2f) return false;  // 需要20%首付
        
        // 创建项目
        var project = new ConstructionProject
        {
            Id = Projects.Count,
            BuildingType = type,
            ProvinceId = provinceId,
            TotalCost = totalCost,
            PaidCost = totalCost * 0.2f,
            RemainingDays = definition.ConstructionTime,
            Progress = 0
        };
        
        country.Treasury -= project.PaidCost;
        Projects.Add(project);
        
        return true;
    }
    
    // 每日更新
    public void DailyUpdate()
    {
        var activeProjects = Projects
            .Where(p => !p.IsComplete)
            .Take(MaxConcurrentProjects)
            .ToList();
        
        foreach (var project in activeProjects)
        {
            // 支付每日建造费用
            float dailyCost = project.TotalCost / project.TotalDays;
            var country = MapData.Instance.Countries[CountryId];
            
            if (country.Treasury >= dailyCost)
            {
                country.Treasury -= dailyCost;
                project.PaidCost += dailyCost;
                project.RemainingDays--;
                project.Progress = 1 - (float)project.RemainingDays / project.TotalDays;
                
                if (project.RemainingDays <= 0)
                {
                    CompleteProject(project);
                }
            }
            else
            {
                // 资金不足，暂停建造
                project.IsPaused = true;
            }
        }
    }
    
    private void CompleteProject(ConstructionProject project)
    {
        project.IsComplete = true;
        
        // 创建建筑
        var building = BuildingFactory.Create(project.BuildingType, project.ProvinceId);
        var province = MapData.Instance.Provinces[project.ProvinceId];
        province.Buildings.Add(building);
        
        // 触发事件
        EventManager.Instance.TriggerEvent(
            new BuildingConstructedEvent(building));
    }
}

public class ConstructionProject
{
    public int Id { get; set; }
    public BuildingType BuildingType { get; set; }
    public int ProvinceId { get; set; }
    
    public float TotalCost { get; set; }
    public float PaidCost { get; set; }
    public int TotalDays { get; set; }
    public int RemainingDays { get; set; }
    public float Progress { get; set; }
    
    public bool IsComplete { get; set; }
    public bool IsPaused { get; set; }
}
```

#### 5. IndustrialManager (工业管理器)
```csharp
public partial class IndustrialManager : Node
{
    public static IndustrialManager Instance { get; private set; }
    
    // 每个国家的建造队列
    public Dictionary<int, ConstructionQueue> ConstructionQueues { get; private set; }
    
    public override void _Ready()
    {
        Instance = this;
    }
    
    public void Initialize()
    {
        ConstructionQueues = new Dictionary<int, ConstructionQueue>();
        
        foreach (var country in MapData.Instance.Countries)
        {
            ConstructionQueues[country.Id] = new ConstructionQueue
            {
                CountryId = country.Id,
                MaxConcurrentProjects = CalculateMaxProjects(country)
            };
        }
    }
    
    public void DailyUpdate()
    {
        // 更新所有建造队列
        foreach (var queue in ConstructionQueues.Values)
        {
            queue.DailyUpdate();
        }
        
        // 更新所有建筑
        foreach (var province in MapData.Instance.Provinces)
        {
            foreach (var building in province.Buildings)
            {
                building.DailyUpdate();
            }
        }
    }
    
    // 获取国家工业统计
    public IndustrialStats GetCountryStats(int countryId)
    {
        var country = MapData.Instance.Countries[countryId];
        var stats = new IndustrialStats();
        
        foreach (var provId in country.OwnedProvinces)
        {
            var province = MapData.Instance.Provinces[provId];
            
            stats.TotalBuildings += province.Buildings.Count;
            stats.TotalWorkers += province.Buildings.Sum(b => b.CurrentWorkers);
            
            foreach (var building in province.Buildings)
            {
                if (!stats.BuildingsByType.ContainsKey(building.Type))
                    stats.BuildingsByType[building.Type] = 0;
                stats.BuildingsByType[building.Type]++;
            }
        }
        
        return stats;
    }
}
```

## 建筑配置表

```csharp
public static class BuildingConfig
{
    public static readonly Dictionary<BuildingType, BuildingDefinition> Definitions = new()
    {
        [BuildingType.Farm] = new BuildingDefinition
        {
            Type = BuildingType.Farm,
            Name = "农场",
            ConstructionCost = new() { [ResourceType.Wood] = 50 },
            ConstructionTime = 30,
            BaseMaxWorkers = 100,
            MaxLevel = 10,
            OutputResources = new() { [ResourceType.Grain] = 10 },
            JobSlots = new() { [PopType.Peasant] = 80, [PopType.Machinist] = 5 },
            DailyMaintenanceCost = 1,
            RequiredTerrain = new() { TerrainType.Plains, TerrainType.Hills },
            EconomyOfScaleFactor = 0.05f
        },
        
        [BuildingType.IronMine] = new BuildingDefinition
        {
            Type = BuildingType.IronMine,
            Name = "铁矿",
            ConstructionCost = new() { [ResourceType.Wood] = 100, [ResourceType.Tool] = 20 },
            ConstructionTime = 60,
            BaseMaxWorkers = 50,
            MaxLevel = 5,
            OutputResources = new() { [ResourceType.IronOre] = 8 },
            JobSlots = new() { [PopType.Laborer] = 40, [PopType.Machinist] = 10 },
            DailyMaintenanceCost = 2,
            RequiredTerrain = new() { TerrainType.Hills, TerrainType.Mountains },
            EconomyOfScaleFactor = 0.08f
        },
        
        [BuildingType.SteelMill] = new BuildingDefinition
        {
            Type = BuildingType.SteelMill,
            Name = "钢铁厂",
            ConstructionCost = new() { [ResourceType.IronOre] = 200, [ResourceType.Wood] = 100 },
            ConstructionTime = 120,
            BaseMaxWorkers = 80,
            MaxLevel = 5,
            InputResources = new() { [ResourceType.IronOre] = 4, [ResourceType.Coal] = 2 },
            OutputResources = new() { [ResourceType.Steel] = 3 },
            JobSlots = new() { [PopType.Laborer] = 50, [PopType.Machinist] = 25, [PopType.Clerk] = 5 },
            DailyMaintenanceCost = 5,
            RequiredTechnologies = new() { Technology.BessemerProcess },
            EconomyOfScaleFactor = 0.1f
        },
        
        [BuildingType.ArmsFactory] = new BuildingDefinition
        {
            Type = BuildingType.ArmsFactory,
            Name = "军工厂",
            ConstructionCost = new() { [ResourceType.Steel] = 150, [ResourceType.Wood] = 80 },
            ConstructionTime = 90,
            BaseMaxWorkers = 60,
            MaxLevel = 3,
            InputResources = new() { [ResourceType.Steel] = 2, [ResourceType.Wood] = 1 },
            OutputResources = new() { [ResourceType.Arms] = 2 },
            JobSlots = new() { [PopType.Laborer] = 40, [PopType.Machinist] = 15, [PopType.Clerk] = 5 },
            DailyMaintenanceCost = 8,
            EconomyOfScaleFactor = 0.05f
        },
        
        [BuildingType.Railroad] = new BuildingDefinition
        {
            Type = BuildingType.Railroad,
            Name = "铁路",
            ConstructionCost = new() { [ResourceType.Steel] = 100, [ResourceType.Wood] = 50 },
            ConstructionTime = 45,
            BaseMaxWorkers = 30,
            MaxLevel = 3,
            InputResources = new() { [ResourceType.Coal] = 1, [ResourceType.Steel] = 0.1f },
            JobSlots = new() { [PopType.Laborer] = 25, [PopType.Machinist] = 5 },
            DailyMaintenanceCost = 3,
            RequiredTechnologies = new() { Technology.Railways },
            EconomyOfScaleFactor = 0.15f  // 铁路规模经济更明显
        }
    };
}
```

## 原料周转系统

```csharp
public class SupplyChainManager
{
    // 计算产业链效率
    public float CalculateSupplyChainEfficiency(int countryId, ResourceType endProduct)
    {
        var country = MapData.Instance.Countries[countryId];
        
        // 获取该产品的完整产业链
        var chain = GetProductionChain(endProduct);
        
        float totalEfficiency = 1.0f;
        
        foreach (var step in chain)
        {
            // 检查每一步的国内产能
            float domesticCapacity = CalculateDomesticCapacity(countryId, step.Resource);
            float requiredAmount = step.Amount;
            
            if (domesticCapacity < requiredAmount)
            {
                // 需要进口，效率降低
                float importRatio = 1 - (domesticCapacity / requiredAmount);
                totalEfficiency *= (1 - importRatio * 0.2f);  // 进口降低20%效率
            }
        }
        
        return totalEfficiency;
    }
    
    // 分析瓶颈
    public List<ResourceType> FindBottlenecks(int countryId, BuildingType buildingType)
    {
        var definition = BuildingConfig.Definitions[buildingType];
        var bottlenecks = new List<ResourceType>();
        
        foreach (var (resource, amount) in definition.InputResources)
        {
            float domesticProduction = CalculateDomesticProduction(countryId, resource);
            float totalDemand = CalculateTotalDemand(countryId, resource);
            
            if (domesticProduction < totalDemand * 0.8f)
            {
                bottlenecks.Add(resource);
            }
        }
        
        return bottlenecks;
    }
}
```

## UI显示

```csharp
public partial class IndustryPanel : Panel
{
    [Export] public ItemList BuildingList { get; set; }
    [Export] public VBoxContainer ConstructionQueue { get; set; }
    [Export] public Button BuildButton { get; set; }
    
    public void UpdateDisplay(int countryId)
    {
        var stats = IndustrialManager.Instance.GetCountryStats(countryId);
        
        // 更新建筑列表
        BuildingList.Clear();
        foreach (var (type, count) in stats.BuildingsByType)
        {
            BuildingList.AddItem($"{type}: {count}");
        }
        
        // 更新建造队列
        UpdateConstructionQueue(countryId);
    }
    
    private void UpdateConstructionQueue(int countryId)
    {
        foreach (var child in ConstructionQueue.GetChildren())
            child.QueueFree();
        
        var queue = IndustrialManager.Instance.ConstructionQueues[countryId];
        
        foreach (var project in queue.Projects.Where(p => !p.IsComplete))
        {
            var row = new HBoxContainer();
            
            var typeLabel = new Label { Text = project.BuildingType.ToString() };
            var progressBar = new ProgressBar 
            { 
                Value = project.Progress * 100,
                MaxValue = 100,
                CustomMinimumSize = new Vector2(200, 20)
            };
            var daysLabel = new Label { Text = $"{project.RemainingDays}天" };
            
            row.AddChild(typeLabel);
            row.AddChild(progressBar);
            row.AddChild(daysLabel);
            
            ConstructionQueue.AddChild(row);
        }
    }
}
```

## 配置文件

```json
{
  "construction": {
    "base_construction_speed": 1.0,
    "max_concurrent_projects_formula": "bureaucracy * 2 + 3",
    "down_payment_ratio": 0.2,
    "pause_on_low_funds": true
  },
  "production": {
    "economy_of_scale_cap": 0.5,
    "min_utilization_rate": 0.1,
    "input_buffer_days": 7
  },
  "employment": {
    "wage_base": 1.0,
    "wage_multiplier": {
      "peasant": 0.5,
      "laborer": 0.8,
      "machinist": 1.2,
      "clerk": 1.5,
      "capitalist": 5.0
    }
  }
}
```

## 依赖关系

- **被依赖**: war_system, internal_affairs_system
- **依赖**: map_design, resource_production, population_system, market_system, tech_tree

## 性能优化

1. **建筑批处理**: 同类型建筑批量更新
2. **库存缓存**: 原料库存定期检查而非每日全扫描
3. **建造队列优化**: 暂停的项目跳过处理
4. **按需计算**: 产业链分析按需执行
