# 人口系统模块

## 模块概述

本模块负责管理游戏中的人口(POP)系统，采用维多利亚3风格的职业分类。人口有基本需求、生活需求和奢侈品需求三层需求结构，影响消费、生产力和政治力量。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用对象池管理POP对象
- 使用事件系统驱动需求变化

### 核心数据结构

#### 1. PopType (POP职业类型)
```csharp
public enum PopType
{
    // 底层
    Peasant,        // 农民 - 自给农业，低消费
    Laborer,        // 劳工 - 基础工业，低工资
    
    // 中层
    Machinist,      // 技工 - 熟练工人，中等收入
    Clerk,          // 职员 - 服务业，中等收入
    Soldier,        // 士兵 - 军事人员
    
    // 上层
    Aristocrat,     // 贵族 - 土地所有者，高消费
    Capitalist,     // 资本家 - 工业所有者，极高消费
    Bureaucrat      // 官僚 - 政府人员，稳定收入
}

public class PopTypeDefinition
{
    public PopType Type { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    
    // 收入等级
    public IncomeLevel DefaultIncome { get; set; }
    
    // 默认识字率
    public float DefaultLiteracy { get; set; }
    
    // 政治权重
    public float PoliticalWeight { get; set; }
    
    // 可从事的职业转换
    public List<PopType> CanPromoteTo { get; set; }
    public List<PopType> CanDemoteTo { get; set; }
    
    // 需求乘数
    public float NeedsMultiplier { get; set; }
}

public enum IncomeLevel
{
    VeryPoor,   // 极贫
    Poor,       // 贫穷
    Middle,     // 中产
    Rich,       // 富裕
    VeryRich    // 极富
}
```

#### 2. Pop (人口群体)
```csharp
public class Pop
{
    public int Id { get; set; }
    public int ProvinceId { get; set; }           // 所在省份
    public int CountryId { get; set; }            // 所属国家
    public PopType Type { get; set; }             // 职业类型
    
    // 人口数量
    public int Count { get; set; }
    
    // 文化/宗教 (简化版)
    public string Culture { get; set; }
    public string Religion { get; set; }
    
    // 经济指标
    public float AverageIncome { get; set; }      // 平均收入
    public float Savings { get; set; }            // 储蓄
    public float ConsumptionPower => AverageIncome * Count;
    
    // 需求
    public PopNeeds Needs { get; set; }
    public float NeedsFulfillment { get; set; }   // 需求满足度 0-1
    
    // 人口属性
    public float Literacy { get; set; }           // 识字率 0-1
    public float Radicalism { get; set; }         // 激进程度 0-1
    public float Loyalty { get; set; }            // 忠诚度 0-1
    
    // 就业
    public Building Workplace { get; set; }
    public float EmploymentRate { get; set; }     // 就业率
    
    // 每日更新
    public void DailyUpdate()
    {
        CalculateIncome();
        ConsumeNeeds();
        UpdateHappiness();
        CheckMigration();
        CheckPromotion();
    }
    
    private void CalculateIncome()
    {
        if (Workplace != null)
        {
            AverageIncome = Workplace.Wage * GetWageMultiplier(Type);
        }
        else
        {
            // 失业收入
            AverageIncome = GetUnemploymentBenefit();
        }
    }
    
    private void ConsumeNeeds()
    {
        var shoppingList = Needs.GenerateShoppingList(this);
        
        float totalCost = 0;
        float totalFulfilled = 0;
        
        foreach (var (good, amount) in shoppingList)
        {
            float price = MarketManager.Instance.GetPrice(good);
            float affordableAmount = (AverageIncome * Count * 0.8f) / price;
            float actualAmount = Math.Min(amount, affordableAmount);
            
            if (MarketManager.Instance.Buy(good, actualAmount, this))
            {
                totalFulfilled += actualAmount / amount;
                totalCost += actualAmount * price;
            }
        }
        
        NeedsFulfillment = totalFulfilled / shoppingList.Count;
        
        // 储蓄
        float surplus = (AverageIncome * Count) - totalCost;
        Savings += surplus * 0.3f; // 30%用于储蓄
    }
}
```

