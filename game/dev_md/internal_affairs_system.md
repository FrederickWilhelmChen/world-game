# 内政系统模块

## 模块概述

本模块负责管理游戏中的内政系统，包含法律制定、政府改革、社会稳定、宫廷运作、利益集团互动等机制。玩家通过国家法律影响经济、社会、军事各方面。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用 `Resource` 保存法律配置
- 使用事件系统驱动政治变化

### 核心数据结构

#### 1. LawType (法律类型)
```csharp
public enum MigrationLawType
{
    Open,           // 开放边界 - 自由移民
    Limited,        // 限制移民 - 需要条件
    Closed          // 封闭边界 - 禁止移民
}

public enum SerfdomLawType
{
    Serfdom,        // 农奴制 - 农民绑定土地
    TenantFarming,  // 佃农制 - 支付地租
    FreePeasants    // 自由农民 - 自由择业
}

public enum ElectionLawType
{
    NoElections,        // 无选举 - 独裁/君主专制
    WealthWeighted,     // 财产加权 - 富人更多投票权
    MaleUniversal,      // 男性普选
    UniversalSuffrage   // 普选
}

public enum MarketLawType
{
    FreeMarket,         // 自由市场 - 私人自由建造
    Interventionism,    // 干预主义 - 政府可以补贴
    PlannedEconomy      // 计划经济 - 政府决定建造
}

public enum ConscriptionLawType
{
    Levies,             // 征召制 - 战时临时征召
    Volunteer,          // 志愿兵 - 职业军队
    Professional        // 职业军队 - 精英部队
}
```

#### 2. Laws (法律集合)
```csharp
public class Laws
{
    public MigrationLawType MigrationLaw { get; set; } = MigrationLawType.Limited;
    public SerfdomLawType SerfdomLaw { get; set; } = SerfdomLawType.Serfdom;
    public ElectionLawType ElectionLaw { get; set; } = ElectionLawType.NoElections;
    public MarketLawType MarketLaw { get; set; } = MarketLawType.FreeMarket;
    public ConscriptionLawType ConscriptionLaw { get; set; } = ConscriptionLawType.Levies;
    
    // 计算法律组合的稳定度影响
    public float CalculateStabilityModifier()
    {
        float modifier = 0;
        
        // 开放移民可能引发民族主义反弹
        if (MigrationLaw == MigrationLawType.Open)
            modifier -= 5;
        
        // 农奴制降低稳定度
        if (SerfdomLaw == SerfdomLawType.Serfdom)
            modifier -= 10;
        
        // 选举提高合法性
        if (ElectionLaw >= ElectionLawType.WealthWeighted)
            modifier += 5;
        
        return modifier;
    }
    
    // 计算政治改革难度
    public float CalculateReformDifficulty(LawType type, object newValue)
    {
        float difficulty = 1.0f;
        
        // 激进的改革更难通过
        switch (type)
        {
            case LawType.Serfdom:
                var currentSerfdom = (SerfdomLawType)newValue;
                if (SerfdomLaw == SerfdomLawType.Serfdom && 
                    currentSerfdom == SerfdomLawType.FreePeasants)
                    difficulty = 2.0f;  // 废除农奴制很难
                break;
                
            case LawType.Election:
                var currentElection = (ElectionLawType)newValue;
                if (ElectionLaw == ElectionLawType.NoElections && 
                    currentElection == ElectionLawType.UniversalSuffrage)
                    difficulty = 3.0f;  // 一步到普选极难
                break;
        }
        
        return difficulty;
    }
}
```

