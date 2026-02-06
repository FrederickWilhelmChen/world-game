# 科技树模块

## 模块概述

本模块负责管理1800-1900年的科技树系统，包含生产、军事、社会三大类科技，支持科技研发、科技效果和科技传播机制。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用图结构存储科技树
- 使用 `Resource` 保存科技配置

### 核心数据结构

#### 1. TechnologyCategory (科技分类)
```csharp
public enum TechnologyCategory
{
    Production,     // 生产科技 - 工业、农业
    Military,       // 军事科技 - 武器、战术
    Society         // 社会科技 - 政治、文化
}
```

#### 2. Technology (科技)
```csharp
public class Technology
{
    public string Id { get; set; }                    // 唯一标识
    public string Name { get; set; }                  // 显示名称
    public string Description { get; set; }           // 描述
    public TechnologyCategory Category { get; set; }  // 分类
    public int Year { get; set; }                     // 历史年份 (用于AI和历史模式)
    
    // 科技树结构
    public List<string> Prerequisites { get; set; }   // 前置科技
    public List<string> Unlocks { get; set; }         // 解锁的科技
    
    // 研发成本
    public int BaseCost { get; set; }                 // 基础研究点数
    public Dictionary<ResourceType, float> ResearchCost { get; set; }  // 额外资源消耗
    
    // 研发速度修正
    public float LiteracyRequirement { get; set; }    // 最低识字率要求
    public Dictionary<string, float> InstitutionBonus { get; set; }  // 机构加成
    
    // 效果
    public List<TechEffect> Effects { get; set; }
    
    // 研发状态
    public bool IsResearched { get; set; }
    public float ResearchProgress { get; set; }
    
    // 检查是否可以研究
    public bool CanResearch(Country country)
    {
        // 检查前置科技
        foreach (var prereq in Prerequisites)
        {
            if (!country.HasTechnology(prereq))
                return false;
        }
        
        // 检查识字率
        if (country.LiteracyRate < LiteracyRequirement)
            return false;
        
        return true;
    }
}

public class TechEffect
{
    public EffectType Type { get; set; }
    public string Target { get; set; }           // 目标对象
    public float Value { get; set; }             // 效果数值
    public string Condition { get; set; }        // 条件 (可选)
}

public enum EffectType
{
    BuildingUnlock,       // 解锁建筑
    ProductionModifier,   // 生产修正
    MilitaryModifier,     // 军事修正
    LawUnlock,           // 解锁法律
    ResourceDiscovery,   // 资源发现
    InfrastructureBonus, // 基础设施加成
    PopModifier          // 人口修正
}
```

#### 3. TechnologyTree (科技树)
```csharp
public class TechnologyTree
{
    // 所有科技
    public Dictionary<string, Technology> Technologies { get; set; }
    
    // 按分类索引
    public Dictionary<TechnologyCategory, List<Technology>> ByCategory { get; set; }
    
    // 按年份索引
    public SortedDictionary<int, List<Technology>> ByYear { get; set; }
    
    public TechnologyTree()
    {
        LoadTechnologies();
        BuildIndices();
    }
    
    private void LoadTechnologies()
    {
        // 从JSON/Resource加载科技定义
        Technologies = TechConfig.LoadAllTechnologies();
    }
    
    private void BuildIndices()
    {
        ByCategory = new Dictionary<TechnologyCategory, List<Technology>>();
        ByYear = new SortedDictionary<int, List<Technology>>();
        
        foreach (var tech in Technologies.Values)
        {
            if (!ByCategory.ContainsKey(tech.Category))
                ByCategory[tech.Category] = new List<Technology>();
            ByCategory[tech.Category].Add(tech);
            
            if (!ByYear.ContainsKey(tech.Year))
                ByYear[tech.Year] = new List<TeTechnology>();
            ByYear[tech.Year].Add(tech);
        }
    }
    
    // 获取可研究科技
    public List<Technology> GetAvailableTechnologies(Country country)
    {
        var available = new List<Technology>();
        
        foreach (var tech in Technologies.Values)
        {
            if (!tech.IsResearched && tech.CanResearch(country))
            {
                available.Add(tech);
            }
        }
        
        return available;
    }
    
    // 获取科技路径
    public List<Technology> GetTechPath(string fromTechId, string toTechId)
    {
        // BFS查找最短路径
        var queue = new Queue<List<Technology>>();
        queue.Enqueue(new List<Technology> { Technologies[fromTechId] });
        
        var visited = new HashSet<string> { fromTechId };
        
        while (queue.Count > 0)
        {
            var path = queue.Dequeue();
            var current = path.Last();
            
            if (current.Id == toTechId)
                return path;
            
            foreach (var unlockId in current.Unlocks)
            {
                if (!visited.Contains(unlockId))
                {
                    visited.Add(unlockId);
                    var newPath = new List<Technology>(path) { Technologies[unlockId] };
                    queue.Enqueue(newPath);
                }
            }
        }
        
        return null;  // 无路径
    }
}
```