#### 3. PopNeeds (人口需求)
```csharp
public class PopNeeds
{
    // 三层需求结构
    public NeedsLevel BasicNeeds { get; set; }      // 基本需求 - 不满足会死亡
    public NeedsLevel LifeNeeds { get; set; }       // 生活需求 - 不满足影响幸福度
    public NeedsLevel LuxuryNeeds { get; set; }     // 奢侈品需求 - 满足提升幸福度
    
    public Dictionary<ResourceType, float> GenerateShoppingList(Pop pop)
    {
        var list = new Dictionary<ResourceType, float>();
        
        float multiplier = GetPopTypeMultiplier(pop.Type);
        
        // 基本需求 (必须满足)
        foreach (var (good, amount) in BasicNeeds.Goods)
        {
            list[good] = amount * pop.Count * multiplier;
        }
        
        // 生活需求 (优先满足)
        if (pop.NeedsFulfillment > 0.5f)
        {
            foreach (var (good, amount) in LifeNeeds.Goods)
            {
                if (list.ContainsKey(good))
                    list[good] += amount * pop.Count * multiplier;
                else
                    list[good] = amount * pop.Count * multiplier;
            }
        }
        
        // 奢侈品需求 (富余时)
        if (pop.NeedsFulfillment > 0.8f && pop.Savings > pop.AverageIncome * pop.Count)
        {
            foreach (var (good, amount) in LuxuryNeeds.Goods)
            {
                if (list.ContainsKey(good))
                    list[good] += amount * pop.Count * multiplier;
                else
                    list[good] = amount * pop.Count * multiplier;
            }
        }
        
        return list;
    }
}

public class NeedsLevel
{
    public string Name { get; set; }
    public Dictionary<ResourceType, float> Goods { get; set; }  // 商品:每人每天需求量
}
```

#### 4. PopulationManager (人口管理器)
```csharp
public partial class PopulationManager : Node
{
    public static PopulationManager Instance { get; private set; }
    
    // POP类型定义
    public Dictionary<PopType, PopTypeDefinition> PopTypeDefinitions { get; private set; }
    
    // 所有POP (按省份分组)
    public Dictionary<int, List<Pop>> ProvincePops { get; private set; }
    
    // 国家人口统计
    public Dictionary<int, CountryPopulation> CountryStats { get; private set; }
    
    public override void _Ready()
    {
        Instance = this;
        LoadPopDefinitions();
    }
    
    // 初始化地图人口
    public void InitializePopulation(int seed)
    {
        var rng = new RandomNumberGenerator();
        rng.Seed = (uint)seed;
        
        foreach (var province in MapData.Instance.Provinces)
        {
            GenerateProvincePops(province, rng);
        }
        
        CalculateCountryStats();
    }
    
    private void GenerateProvincePops(Province province, RandomNumberGenerator rng)
    {
        // 基于发展度生成初始人口
        int basePopulation = province.Development * 1000 + rng.RandiRange(0, 500);
        
        // 根据地形调整
        if (province.Terrain == TerrainType.Plains)
            basePopulation = (int)(basePopulation * 1.3f);
        else if (province.Terrain == TerrainType.Desert)
            basePopulation = (int)(basePopulation * 0.3f);
        
        province.Population = new List<Pop>();
        
        // 职业分布 (早期工业化前以农民为主)
        int peasants = (int)(basePopulation * 0.7f);
        int laborers = (int)(basePopulation * 0.15f);
        int others = basePopulation - peasants - laborers;
        
        if (peasants > 0)
            CreatePop(province, PopType.Peasant, peasants, rng);
        if (laborers > 0)
            CreatePop(province, PopType.Laborer, laborers, rng);
        if (others > 0)
        {
            // 剩余分配给其他职业
            CreatePop(province, PopType.Aristocrat, (int)(others * 0.02f), rng);
            CreatePop(province, PopType.Machinist, (int)(others * 0.05f), rng);
            CreatePop(province, PopType.Clerk, (int)(others * 0.05f), rng);
            CreatePop(province, PopType.Bureaucrat, (int)(others * 0.03f), rng);
        }
    }
    
    private void CreatePop(Province province, PopType type, int count, RandomNumberGenerator rng)
    {
        if (count <= 0) return;
        
        var definition = PopTypeDefinitions[type];
        
        var pop = new Pop
        {
            Id = GetNextPopId(),
            ProvinceId = province.Id,
            CountryId = province.CountryId,
            Type = type,
            Count = count,
            Literacy = definition.DefaultLiteracy + rng.RandfRange(-0.1f, 0.1f),
            AverageIncome = GetDefaultIncome(type),
            Needs = GenerateNeedsForType(type),
            Culture = "Main",  // 简化处理
            Religion = "Main"
        };
        
        province.Population.Add(pop);
        
        if (!ProvincePops.ContainsKey(province.Id))
            ProvincePops[province.Id] = new List<Pop>();
        ProvincePops[province.Id].Add(pop);
    }
    
    // 每日人口更新
    public void DailyUpdate()
    {
        foreach (var province in MapData.Instance.Provinces)
        {
            foreach (var pop in province.Population)
            {
                pop.DailyUpdate();
            }
            
            // 省份级别的人口变化
            UpdateProvincePopulation(province);
        }
        
        CalculateCountryStats();
    }
    
    private void UpdateProvincePopulation(Province province)
    {
        // 自然增长
        float growthRate = CalculateGrowthRate(province);
        
        foreach (var pop in province.Population)
        {
            // 需求满足度影响增长
            float needModifier = pop.NeedsFulfillment;
            int growth = (int)(pop.Count * growthRate * needModifier);
            pop.Count += growth;
            
            // 饥荒惩罚
            if (pop.NeedsFulfillment < 0.3f)
            {
                int starvation = (int)(pop.Count * 0.01f);
                pop.Count -= starvation;
                pop.Radicalism += 0.05f;
            }
        }
        
        // 移除空POP
        province.Population.RemoveAll(p => p.Count <= 0);
    }
}
```