#### 3. InterestGroup (利益集团)
```csharp
public class InterestGroup
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    
    // 集团影响力 (0-100)
    public float Influence { get; set; }
    
    // 支持度
    public float Approval { get; set; }  // -100到+100
    
    // 政治力量
    public float PoliticalPower => CalculatePoliticalPower();
    
    // 成员POP类型
    public List<PopType> MemberTypes { get; set; }
    
    // 政治立场
    public Dictionary<LawType, float> LawPreferences { get; set; }
    
    // 法律支持度计算
    public float GetLawApproval(LawType type, object value)
    {
        if (!LawPreferences.ContainsKey(type))
            return 0;
        
        float preference = LawPreferences[type];
        
        // 将法律值转换为数值进行比较
        float lawValue = ConvertLawToValue(type, value);
        
        // 计算差异
        float difference = Mathf.Abs(preference - lawValue);
        
        // 转换为支持度 (0差异 = 100支持, 最大差异 = -100支持)
        return 100 - difference * 2;
    }
    
    // 更新支持度
    public void UpdateApproval(Country country)
    {
        float totalApproval = 0;
        int count = 0;
        
        // 对当前所有法律的满意度
        foreach (var lawType in Enum.GetValues<LawType>())
        {
            var currentValue = GetCurrentLawValue(country, lawType);
            totalApproval += GetLawApproval(lawType, currentValue);
            count++;
        }
        
        // 平均支持度
        Approval = totalApproval / count;
        
        // 需求满足度影响
        float avgNeedsFulfillment = GetMemberNeedsFulfillment(country);
        Approval += (avgNeedsFulfillment - 0.5f) * 40;
        
        Approval = Mathf.Clamp(Approval, -100, 100);
    }
    
    private float CalculatePoliticalPower()
    {
        // 影响力 * 支持度修正
        float power = Influence;
        
        if (Approval > 50)
            power *= 1.2f;
        else if (Approval < -50)
            power *= 0.8f;
        
        return power;
    }
}
```

#### 4. Government (政府)
```csharp
public class Government
{
    public int CountryId { get; set; }
    
    // 政府类型
    public GovernmentType Type { get; set; }
    
    // 统治者
    public Ruler CurrentRuler { get; set; }
    
    // 利益集团
    public List<InterestGroup> InterestGroups { get; set; }
    
    // 合法性 (0-100)
    public float Legitimacy { get; set; }
    
    // 政治改革队列
    public List<PoliticalReform> ReformQueue { get; set; }
    
    // 当前执政集团
    public InterestGroup RulingGroup { get; set; }
    
    // 政府稳定性
    public float Stability => CalculateStability();
    
    private float CalculateStability()
    {
        float stability = 50;  // 基础稳定度
        
        // 合法性影响
        stability += (Legitimacy - 50) * 0.5f;
        
        // 利益集团平均支持度
        float avgApproval = InterestGroups.Average(g => g.Approval);
        stability += avgApproval * 0.3f;
        
        // 执政集团支持度特别重要
        if (RulingGroup != null)
        {
            stability += RulingGroup.Approval * 0.2f;
        }
        
        return Mathf.Clamp(stability, 0, 100);
    }
    
    // 尝试改革
    public ReformResult AttemptReform(LawType lawType, object newValue)
    {
        var country = MapData.Instance.Countries[CountryId];
        
        // 检查改革条件
        if (!CanReform(lawType, newValue))
        {
            return new ReformResult
            {
                Success = false,
                Reason = "不满足改革前提条件"
            };
        }
        
        // 计算改革支持度
        float reformSupport = CalculateReformSupport(lawType, newValue);
        
        if (reformSupport < 50)
        {
            // 支持度不足，改革失败
            return new ReformResult
            {
                Success = false,
                Reason = "利益集团反对",
                OppositionGroups = GetOpposingGroups(lawType, newValue)
            };
        }
        
        // 开始改革
        var reform = new PoliticalReform
        {
            LawType = lawType,
            NewValue = newValue,
            StartDate = GameManager.Instance.CurrentDate,
            Duration = CalculateReformDuration(lawType, newValue),
            Progress = 0,
            Support = reformSupport
        };
        
        ReformQueue.Add(reform);
        
        return new ReformResult
        {
            Success = true,
            Reform = reform
        };
    }
    
    private float CalculateReformSupport(LawType lawType, object newValue)
    {
        float totalPower = 0;
        float supportingPower = 0;
        
        foreach (var group in InterestGroups)
        {
            float power = group.PoliticalPower;
            totalPower += power;
            
            float approval = group.GetLawApproval(lawType, newValue);
            if (approval > 0)
            {
                supportingPower += power * (approval / 100);
            }
        }
        
        return totalPower > 0 ? (supportingPower / totalPower) * 100 : 0;
    }
    
    // 每日更新
    public void DailyUpdate()
    {
        // 更新各集团支持度
        foreach (var group in InterestGroups)
        {
            group.UpdateApproval(MapData.Instance.Countries[CountryId]);
        }
        
        // 处理改革进度
        ProcessReforms();
        
        // 检查革命风险
        CheckRevolutionRisk();
    }
    
    private void ProcessReforms()
    {
        foreach (var reform in ReformQueue.ToList())
        {
            reform.Progress += CalculateDailyReformProgress(reform);
            
            if (reform.Progress >= reform.Duration)
            {
                // 改革完成
                ApplyReform(reform);
                ReformQueue.Remove(reform);
            }
        }
    }
    
    private void ApplyReform(PoliticalReform reform)
    {
        var country = MapData.Instance.Countries[CountryId];
        
        // 应用新法律
        SetLawValue(country, reform.LawType, reform.NewValue);
        
        // 触发事件
        EventManager.Instance.TriggerEvent(
            new LawReformedEvent(country, reform.LawType, reform.NewValue));
        
        // 修改合法性
        Legitimacy += reform.Support > 70 ? 5 : -5;
    }
}

public enum GovernmentType
{
    AbsoluteMonarchy,    // 绝对君主制
    ConstitutionalMonarchy, // 君主立宪
    PresidentialRepublic,   // 总统共和
    ParliamentaryRepublic   // 议会共和
}

public class Ruler
{
    public string Name { get; set; }
    public DateTime BirthDate { get; set; }
    public DateTime? DeathDate { get; set; }
    
    // 特质
    public List<RulerTrait> Traits { get; set; }
    
    // 能力
    public float MilitarySkill { get; set; }    // 军事
    public float DiplomaticSkill { get; set; }  // 外交
    public float AdministrativeSkill { get; set; } // 行政
    
    public int Age => (GameManager.Instance.CurrentDate - BirthDate).Days / 365;
    
    public bool IsAlive => DeathDate == null;
}

public class PoliticalReform
{
    public LawType LawType { get; set; }
    public object NewValue { get; set; }
    public DateTime StartDate { get; set; }
    public int Duration { get; set; }
    public float Progress { get; set; }
    public float Support { get; set; }
}

public class ReformResult
{
    public bool Success { get; set; }
    public string Reason { get; set; }
    public PoliticalReform Reform { get; set; }
    public List<InterestGroup> OppositionGroups { get; set; }
}
```