#### 4. ResearchManager (研究管理器)
```csharp
public partial class ResearchManager : Node
{
    public static ResearchManager Instance { get; private set; }
    
    public TechnologyTree TechTree { get; private set; }
    
    // 各国的研究队列
    public Dictionary<int, ResearchQueue> CountryResearch { get; private set; }
    
    public override void _Ready()
    {
        Instance = this;
        TechTree = new TechnologyTree();
    }
    
    public void Initialize()
    {
        CountryResearch = new Dictionary<int, ResearchQueue>();
        
        foreach (var country in MapData.Instance.Countries)
        {
            CountryResearch[country.Id] = new ResearchQueue
            {
                CountryId = country.Id,
                AvailableSlots = CalculateResearchSlots(country)
            };
            
            // 给予初始科技
            GiveStartingTechnologies(country);
        }
    }
    
    private void GiveStartingTechnologies(Country country)
    {
        // 1800年起始科技
        var startingTechs = new[]
        {
            "agricultural_enclosure",
            "early_railways",
            "flintlock_muskets",
            "manufacturies"
        };
        
        foreach (var techId in startingTechs)
        {
            country.UnlockTechnology(techId);
        }
    }
    
    // 每日研究更新
    public void DailyUpdate()
    {
        foreach (var (countryId, queue) in CountryResearch)
        {
            ProcessResearch(countryId, queue);
        }
    }
    
    private void ProcessResearch(int countryId, ResearchQueue queue)
    {
        var country = MapData.Instance.Countries[countryId];
        
        foreach (var project in queue.ActiveProjects)
        {
            if (project.IsComplete) continue;
            
            // 计算每日研究进度
            float dailyProgress = CalculateDailyResearch(country, project.Technology);
            
            project.Progress += dailyProgress;
            
            if (project.Progress >= project.Technology.BaseCost)
            {
                CompleteResearch(country, project.Technology);
                project.IsComplete = true;
            }
        }
        
        // 清理已完成项目
        queue.ActiveProjects.RemoveAll(p => p.IsComplete);
        
        // 自动开始新研究
        if (queue.ActiveProjects.Count < queue.AvailableSlots && queue.AutoResearch)
        {
            StartAutoResearch(country, queue);
        }
    }
    
    private float CalculateDailyResearch(Country country, Technology tech)
    {
        float basePoints = 1.0f;
        
        // 识字率加成 (核心因素)
        basePoints *= (0.5f + country.LiteracyRate * 2);
        
        // 大学加成
        int universityCount = country.OwnedProvinces
            .SelectMany(p => MapData.Instance.Provinces[p].Buildings)
            .Count(b => b.Type == BuildingType.University);
        basePoints *= (1 + universityCount * 0.1f);
        
        // 官僚加成
        int bureaucratCount = country.OwnedProvinces
            .SelectMany(p => MapData.Instance.Provinces[p].Population)
            .Where(p => p.Type == PopType.Bureaucrat)
            .Sum(p => p.Count);
        basePoints *= (1 + bureaucratCount / 1000f * 0.05f);
        
        // 科技类别加成
        if (tech.Category == TechnologyCategory.Society && country.LiteracyRate > 0.5f)
            basePoints *= 1.2f;
        
        // 政府改革加成
        if (country.CurrentLaws.ElectionLaw >= ElectionLawType.WealthWeighted)
            basePoints *= 1.1f;
        
        // 资源投入加成
        if (tech.ResearchCost != null)
        {
            foreach (var (resource, amount) in tech.ResearchCost)
            {
                if (country.ResourceStockpile.GetValueOrDefault(resource, 0) >= amount / 30)
                {
                    basePoints *= 1.1f;
                    country.ResourceStockpile[resource] -= amount / 30;
                }
            }
        }
        
        return basePoints;
    }
    
    private void CompleteResearch(Country country, Technology tech)
    {
        country.UnlockTechnology(tech.Id);
        
        // 应用科技效果
        ApplyTechEffects(country, tech);
        
        // 触发事件
        EventManager.Instance.TriggerEvent(
            new TechnologyResearchedEvent(country, tech));
        
        // 科技传播
        SpreadTechnology(country, tech);
    }
    
    private void ApplyTechEffects(Country country, Technology tech)
    {
        foreach (var effect in tech.Effects)
        {
            ApplyEffect(country, effect);
        }
    }
    
    private void ApplyEffect(Country country, TechEffect effect)
    {
        switch (effect.Type)
        {
            case EffectType.BuildingUnlock:
                country.UnlockedBuildings.Add(effect.Target);
                break;
                
            case EffectType.ProductionModifier:
                country.Modifiers.Production += effect.Value;
                break;
                
            case EffectType.MilitaryModifier:
                country.Modifiers.Military += effect.Value;
                break;
                
            case EffectType.LawUnlock:
                country.AvailableLaws.Add(effect.Target);
                break;
                
            case EffectType.ResourceDiscovery:
                EnableResourceDiscovery(country, effect.Target);
                break;
                
            case EffectType.InfrastructureBonus:
                country.Modifiers.Infrastructure += effect.Value;
                break;
                
            case EffectType.PopModifier:
                country.Modifiers.PopGrowth += effect.Value;
                break;
        }
    }
}

public class ResearchQueue
{
    public int CountryId { get; set; }
    public int AvailableSlots { get; set; } = 1;
    public List<ResearchProject> ActiveProjects { get; set; } = new();
    public bool AutoResearch { get; set; } = true;
    public TechnologyCategory PriorityCategory { get; set; }
}

public class ResearchProject
{
    public Technology Technology { get; set; }
    public float Progress { get; set; }
    public bool IsComplete { get; set; }
}
```