## POP定义配置

```csharp
public static class PopConfig
{
    public static readonly Dictionary<PopType, PopTypeDefinition> Definitions = new()
    {
        [PopType.Peasant] = new PopTypeDefinition
        {
            Type = PopType.Peasant,
            Name = "农民",
            DefaultIncome = IncomeLevel.Poor,
            DefaultLiteracy = 0.1f,
            PoliticalWeight = 0.1f,
            CanPromoteTo = new() { PopType.Laborer, PopType.Machinist },
            CanDemoteTo = new() { PopType.Laborer },
            NeedsMultiplier = 0.5f
        },
        
        [PopType.Laborer] = new PopTypeDefinition
        {
            Type = PopType.Laborer,
            Name = "劳工",
            DefaultIncome = IncomeLevel.Poor,
            DefaultLiteracy = 0.2f,
            PoliticalWeight = 0.2f,
            CanPromoteTo = new() { PopType.Machinist, PopType.Clerk },
            CanDemoteTo = new() { PopType.Peasant },
            NeedsMultiplier = 0.7f
        },
        
        [PopType.Machinist] = new PopTypeDefinition
        {
            Type = PopType.Machinist,
            Name = "技工",
            DefaultIncome = IncomeLevel.Middle,
            DefaultLiteracy = 0.4f,
            PoliticalWeight = 0.5f,
            CanPromoteTo = new() { PopType.Clerk, PopType.Capitalist },
            CanDemoteTo = new() { PopType.Laborer },
            NeedsMultiplier = 1.0f
        },
        
        [PopType.Clerk] = new PopTypeDefinition
        {
            Type = PopType.Clerk,
            Name = "职员",
            DefaultIncome = IncomeLevel.Middle,
            DefaultLiteracy = 0.5f,
            PoliticalWeight = 0.6f,
            CanPromoteTo = new() { PopType.Bureaucrat, PopType.Capitalist },
            CanDemoteTo = new() { PopType.Machinist, PopType.Laborer },
            NeedsMultiplier = 1.1f
        },
        
        [PopType.Soldier] = new PopTypeDefinition
        {
            Type = PopType.Soldier,
            Name = "士兵",
            DefaultIncome = IncomeLevel.Middle,
            DefaultLiteracy = 0.3f,
            PoliticalWeight = 0.3f,
            CanPromoteTo = new() { PopType.Clerk },
            CanDemoteTo = new() { PopType.Laborer },
            NeedsMultiplier = 0.9f
        },
        
        [PopType.Aristocrat] = new PopTypeDefinition
        {
            Type = PopType.Aristocrat,
            Name = "贵族",
            DefaultIncome = IncomeLevel.Rich,
            DefaultLiteracy = 0.6f,
            PoliticalWeight = 2.0f,
            CanPromoteTo = new() { PopType.Capitalist },
            CanDemoteTo = new() { PopType.Clerk },
            NeedsMultiplier = 3.0f
        },
        
        [PopType.Capitalist] = new PopTypeDefinition
        {
            Type = PopType.Capitalist,
            Name = "资本家",
            DefaultIncome = IncomeLevel.VeryRich,
            DefaultLiteracy = 0.7f,
            PoliticalWeight = 3.0f,
            CanPromoteTo = new(),
            CanDemoteTo = new() { PopType.Aristocrat, PopType.Clerk },
            NeedsMultiplier = 5.0f
        },
        
        [PopType.Bureaucrat] = new PopTypeDefinition
        {
            Type = PopType.Bureaucrat,
            Name = "官僚",
            DefaultIncome = IncomeLevel.Rich,
            DefaultLiteracy = 0.8f,
            PoliticalWeight = 1.5f,
            CanPromoteTo = new() { PopType.Capitalist },
            CanDemoteTo = new() { PopType.Clerk },
            NeedsMultiplier = 2.0f
        }
    };
}
```