#### 5. InternalAffairsManager (内政管理器)
```csharp
public partial class InternalAffairsManager : Node
{
    public static InternalAffairsManager Instance { get; private set; }
    
    public Dictionary<int, Government> Governments { get; private set; }
    public Dictionary<string, InterestGroup> InterestGroupTemplates { get; private set; }
    
    public override void _Ready()
    {
        Instance = this;
        LoadInterestGroupTemplates();
    }
    
    public void Initialize()
    {
        Governments = new Dictionary<int, Government>();
        
        foreach (var country in MapData.Instance.Countries)
        {
            var government = new Government
            {
                CountryId = country.Id,
                Type = DetermineInitialGovernmentType(country),
                InterestGroups = GenerateInterestGroups(country),
                Legitimacy = 60,
                ReformQueue = new List<PoliticalReform>()
            };
            
            // 选择执政集团
            government.RulingGroup = government.InterestGroups
                .OrderByDescending(g => g.Influence)
                .First();
            
            Governments[country.Id] = government;
        }
    }
    
    private List<InterestGroup> GenerateInterestGroups(Country country)
    {
        var groups = new List<InterestGroup>();
        
        // 根据国家的POP构成生成利益集团
        var popsByType = country.OwnedProvinces
            .SelectMany(p => MapData.Instance.Provinces[p].Population)
            .GroupBy(p => p.Type)
            .ToDictionary(g => g.Key, g => g.Sum(p => p.Count));
        
        // 地主集团 (如果有足够贵族/农民)
        if (popsByType.GetValueOrDefault(PopType.Aristocrat, 0) > 100)
        {
            groups.Add(new InterestGroup
            {
                Id = "landowners",
                Name = "地主集团",
                Influence = 40,
                MemberTypes = new() { PopType.Aristocrat, PopType.Peasant },
                LawPreferences = new()
                {
                    [LawType.Serfdom] = 1,  // 支持农奴制
                    [LawType.Election] = 0  // 反对选举
                }
            });
        }
        
        // 工业家集团
        if (popsByType.GetValueOrDefault(PopType.Capitalist, 0) > 50)
        {
            groups.Add(new InterestGroup
            {
                Id = "industrialists",
                Name = "工业家集团",
                Influence = 30,
                MemberTypes = new() { PopType.Capitalist, PopType.Machinist },
                LawPreferences = new()
                {
                    [LawType.Market] = 2,   // 支持自由市场
                    [LawType.Serfdom] = 0   // 反对农奴制
                }
            });
        }
        
        // 知识分子集团
        if (country.LiteracyRate > 0.2f)
        {
            groups.Add(new InterestGroup
            {
                Id = "intellectuals",
                Name = "知识分子",
                Influence = 20,
                MemberTypes = new() { PopType.Clerk, PopType.Bureaucrat },
                LawPreferences = new()
                {
                    [LawType.Election] = 2,  // 支持选举
                    [LawType.Migration] = 1  // 支持开放移民
                }
            });
        }
        
        // 军队集团
        groups.Add(new InterestGroup
        {
            Id = "military",
            Name = "军方",
            Influence = 25,
            MemberTypes = new() { PopType.Soldier },
            LawPreferences = new()
            {
                [LawType.Conscription] = 2  // 支持强征兵制
            }
        });
        
        return groups;
    }
    
    // 每日更新
    public void DailyUpdate()
    {
        foreach (var government in Governments.Values)
        {
            government.DailyUpdate();
            
            // AI政治决策
            if (MapData.Instance.Countries[government.CountryId].IsAI)
            {
                ProcessAIPolitics(government);
            }
        }
    }
    
    private void ProcessAIPolitics(Government government)
    {
        // AI根据集团压力尝试改革
        foreach (var group in government.InterestGroups)
        {
            if (group.Approval < -30 && group.Influence > 30)
            {
                // 影响力大的不满集团可能引发改革压力
                TryReformToPleaseGroup(government, group);
            }
        }
    }
}
```