## 科技配置表

### 生产科技

```csharp
public static class TechConfig
{
    public static readonly Dictionary<string, Technology> ProductionTechs = new()
    {
        ["agricultural_enclosure"] = new Technology
        {
            Id = "agricultural_enclosure",
            Name = "农业圈地",
            Category = TechnologyCategory.Production,
            Year = 1800,
            BaseCost = 1000,
            Prerequisites = new(),
            Effects = new()
            {
                new TechEffect { Type = EffectType.ProductionModifier, Target = "farms", Value = 0.2f }
            }
        },
        
        ["manufacturies"] = new Technology
        {
            Id = "manufacturies",
            Name = "手工厂",
            Category = TechnologyCategory.Production,
            Year = 1800,
            BaseCost = 1200,
            Prerequisites = new(),
            Unlocks = new() { "mechanized_workshops" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.BuildingUnlock, Target = "textile_mill" }
            }
        },
        
        ["mechanized_workshops"] = new Technology
        {
            Id = "mechanized_workshops",
            Name = "机械化工坊",
            Category = TechnologyCategory.Production,
            Year = 1815,
            BaseCost = 2000,
            Prerequisites = new() { "manufacturies" },
            Unlocks = new() { " Bessemer_process" },
            LiteracyRequirement = 0.2f,
            Effects = new()
            {
                new TechEffect { Type = EffectType.ProductionModifier, Target = "all_industry", Value = 0.3f }
            }
        },
        
        ["Bessemer_process"] = new Technology
        {
            Id = "Bessemer_process",
            Name = "贝塞麦炼钢法",
            Category = TechnologyCategory.Production,
            Year = 1856,
            BaseCost = 4000,
            Prerequisites = new() { "mechanized_workshops" },
            Unlocks = new() { "steel_refinement" },
            LiteracyRequirement = 0.3f,
            Effects = new()
            {
                new TechEffect { Type = EffectType.BuildingUnlock, Target = "steel_mill" },
                new TechEffect { Type = EffectType.ProductionModifier, Target = "steel", Value = 0.5f }
            }
        },
        
        ["railways"] = new Technology
        {
            Id = "railways",
            Name = "铁路",
            Category = TechnologyCategory.Production,
            Year = 1830,
            BaseCost = 3000,
            Prerequisites = new() { "mechanized_workshops" },
            LiteracyRequirement = 0.25f,
            Effects = new()
            {
                new TechEffect { Type = EffectType.BuildingUnlock, Target = "railroad" },
                new TechEffect { Type = EffectType.InfrastructureBonus, Value = 0.3f }
            }
        },
        
        ["oil_drilling"] = new Technology
        {
            Id = "oil_drilling",
            Name = "石油钻探",
            Category = TechnologyCategory.Production,
            Year = 1860,
            BaseCost = 5000,
            Prerequisites = new() { "Bessemer_process" },
            LiteracyRequirement = 0.35f,
            Effects = new()
            {
                new TechEffect { Type = EffectType.ResourceDiscovery, Target = "oil" },
                new TechEffect { Type = EffectType.BuildingUnlock, Target = "oil_rig" }
            }
        },
        
        ["electricity"] = new Technology
        {
            Id = "electricity",
            Name = "电力",
            Category = TechnologyCategory.Production,
            Year = 1880,
            BaseCost = 8000,
            Prerequisites = new() { "oil_drilling" },
            LiteracyRequirement = 0.4f,
            Effects = new()
            {
                new TechEffect { Type = EffectType.ProductionModifier, Target = "all_industry", Value = 0.4f }
            }
        }
    };
}
```