## 需求配置

```csharp
public static class NeedsConfig
{
    public static PopNeeds CreateDefaultNeeds()
    {
        return new PopNeeds
        {
            BasicNeeds = new NeedsLevel
            {
                Name = "基本需求",
                Goods = new Dictionary<ResourceType, float>
                {
                    [ResourceType.Grain] = 0.5f,      // 每人每天0.5单位粮食
                }
            },
            LifeNeeds = new NeedsLevel
            {
                Name = "生活需求",
                Goods = new Dictionary<ResourceType, float>
                {
                    [ResourceType.Grain] = 0.3f,
                    [ResourceType.Wood] = 0.1f,       // 取暖/建筑
                    [ResourceType.Fish] = 0.1f,       // 蛋白质
                }
            },
            LuxuryNeeds = new NeedsLevel
            {
                Name = "奢侈品需求",
                Goods = new Dictionary<ResourceType, float>
                {
                    [ResourceType.PreciousMetal] = 0.01f,  // 首饰
                }
            }
        };
    }
}
```

## 人口增长与迁移公式

### 自然增长率

```csharp
public float CalculateGrowthRate(Province province)
{
    // 基础增长率 0.5%每年
    float baseRate = 0.0000137f;  // 日增长率
    
    // 医疗科技加成
    float techBonus = GetMedicalTechBonus(province.CountryId);
    
    // 平均需求满足度
    float avgFulfillment = province.Population.Average(p => p.NeedsFulfillment);
    
    // 法律影响
    float lawModifier = GetGrowthLawModifier(province.CountryId);
    
    return baseRate * (1 + techBonus) * (0.5f + avgFulfillment) * lawModifier;
}
```

### 迁移逻辑

```csharp
public void CheckMigration(Pop pop)
{
    // 激进或失业人口更可能迁移
    float migrationDesire = pop.Radicalism * 0.5f + (1 - pop.EmploymentRate) * 0.5f;
    
    if (migrationDesire < 0.3f) return;
    
    // 寻找更好的目的地
    var bestDestination = FindBestMigrationDestination(pop);
    if (bestDestination == null) return;
    
    // 检查法律限制
    if (!CanMigrate(pop, bestDestination)) return;
    
    // 计算迁移人数
    int migrants = (int)(pop.Count * migrationDesire * 0.01f);
    if (migrants < 10) return;
    
    // 执行迁移
    ExecuteMigration(pop, bestDestination, migrants);
}

private Province FindBestMigrationDestination(Pop pop)
{
    var currentProvince = MapData.Instance.Provinces[pop.ProvinceId];
    var currentCountry = MapData.Instance.Countries[pop.CountryId];
    
    Province best = null;
    float bestScore = 0;
    
    // 考虑相邻省份
    foreach (var neighborId in currentProvince.Neighbors)
    {
        var neighbor = MapData.Instance.Provinces[neighborId];
        
        // 基础评分
        float score = 0;
        
        // 就业率
        score += neighbor.GetAverageEmploymentRate() * 30;
        
        // 工资水平
        score += neighbor.GetAverageWage() * 0.1f;
        
        // 基础设施
        score += (int)neighbor.Infrastructure * 10;
        
        // 同国偏好
        if (neighbor.CountryId == pop.CountryId)
            score += 20;
        else
        {
            // 外交关系影响
            var relation = DiplomacyManager.Instance.GetRelation(pop.CountryId, neighbor.CountryId);
            score += relation.Opinion * 0.1f;
        }
        
        if (score > bestScore)
        {
            bestScore = score;
            best = neighbor;
        }
    }
    
    return best;
}
```