## 法律效果详解

### 移民法效果

```csharp
public static class MigrationLawEffects
{
    public static void Apply(MigrationLawType law, Country country)
    {
        switch (law)
        {
            case MigrationLawType.Open:
                // 自由移民
                country.MigrationAttractiveness = 1.5f;
                country.EmigrationRate = 1.0f;
                break;
                
            case MigrationLawType.Limited:
                // 限制移民
                country.MigrationAttractiveness = 1.0f;
                country.EmigrationRate = 0.8f;
                break;
                
            case MigrationLawType.Closed:
                // 禁止移民
                country.MigrationAttractiveness = 0.3f;
                country.EmigrationRate = 0.5f;
                break;
        }
    }
}
```

### 农奴制效果

```csharp
public static class SerfdomLawEffects
{
    public static void Apply(SerfdomLawType law, Country country)
    {
        switch (law)
        {
            case SerfdomLawType.Serfdom:
                // 农奴制: 农民不能自由转职，农业产出+10%，工业发展-20%
                country.Modifiers.AgricultureOutput += 0.1f;
                country.Modifiers.IndustrialGrowth -= 0.2f;
                country.AllowPeasantPromotion = false;
                break;
                
            case SerfdomLawType.TenantFarming:
                // 佃农制: 农民可以转职但需要支付违约金
                country.Modifiers.AgricultureOutput += 0.05f;
                country.AllowPeasantPromotion = true;
                country.PeasantPromotionCost = 10;  // 转职成本
                break;
                
            case SerfdomLawType.FreePeasants:
                // 自由农民: 完全自由转职，农业产出-5%，工业发展+10%
                country.Modifiers.AgricultureOutput -= 0.05f;
                country.Modifiers.IndustrialGrowth += 0.1f;
                country.AllowPeasantPromotion = true;
                country.PeasantPromotionCost = 0;
                break;
        }
    }
}
```

### 选举法效果

```csharp
public static class ElectionLawEffects
{
    public static void Apply(ElectionLawType law, Country country)
    {
        var government = InternalAffairsManager.Instance.Governments[country.Id];
        
        switch (law)
        {
            case ElectionLawType.NoElections:
                government.LegitimacyBase = 40;
                country.Modifiers.ResearchSpeed -= 0.1f;
                break;
                
            case ElectionLawType.WealthWeighted:
                government.LegitimacyBase = 50;
                // 资本家政治力量加成
                var capitalists = government.InterestGroups
                    .FirstOrDefault(g => g.Id == "capitalists");
                if (capitalists != null) capitalists.Influence *= 1.2f;
                break;
                
            case ElectionLawType.MaleUniversal:
                government.LegitimacyBase = 60;
                country.Modifiers.ResearchSpeed += 0.1f;
                break;
                
            case ElectionLawType.UniversalSuffrage:
                government.LegitimacyBase = 70;
                country.Modifiers.ResearchSpeed += 0.15f;
                // 民众政治意识提高
                country.Modifiers.ConsciousnessGrowth += 0.2f;
                break;
        }
    }
}
```