### 军事科技

```csharp
public static class MilitaryTechs
{
    public static readonly Dictionary<string, Technology> Techs = new()
    {
        ["flintlock_muskets"] = new Technology
        {
            Id = "flintlock_muskets",
            Name = "燧发枪",
            Category = TechnologyCategory.Military,
            Year = 1800,
            BaseCost = 800,
            Prerequisites = new(),
            Unlocks = new() { "percussion_caps" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "infantry_attack", Value = 0.1f }
            }
        },
        
        ["percussion_caps"] = new Technology
        {
            Id = "percussion_caps",
            Name = "雷管",
            Category = TechnologyCategory.Military,
            Year = 1820,
            BaseCost = 1500,
            Prerequisites = new() { "flintlock_muskets" },
            Unlocks = new() { "rifled_barrels" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "infantry_attack", Value = 0.15f }
            }
        },
        
        ["rifled_barrels"] = new Technology
        {
            Id = "rifled_barrels",
            Name = "膛线",
            Category = TechnologyCategory.Military,
            Year = 1850,
            BaseCost = 2500,
            Prerequisites = new() { "percussion_caps" },
            Unlocks = new() { "breech_loading" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "infantry_attack", Value = 0.2f },
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "infantry_defense", Value = 0.1f }
            }
        },
        
        ["breech_loading"] = new Technology
        {
            Id = "breech_loading",
            Name = "后装填",
            Category = TechnologyCategory.Military,
            Year = 1865,
            BaseCost = 3500,
            Prerequisites = new() { "rifled_barrels" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "infantry_fire_rate", Value = 0.3f }
            }
        },
        
        ["mobilization_plans"] = new Technology
        {
            Id = "mobilization_plans",
            Name = "动员计划",
            Category = TechnologyCategory.Military,
            Year = 1870,
            BaseCost = 4000,
            Prerequisites = new() { "railways" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "mobilization_speed", Value = 0.5f },
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "manpower_cap", Value = 0.3f }
            }
        },
        
        ["ironclads"] = new Technology
        {
            Id = "ironclads",
            Name = "铁甲舰",
            Category = TechnologyCategory.Military,
            Year = 1860,
            BaseCost = 4500,
            Prerequisites = new() { "Bessemer_process" },
            Unlocks = new() { "dreadnoughts" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.BuildingUnlock, Target = "ironclad" },
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "ship_armor", Value = 0.5f }
            }
        },
        
        ["dreadnoughts"] = new Technology
        {
            Id = "dreadnoughts",
            Name = "无畏舰",
            Category = TechnologyCategory.Military,
            Year = 1906,
            BaseCost = 10000,
            Prerequisites = new() { "ironclads", "oil_drilling" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.BuildingUnlock, Target = "dreadnought" },
                new TechEffect { Type = EffectType.MilitaryModifier, Target = "naval_power", Value = 1.0f }
            }
        }
    };
}
```