### 职业转换

```csharp
public void CheckPromotion(Pop pop)
{
    var definition = PopConfig.Definitions[pop.Type];
    
    // 根据识字率和收入判断是否晋升
    foreach (var targetType in definition.CanPromoteTo)
    {
        float promotionChance = CalculatePromotionChance(pop, targetType);
        
        if (RandomManager.Roll(promotionChance))
        {
            // 检查目标职业是否有空缺
            if (HasJobOpening(targetType, pop.ProvinceId))
            {
                int promoters = (int)(pop.Count * 0.001f);  // 0.1%每日可能转换
                ExecutePromotion(pop, targetType, promoters);
                break;
            }
        }
    }
}

public float CalculatePromotionChance(Pop pop, PopType targetType)
{
    float chance = 0;
    
    // 识字率要求
    float targetLiteracy = PopConfig.Definitions[targetType].DefaultLiteracy;
    if (pop.Literacy < targetLiteracy * 0.8f)
        return 0;
    
    // 识字率超出要求越多，越容易晋升
    chance += (pop.Literacy - targetLiteracy * 0.8f) * 0.5f;
    
    // 需求满足度
    chance += pop.NeedsFulfillment * 0.3f;
    
    // 储蓄
    chance += Math.Min(pop.Savings / (pop.AverageIncome * pop.Count), 1.0f) * 0.2f;
    
    return chance;
}
```

## 人口UI显示

```csharp
public partial class PopulationPanel : Panel
{
    [Export] public VBoxContainer PopList { get; set; }
    [Export] public Label TotalPopulationLabel { get; set; }
    [Export] public Label LiteracyRateLabel { get; set; }
    
    public void UpdateDisplay(int countryId)
    {
        var stats = PopulationManager.Instance.CountryStats[countryId];
        
        TotalPopulationLabel.Text = $"总人口: {stats.TotalPopulation:N0}";
        LiteracyRateLabel.Text = $"识字率: {stats.LiteracyRate:P1}";
        
        // 清除旧列表
        foreach (var child in PopList.GetChildren())
            child.QueueFree();
        
        // 按职业分组显示
        foreach (var group in stats.PopsByType)
        {
            var row = new HBoxContainer();
            
            var typeLabel = new Label { Text = group.Key.ToString() };
            var countLabel = new Label { Text = $"{group.Value:N0}" };
            var percentLabel = new Label { 
                Text = $"{(float)group.Value / stats.TotalPopulation:P1}" 
            };
            
            row.AddChild(typeLabel);
            row.AddChild(countLabel);
            row.AddChild(percentLabel);
            
            PopList.AddChild(row);
        }
    }
}
```

## 配置文件

```json
{
  "pop_types": {
    "peasant": {
      "default_income": "poor",
      "default_literacy": 0.1,
      "political_weight": 0.1,
      "can_promote_to": ["laborer", "machinist"],
      "needs_multiplier": 0.5
    },
    "capitalist": {
      "default_income": "very_rich",
      "default_literacy": 0.7,
      "political_weight": 3.0,
      "can_demote_to": ["aristocrat", "clerk"],
      "needs_multiplier": 5.0
    }
  },
  "needs": {
    "basic": {
      "grain": 0.5
    },
    "life": {
      "grain": 0.3,
      "wood": 0.1,
      "fish": 0.1
    },
    "luxury": {
      "precious_metal": 0.01
    }
  },
  "growth": {
    "base_rate": 0.0000137,
    "medical_tech_bonus": 0.5,
    "fulfillment_weight": 0.5
  }
}
```

## 依赖关系

- **被依赖**: market_system, industrial_system, war_system, internal_affairs_system
- **依赖**: map_design, resource_production

## 性能优化

1. **POP合并**: 相同类型/文化/省份的POP定期合并
2. **分批更新**: 每日不更新所有POP，按省份分批处理
3. **缓存统计**: 国家人口统计缓存，按需更新
4. **事件驱动**: 需求变化通过事件通知，而非轮询