### 市场法效果

```csharp
public static class MarketLawEffects
{
    public static void Apply(MarketLawType law, Country country)
    {
        switch (law)
        {
            case MarketLawType.FreeMarket:
                // 自由市场: 私人自由建造，市场效率+20%
                country.CanPrivateBuild = true;
                country.CanGovernmentBuild = false;
                country.MarketEfficiency += 0.2f;
                break;
                
            case MarketLawType.Interventionism:
                // 干预主义: 政府可以补贴关键产业
                country.CanPrivateBuild = true;
                country.CanGovernmentBuild = true;
                country.BuildingSubsidyEnabled = true;
                country.MarketEfficiency += 0.1f;
                break;
                
            case MarketLawType.PlannedEconomy:
                // 计划经济: 政府决定所有建造
                country.CanPrivateBuild = false;
                country.CanGovernmentBuild = true;
                country.MarketEfficiency -= 0.1f;
                country.IndustrialGrowth += 0.1f;  // 集中力量发展工业
                break;
        }
    }
}
```

### 兵役法效果

```csharp
public static class ConscriptionLawEffects
{
    public static void Apply(ConscriptionLawType law, Country country)
    {
        switch (law)
        {
            case ConscriptionLawType.Levies:
                // 征召制: 高人力，低质量
                country.Military.ManpowerMultiplier = 1.5f;
                country.Military.UnitQuality = 0.8f;
                country.Military.MaintenanceCost = 0.7f;
                break;
                
            case ConscriptionLawType.Volunteer:
                // 志愿兵: 平衡
                country.Military.ManpowerMultiplier = 1.0f;
                country.Military.UnitQuality = 1.0f;
                country.Military.MaintenanceCost = 1.0f;
                break;
                
            case ConscriptionLawType.Professional:
                // 职业军队: 低人力，高质量
                country.Military.ManpowerMultiplier = 0.7f;
                country.Military.UnitQuality = 1.3f;
                country.Military.MaintenanceCost = 1.5f;
                break;
        }
    }
}
```

## 革命机制

```csharp
public class RevolutionSystem
{
    // 检查革命风险
    public void CheckRevolutionRisk(Government government)
    {
        var country = MapData.Instance.Countries[government.CountryId];
        
        float revolutionRisk = 0;
        
        // 稳定度越低，风险越高
        revolutionRisk += (100 - government.Stability) * 0.5f;
        
        // 激进集团数量
        int radicalGroups = government.InterestGroups.Count(g => g.Radicalism > 70);
        revolutionRisk += radicalGroups * 10;
        
        // 经济困难
        if (country.GDPGrowth < -0.05f)
            revolutionRisk += 20;
        
        // 战争失败
        var activeWars = WarManager.Instance.ActiveWars
            .Where(w => w.Attacker.LeaderId == country.Id || w.Defender.LeaderId == country.Id);
        foreach (var war in activeWars)
        {
            if ((war.Attacker.LeaderId == country.Id && war.WarScore < -50) ||
                (war.Defender.LeaderId == country.Id && war.WarScore > 50))
            {
                revolutionRisk += 15;
            }
        }
        
        // 触发革命
        if (revolutionRisk > 80 && RandomManager.Roll(0.01f))
        {
            TriggerRevolution(government);
        }
    }
    
    private void TriggerRevolution(Government government)
    {
        var country = MapData.Instance.Countries[government.CountryId];
        
        // 确定革命集团
        var revolutionaryGroup = government.InterestGroups
            .Where(g => g.Radicalism > 50)
            .OrderByDescending(g => g.Influence)
            .First();
        
        // 创建革命
        var revolution = new Revolution
        {
            CountryId = country.Id,
            Group = revolutionaryGroup,
            StartDate = GameManager.Instance.CurrentDate,
            Strength = revolutionaryGroup.Influence * revolutionaryGroup.Radicalism / 100
        };
        
        // 触发革命事件
        EventManager.Instance.TriggerEvent(
            new RevolutionStartedEvent(country, revolution));
        
        // 革命战争或改革
        if (revolution.Strength > government.Stability)
        {
            // 革命成功，政权更迭
            ChangeGovernment(government, revolutionaryGroup);
        }
        else
        {
            // 镇压革命
            SuppressRevolution(government, revolution);
        }
    }
}

public class Revolution
{
    public int CountryId { get; set; }
    public InterestGroup Group { get; set; }
    public DateTime StartDate { get; set; }
    public float Strength { get; set; }
    public bool IsSuccessful { get; set; }
}
```