### 社会科技

```csharp
public static class SocietyTechs
{
    public static readonly Dictionary<string, Technology> Techs = new()
    {
        ["romanticism"] = new Technology
        {
            Id = "romanticism",
            Name = "浪漫主义",
            Category = TechnologyCategory.Society,
            Year = 1800,
            BaseCost = 600,
            Prerequisites = new(),
            Unlocks = new() { "nationalism" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.PopModifier, Target = "consciousness", Value = 0.1f }
            }
        },
        
        ["nationalism"] = new Technology
        {
            Id = "nationalism",
            Name = "民族主义",
            Category = TechnologyCategory.Society,
            Year = 1820,
            BaseCost = 1200,
            Prerequisites = new() { "romanticism" },
            Unlocks = new() { "mass_politics" },
            Effects = new()
            {
                new TechEffect { Type = EffectType.LawUnlock, Target = "nationhood" },
                new TechEffect { Type = EffectType.PopModifier, Target = "military_support", Value = 0.2f }
            }
        },
        
        ["mass_politics"] = new Technology
        {
            Id = "mass_politics",
            Name = "大众政治",
            Category = TechnologyCategory.Society,
            Year = 1848,
            BaseCost = 2000,
            Prerequisites = new() { "nationalism" },
            Unlocks = new() { "social_science" },
            LiteracyRequirement = 0.3f,
            Effects = new()
            {
                new TechEffect { Type = EffectType.LawUnlock, Target = "universal_suffrage" }
            }
        },
        
        ["social_science"] = new Technology
        {
            Id = "social_science",
            Name = "社会科学",
            Category = TechnologyCategory.Society,
            Year = 1860,
            BaseCost = 3000,
            Prerequisites = new() { "mass_politics" },
            LiteracyRequirement = 0.35f,
            Effects = new()
            {
                new TechEffect { Type = EffectType.ProductionModifier, Target = "research_speed", Value = 0.2f }
            }
        },
        
        ["medical_science"] = new Technology
        {
            Id = "medical_science",
            Name = "医学科学",
            Category = TechnologyCategory.Society,
            Year = 1850,
            BaseCost = 2500,
            Prerequisites = new() { "social_science" },
            LiteracyRequirement = 0.3f,
            Effects = new()
            {
                new TechEffect { Type = EffectType.PopModifier, Target = "pop_growth", Value = 0.3f }
            }
        }
    };
}
```

## 科技传播机制