## UI显示

```csharp
public partial class GovernmentPanel : Panel
{
    [Export] public Label StabilityLabel { get; set; }
    [Export] public Label LegitimacyLabel { get; set; }
    [Export] public VBoxContainer InterestGroupsList { get; set; }
    [Export] public VBoxContainer LawsContainer { get; set; }
    
    public void UpdateDisplay(int countryId)
    {
        var government = InternalAffairsManager.Instance.Governments[countryId];
        
        // 政府状态
        StabilityLabel.Text = $"稳定度: {government.Stability:F0}";
        LegitimacyLabel.Text = $"合法性: {government.Legitimacy:F0}";
        
        // 利益集团
        UpdateInterestGroups(government);
        
        // 法律
        UpdateLaws(government);
    }
    
    private void UpdateInterestGroups(Government government)
    {
        foreach (var child in InterestGroupsList.GetChildren())
            child.QueueFree();
        
        foreach (var group in government.InterestGroups)
        {
            var row = new HBoxContainer();
            
            var nameLabel = new Label { Text = group.Name };
            var influenceBar = new ProgressBar 
            { 
                Value = group.Influence,
                MaxValue = 100,
                CustomMinimumSize = new Vector2(100, 20)
            };
            var approvalLabel = new Label 
            { 
                Text = $"支持度: {group.Approval:F0}",
                Modulate = group.Approval > 0 ? Colors.Green : Colors.Red
            };
            
            row.AddChild(nameLabel);
            row.AddChild(influenceBar);
            row.AddChild(approvalLabel);
            
            InterestGroupsList.AddChild(row);
        }
    }
    
    private void UpdateLaws(Government government)
    {
        foreach (var child in LawsContainer.GetChildren())
            child.QueueFree();
        
        var country = MapData.Instance.Countries[government.CountryId];
        
        // 移民法
        AddLawRow("移民法", country.CurrentLaws.MigrationLaw.ToString(), 
            () => OpenLawReformMenu(LawType.Migration));
        
        // 农奴制
        AddLawRow("农奴制", country.CurrentLaws.SerfdomLaw.ToString(),
            () => OpenLawReformMenu(LawType.Serfdom));
        
        // 选举法
        AddLawRow("选举法", country.CurrentLaws.ElectionLaw.ToString(),
            () => OpenLawReformMenu(LawType.Election));
        
        // 市场法
        AddLawRow("市场法", country.CurrentLaws.MarketLaw.ToString(),
            () => OpenLawReformMenu(LawType.Market));
        
        // 兵役法
        AddLawRow("兵役法", country.CurrentLaws.ConscriptionLaw.ToString(),
            () => OpenLawReformMenu(LawType.Conscription));
    }
    
    private void AddLawRow(string name, string value, Action onReform)
    {
        var row = new HBoxContainer();
        
        var nameLabel = new Label { Text = name };
        var valueLabel = new Label { Text = value };
        var reformButton = new Button { Text = "改革" };
        reformButton.Pressed += onReform;
        
        row.AddChild(nameLabel);
        row.AddChild(valueLabel);
        row.AddChild(reformButton);
        
        LawsContainer.AddChild(row);
    }
}
```

## 依赖关系

- **被依赖**: event_system
- **依赖**: map_design, population_system, market_system, war_system, tech_tree, diplomacy_system

## 配置示例

```json
{
  "government": {
    "base_legitimacy": 50,
    "reform_base_duration": 365,
    "min_reform_support": 50,
    "revolution_threshold": 80,
    "radicalization_rate": 0.01
  },
  "interest_groups": {
    "base_influence": 20,
    "max_influence": 80,
    "approval_decay": 0.1,
    "approval_gain_from_needs": 0.3
  },
  "laws": {
    "migration": {
      "open": { "migration_bonus": 0.5, "stability_penalty": -5 },
      "limited": { "migration_bonus": 0, "stability_penalty": 0 },
      "closed": { "migration_bonus": -0.7, "stability_penalty": 5 }
    },
    "serfdom": {
      "abolition_difficulty": 3.0,
      "industrial_bonus": 0.1
    }
  }
}
```