```csharp
public class TechSpreadSystem
{
    // 科技传播
    public void SpreadTechnology(Country source, Technology tech)
    {
        // 向邻国传播
        var neighbors = GetNeighborCountries(source);
        
        foreach (var neighbor in neighbors)
        {
            if (neighbor.HasTechnology(tech.Id)) continue;
            
            // 计算传播概率
            float spreadChance = CalculateSpreadChance(source, neighbor, tech);
            
            if (RandomManager.Roll(spreadChance))
            {
                // 给予研究进度加成
                GiveSpreadBonus(neighbor, tech);
            }
        }
        
        // 向同盟国传播
        var allies = DiplomacyManager.Instance.GetAllies(source.Id);
        foreach (var allyId in allies)
        {
            var ally = MapData.Instance.Countries[allyId];
            if (ally.HasTechnology(tech.Id)) continue;
            
            float spreadChance = CalculateSpreadChance(source, ally, tech) * 1.5f;
            if (RandomManager.Roll(spreadChance))
            {
                GiveSpreadBonus(ally, tech);
            }
        }
    }
    
    private float CalculateSpreadChance(Country source, Country target, Technology tech)
    {
        float chance = 0.01f;  // 基础1%
        
        // 识字率差距 (目标识字率越高，越容易接受)
        chance += target.LiteracyRate * 0.05f;
        
        // 外交关系
        var relation = DiplomacyManager.Instance.GetRelation(source.Id, target.Id);
        chance += relation.Opinion * 0.0001f;
        
        // 市场整合度
        if (AreInSameMarket(source, target))
            chance *= 2;
        
        // 距离衰减
        float distance = CalculateDistance(source, target);
        chance *= Mathf.Max(0.1f, 1 - distance / 1000);
        
        return chance;
    }
    
    private void GiveSpreadBonus(Country country, Technology tech)
    {
        // 增加该科技的研究进度
        var queue = ResearchManager.Instance.CountryResearch[country.Id];
        var project = queue.ActiveProjects.FirstOrDefault(p => p.Technology.Id == tech.Id);
        
        if (project != null)
        {
            // 已有研究，加速
            project.Progress += tech.BaseCost * 0.1f;
        }
        else if (tech.CanResearch(country))
        {
            // 未开始研究，给予初始进度
            queue.ActiveProjects.Add(new ResearchProject
            {
                Technology = tech,
                Progress = tech.BaseCost * 0.05f
            });
        }
    }
}
```

## UI显示

```csharp
public partial class TechTreePanel : Panel
{
    [Export] public GraphEdit TechTreeGraph { get; set; }
    [Export] public ItemList AvailableTechs { get; set; }
    [Export] public ProgressBar ResearchProgress { get; set; }
    
    public void UpdateDisplay(int countryId)
    {
        var country = MapData.Instance.Countries[countryId];
        var tree = ResearchManager.Instance.TechTree;
        
        // 更新科技树可视化
        TechTreeGraph.ClearConnections();
        
        foreach (var tech in tree.Technologies.Values)
        {
            var node = CreateTechNode(tech, country);
            TechTreeGraph.AddChild(node);
            
            // 连接线
            foreach (var unlockId in tech.Unlocks)
            {
                var unlockNode = GetTechNode(unlockId);
                if (unlockNode != null)
                {
                    TechTreeGraph.ConnectNode(tech.Id, 0, unlockId, 0);
                }
            }
        }
        
        // 更新可研究列表
        AvailableTechs.Clear();
        var available = tree.GetAvailableTechnologies(country);
        foreach (var tech in available)
        {
            AvailableTechs.AddItem($"{tech.Name} ({tech.BaseCost}点)");
        }
    }
    
    private GraphNode CreateTechNode(Technology tech, Country country)
    {
        var node = new GraphNode();
        node.Name = tech.Id;
        node.Title = tech.Name;
        
        // 根据状态着色
        if (country.HasTechnology(tech.Id))
            node.Modulate = Colors.Green;  // 已研究
        else if (tech.CanResearch(country))
            node.Modulate = Colors.Yellow;  // 可研究
        else
            node.Modulate = Colors.Gray;  // 未解锁
        
        // 添加描述
        var label = new Label { Text = tech.Description };
        node.AddChild(label);
        
        return node;
    }
}
```

## 依赖关系

- **被依赖**: industrial_system, war_system, internal_affairs_system
- **依赖**: map_design, population_system

## 配置JSON示例

```json
{
  "research": {
    "base_slots": 1,
    "slot_unlock_techs": ["social_science"],
    "literacy_threshold": 0.1,
    "spread_base_chance": 0.01,
    "spread_neighbor_bonus": 2.0,
    "spread_ally_bonus": 1.5
  },
  "tech_categories": {
    "production": {
      "color": "#4CAF50",
      "icon": "gear"
    },
    "military": {
      "color": "#F44336", 
      "icon": "sword"
    },
    "society": {
      "color": "#2196F3",
      "icon": "book"
    }
  }
}
```
