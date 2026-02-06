# 外交系统模块

## 模块概述

本模块负责管理游戏中的外交系统，包含国家关系、外交行动、联盟体系、宿敌机制、外交谈判等功能。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用 `Dictionary<int, DiplomaticRelation>` 存储国家关系
- 使用事件系统驱动外交变化

### 核心数据结构

#### 1. DiplomaticRelation (外交关系)
```csharp
public class DiplomaticRelation
{
    public int CountryA { get; set; }
    public int CountryB { get; set; }
    
    // 关系值 (-100到+100)
    public float Opinion { get; set; }
    
    // 关系历史
    public List<OpinionChange> OpinionHistory { get; set; } = new();
    
    // 外交状态
    public bool IsAtWar { get; set; }
    public bool IsAllied { get; set; }
    public bool IsRival { get; set; }
    public bool HasTradeAgreement { get; set; }
    public bool HasNonAggressionPact { get; set; }
    public bool IsInCustomsUnion { get; set; }
    
    // 外交行动冷却
    public Dictionary<DiplomaticAction, int> ActionCooldowns { get; set; } = new();
    
    // 计算关系值
    public void CalculateOpinion()
    {
        float baseOpinion = 0;
        
        // 基础好感
        baseOpinion += GetBaseRelation();
        
        // 意识形态差异
        baseOpinion += GetIdeologyModifier();
        
        // 历史事件
        baseOpinion += GetHistoricalModifier();
        
        // 近期行动
        baseOpinion += GetRecentActionsModifier();
        
        // 利益冲突
        baseOpinion += GetInterestConflictModifier();
        
        Opinion = Mathf.Clamp(baseOpinion, -100, 100);
    }
    
    // 修改关系值
    public void ModifyOpinion(float amount, string reason)
    {
        float oldOpinion = Opinion;
        Opinion = Mathf.Clamp(Opinion + amount, -100, 100);
        
        OpinionHistory.Add(new OpinionChange
        {
            Date = GameManager.Instance.CurrentDate,
            Change = Opinion - oldOpinion,
            Reason = reason
        });
        
        // 检查外交状态变化
        CheckDiplomaticStatusChange();
    }
    
    private void CheckDiplomaticStatusChange()
    {
        // 关系过低自动断盟
        if (IsAllied && Opinion < -20)
        {
            BreakAlliance();
        }
        
        // 关系过低自动取消贸易协定
        if (HasTradeAgreement && Opinion < -30)
        {
            CancelTradeAgreement();
        }
    }
}

public struct OpinionChange
{
    public DateTime Date { get; set; }
    public float Change { get; set; }
    public string Reason { get; set; }
}
```

#### 2. DiplomaticAction (外交行动)
```csharp
public enum DiplomaticAction
{
    ImproveRelations,      // 改善关系
    SendGift,             // 赠送礼物
    FormAlliance,         // 结盟
    ProposeTradeDeal,     // 贸易协定
    ProposeNonAggression, // 互不侵犯
    GuaranteeIndependence,// 保障独立
    DeclareRivalry,       // 宣布宿敌
    DeclareWar,          // 宣战
    DemandConcession,    // 要求让步
    Insult,              // 羞辱
    Embargo,             // 禁运
    ExpelDiplomats,      // 驱逐外交官
    JustifyWarGoal       // 制造战争借口
}

public class DiplomaticActionResult
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public float OpinionChange { get; set; }
    public int InfamyChange { get; set; }
}

public class DiplomaticActionHandler
{
    // 执行外交行动
    public static DiplomaticActionResult Execute(
        DiplomaticAction action, int actorId, int targetId, object parameters = null)
    {
        var actor = MapData.Instance.Countries[actorId];
        var target = MapData.Instance.Countries[targetId];
        var relation = DiplomacyManager.Instance.GetRelation(actorId, targetId);
        
        return action switch
        {
            DiplomaticAction.ImproveRelations => ImproveRelations(actor, target, relation),
            DiplomaticAction.SendGift => SendGift(actor, target, relation, (float)parameters),
            DiplomaticAction.FormAlliance => FormAlliance(actor, target, relation),
            DiplomaticAction.DeclareWar => DeclareWar(actor, target, relation, (WarGoal)parameters),
            DiplomaticAction.DeclareRivalry => DeclareRivalry(actor, target, relation),
            _ => new DiplomaticActionResult { Success = false, Message = "未实现" }
        };
    }
    
    private static DiplomaticActionResult ImproveRelations(
        Country actor, Country target, DiplomaticRelation relation)
    {
        // 检查冷却
        if (relation.ActionCooldowns.GetValueOrDefault(DiplomaticAction.ImproveRelations, 0) > 0)
        {
            return new DiplomaticActionResult 
            { 
                Success = false, 
                Message = "改善关系行动正在冷却中" 
            };
        }
        
        // 消耗外交点数/资金
        float cost = 50;
        if (actor.Treasury < cost)
        {
            return new DiplomaticActionResult 
            { 
                Success = false, 
                Message = "资金不足" 
            };
        }
        
        actor.Treasury -= cost;
        
        // 修改关系
        float opinionGain = 15;
        relation.ModifyOpinion(opinionGain, "改善关系");
        
        // 设置冷却
        relation.ActionCooldowns[DiplomaticAction.ImproveRelations] = 180; // 180天
        
        return new DiplomaticActionResult
        {
            Success = true,
            Message = $"与{target.Name}的关系改善了{opinionGain}点",
            OpinionChange = opinionGain
        };
    }
    
    private static DiplomaticActionResult FormAlliance(
        Country actor, Country target, DiplomaticRelation relation)
    {
        // 检查条件
        if (relation.Opinion < 50)
        {
            return new DiplomaticActionResult 
            { 
                Success = false, 
                Message = "关系不够友好 (需要50+)" 
            };
        }
        
        if (relation.IsRival)
        {
            return new DiplomaticActionResult 
            { 
                Success = false, 
                Message = "不能和宿敌结盟" 
            };
        }
        
        if (relation.IsAllied)
        {
            return new DiplomaticActionResult 
            { 
                Success = false, 
                Message = "已经结盟" 
            };
        }
        
        // AI决策
        if (target.IsAI)
        {
            float acceptChance = CalculateAllianceAcceptChance(actor, target, relation);
            if (!RandomManager.Roll(acceptChance))
            {
                return new DiplomaticActionResult 
                { 
                    Success = false, 
                    Message = $"{target.Name}拒绝了结盟请求" 
                };
            }
        }
        
        // 执行结盟
        relation.IsAllied = true;
        
        // 修改关系
        relation.ModifyOpinion(20, "建立同盟");
        
        // 触发事件
        EventManager.Instance.TriggerEvent(
            new AllianceFormedEvent(actor, target));
        
        return new DiplomaticActionResult
        {
            Success = true,
            Message = $"与{target.Name}建立了同盟",
            OpinionChange = 20
        };
    }
    
    private static DiplomaticActionResult DeclareWar(
        Country actor, Country target, DiplomaticRelation relation, WarGoal goal)
    {
        // 检查是否有战争借口
        if (!HasValidCasusBelli(actor, target, goal))
        {
            // 无端战争增加恶名
            actor.Infamy += 10;
        }
        
        // 检查盟约
        if (relation.HasNonAggressionPact)
        {
            actor.Infamy += 5;
            relation.HasNonAggressionPact = false;
        }
        
        // 宣战
        var war = WarManager.Instance.DeclareWar(actor.Id, target.Id, new List<WarGoal> { goal });
        
        // 断交
        BreakRelations(actor, target, relation);
        
        // 触发事件
        EventManager.Instance.TriggerEvent(
            new WarDeclaredEvent(war));
        
        return new DiplomaticActionResult
        {
            Success = true,
            Message = $"向{target.Name}宣战",
            InfamyChange = 5
        };
    }
    
    private static DiplomaticActionResult DeclareRivalry(
        Country actor, Country target, DiplomaticRelation relation)
    {
        // 检查是否已经是宿敌
        if (relation.IsRival)
        {
            return new DiplomaticActionResult 
            { 
                Success = false, 
                Message = "已经是宿敌" 
            };
        }
        
        // 检查宿敌数量限制
        int currentRivals = DiplomacyManager.Instance.GetRivals(actor.Id).Count;
        int maxRivals = CalculateMaxRivals(actor);
        
        if (currentRivals >= maxRivals)
        {
            return new DiplomaticActionResult 
            { 
                Success = false, 
                Message = $"宿敌数量已达上限 ({maxRivals})" 
            };
        }
        
        // 设置宿敌
        relation.IsRival = true;
        
        // 关系惩罚
        relation.ModifyOpinion(-50, "宣布宿敌");
        
        // 触发事件
        EventManager.Instance.TriggerEvent(
            new RivalryDeclaredEvent(actor, target));
        
        return new DiplomaticActionResult
        {
            Success = true,
            Message = $"将{target.Name}列为宿敌",
            OpinionChange = -50
        };
    }
}
```

#### 3. DiplomacyManager (外交管理器)
```csharp
public partial class DiplomacyManager : Node
{
    public static DiplomacyManager Instance { get; private set; }
    
    // 所有外交关系
    public Dictionary<(int, int), DiplomaticRelation> Relations { get; private set; }
    
    // 势力范围
    public Dictionary<int, SphereOfInfluence> Spheres { get; private set; }
    
    public override void _Ready()
    {
        Instance = this;
        InitializeRelations();
    }
    
    private void InitializeRelations()
    {
        Relations = new Dictionary<(int, int), DiplomaticRelation>();
        
        var countries = MapData.Instance.Countries;
        
        // 初始化所有国家对关系
        for (int i = 0; i < countries.Length; i++)
        {
            for (int j = i + 1; j < countries.Length; j++)
            {
                var relation = new DiplomaticRelation
                {
                    CountryA = countries[i].Id,
                    CountryB = countries[j].Id,
                    Opinion = CalculateInitialOpinion(countries[i], countries[j])
                };
                
                Relations[(i, j)] = relation;
            }
        }
    }
    
    private float CalculateInitialOpinion(Country a, Country b)
    {
        float opinion = 0;
        
        // 距离因素 (邻国初始关系较低)
        if (AreNeighbors(a, b))
        {
            opinion -= 10;
        }
        
        // 相对实力
        float strengthDiff = Mathf.Abs(a.CalculateStrength() - b.CalculateStrength());
        opinion -= strengthDiff * 0.01f;
        
        // 随机因素
        opinion += RandomManager.RandfRange(-20, 20);
        
        return opinion;
    }
    
    public DiplomaticRelation GetRelation(int countryA, int countryB)
    {
        if (countryA > countryB)
            (countryA, countryB) = (countryB, countryA);
        
        return Relations.GetValueOrDefault((countryA, countryB));
    }
    
    // 获取所有盟友
    public List<int> GetAllies(int countryId)
    {
        var allies = new List<int>();
        
        foreach (var relation in Relations.Values)
        {
            if (relation.IsAllied && 
                (relation.CountryA == countryId || relation.CountryB == countryId))
            {
                allies.Add(relation.CountryA == countryId ? relation.CountryB : relation.CountryA);
            }
        }
        
        return allies;
    }
    
    // 获取所有宿敌
    public List<int> GetRivals(int countryId)
    {
        var rivals = new List<int>();
        
        foreach (var relation in Relations.Values)
        {
            if (relation.IsRival && 
                (relation.CountryA == countryId || relation.CountryB == countryId))
            {
                rivals.Add(relation.CountryA == countryId ? relation.CountryB : relation.CountryA);
            }
        }
        
        return rivals;
    }
    
    // 检查是否会加入战争
    public bool WillJoinWar(int countryId, int warId, bool attackerSide)
    {
        var war = WarManager.Instance.ActiveWars.FirstOrDefault(w => w.Id == warId);
        if (war == null) return false;
        
        var allies = GetAllies(countryId);
        
        if (attackerSide)
        {
            // 检查是否是攻击方的盟友
            return allies.Contains(war.Attacker.LeaderId);
        }
        else
        {
            // 检查是否是防御方的盟友
            return allies.Contains(war.Defender.LeaderId);
        }
    }
    
    // 每日更新
    public void DailyUpdate()
    {
        // 更新关系冷却
        foreach (var relation in Relations.Values)
        {
            foreach (var action in relation.ActionCooldowns.Keys.ToList())
            {
                if (relation.ActionCooldowns[action] > 0)
                    relation.ActionCooldowns[action]--;
            }
        }
        
        // 衰减关系值 (向0回归)
        foreach (var relation in Relations.Values)
        {
            if (relation.Opinion > 0)
                relation.Opinion -= 0.01f;
            else if (relation.Opinion < 0)
                relation.Opinion += 0.01f;
            
            relation.Opinion = Mathf.Clamp(relation.Opinion, -100, 100);
        }
    }
    
    // AI外交决策
    public void ProcessAIDiplomacy(int countryId)
    {
        var country = MapData.Instance.Countries[countryId];
        if (!country.IsAI) return;
        
        // 寻找潜在盟友
        FindPotentialAllies(country);
        
        // 寻找宿敌
        FindRivals(country);
        
        // 检查战争借口
        CheckWarGoals(country);
    }
    
    private void FindPotentialAllies(Country country)
    {
        foreach (var other in MapData.Instance.Countries)
        {
            if (other.Id == country.Id) continue;
            
            var relation = GetRelation(country.Id, other.Id);
            if (relation == null || relation.IsAllied || relation.IsRival) continue;
            
            // 检查结盟意愿
            float allianceDesire = CalculateAllianceDesire(country, other, relation);
            
            if (RandomManager.Roll(allianceDesire))
            {
                DiplomaticActionHandler.Execute(
                    DiplomaticAction.FormAlliance, country.Id, other.Id);
            }
        }
    }
}
```

#### 4. SphereOfInfluence (势力范围)
```csharp
public class SphereOfInfluence
{
    public int GreatPowerId { get; set; }           // 主导大国
    public List<int> MemberIds { get; set; }       // 成员国
    public float InfluenceLevel { get; set; }       // 影响力等级
    
    // 添加成员国
    public bool AddMember(int countryId)
    {
        var country = MapData.Instance.Countries[countryId];
        var greatPower = MapData.Instance.Countries[GreatPowerId];
        
        // 检查实力差距
        if (country.CalculateStrength() > greatPower.CalculateStrength() * 0.5f)
            return false;
        
        MemberIds.Add(countryId);
        
        // 修改外交关系
        var relation = DiplomacyManager.Instance.GetRelation(GreatPowerId, countryId);
        relation.IsAllied = true;
        relation.HasTradeAgreement = true;
        
        return true;
    }
    
    // 影响力衰减检查
    public void CheckInfluenceDecay()
    {
        var greatPower = MapData.Instance.Countries[GreatPowerId];
        
        foreach (var memberId in MemberIds.ToList())
        {
            var member = MapData.Instance.Countries[memberId];
            
            // 如果成员国实力增长，可能脱离势力范围
            if (member.CalculateStrength() > greatPower.CalculateStrength() * 0.6f)
            {
                float leaveChance = 0.01f;
                if (RandomManager.Roll(leaveChance))
                {
                    RemoveMember(memberId);
                }
            }
        }
    }
}
```

#### 5. CasusBelli (战争借口)
```csharp
public class CasusBelli
{
    public CasusBelliType Type { get; set; }
    public int TargetCountryId { get; set; }
    public int? TargetProvinceId { get; set; }
    public DateTime ExpirationDate { get; set; }
    public float WarScoreCostModifier { get; set; }
    public float InfamyModifier { get; set; }
    
    public bool IsValid => GameManager.Instance.CurrentDate < ExpirationDate;
}

public enum CasusBelliType
{
    Conquest,           // 征服
    Reconquest,         // 收复失地
    Liberation,         // 解放
    Humiliation,        // 羞辱
    Colonial,          // 殖民
    Nationalist,       // 民族主义
    Imperialism        // 帝国主义
}

public class CasusBelliGenerator
{
    // 制造战争借口
    public static void JustifyWarGoal(
        int actorId, int targetId, CasusBelliType type, int? targetProvince = null)
    {
        var actor = MapData.Instance.Countries[actorId];
        var target = MapData.Instance.Countries[targetId];
        
        // 启动外交博弈
        var play = new DiplomaticPlay
        {
            InitiatorId = actorId,
            TargetId = targetId,
            CasusBelliType = type,
            TargetProvinceId = targetProvince,
            StartDate = GameManager.Instance.CurrentDate,
            Duration = 180  // 180天博弈期
        };
        
        DiplomacyManager.Instance.ActivePlays.Add(play);
        
        // 通知相关国家
        NotifyPotentialParticipants(play);
    }
    
    // 检查是否获得战争借口
    public static void CheckCasusBelliProgress(DiplomaticPlay play)
    {
        // 计算支持度
        float initiatorSupport = CalculateSupport(play.InitiatorId, play);
        float targetSupport = CalculateSupport(play.TargetId, play);
        
        // 如果博弈到期
        if (GameManager.Instance.CurrentDate >= play.StartDate.AddDays(play.Duration))
        {
            if (initiatorSupport > targetSupport)
            {
                // 外交博弈胜利，获得战争借口
                GrantCasusBelli(play);
            }
            else
            {
                // 外交博弈失败
                CancelDiplomaticPlay(play);
            }
        }
        
        // 如果一方支持度显著领先，可以提前结束
        if (initiatorSupport > targetSupport * 2)
        {
            GrantCasusBelli(play);
        }
        else if (targetSupport > initiatorSupport * 2)
        {
            CancelDiplomaticPlay(play);
        }
    }
}
```

## UI显示

```csharp
public partial class DiplomacyPanel : Panel
{
    [Export] public ItemList CountryList { get; set; }
    [Export] public Label OpinionLabel { get; set; }
    [Export] public VBoxContainer ActionList { get; set; }
    [Export] public ProgressBar OpinionBar { get; set; }
    
    private int _selectedCountryId = -1;
    private int _playerCountryId;
    
    public void SetPlayerCountry(int countryId)
    {
        _playerCountryId = countryId;
        UpdateCountryList();
    }
    
    private void UpdateCountryList()
    {
        CountryList.Clear();
        
        foreach (var country in MapData.Instance.Countries)
        {
            if (country.Id == _playerCountryId) continue;
            
            var relation = DiplomacyManager.Instance.GetRelation(_playerCountryId, country.Id);
            string status = GetRelationStatusString(relation);
            
            CountryList.AddItem($"{country.Name} ({status})");
        }
    }
    
    private void OnCountrySelected(int index)
    {
        _selectedCountryId = GetCountryIdAtIndex(index);
        UpdateRelationDisplay();
        UpdateActionButtons();
    }
    
    private void UpdateRelationDisplay()
    {
        var relation = DiplomacyManager.Instance.GetRelation(_playerCountryId, _selectedCountryId);
        var country = MapData.Instance.Countries[_selectedCountryId];
        
        OpinionLabel.Text = $"与{country.Name}的关系: {relation.Opinion:F0}";
        OpinionBar.Value = (relation.Opinion + 100) / 2;  // -100到100映射到0-100
        
        // 显示关系状态
        var statusLabel = new Label();
        statusLabel.Text = $"状态: {(relation.IsAllied ? "盟友" : relation.IsRival ? "宿敌" : "中立")}";
    }
    
    private void UpdateActionButtons()
    {
        // 清除旧按钮
        foreach (var child in ActionList.GetChildren())
            child.QueueFree();
        
        var relation = DiplomacyManager.Instance.GetRelation(_playerCountryId, _selectedCountryId);
        
        // 添加可用行动按钮
        if (!relation.IsAllied)
        {
            AddActionButton("结盟", () => OnAllianceClick());
        }
        
        if (!relation.IsRival && !relation.IsAllied)
        {
            AddActionButton("宣布宿敌", () => OnRivalryClick());
        }
        
        AddActionButton("改善关系", () => OnImproveRelationsClick());
        AddActionButton("宣战", () => OnDeclareWarClick());
    }
    
    private void AddActionButton(string text, Action callback)
    {
        var button = new Button { Text = text };
        button.Pressed += callback;
        ActionList.AddChild(button);
    }
}
```

## 依赖关系

- **被依赖**: war_system, internal_affairs_system, event_system
- **依赖**: map_design, population_system

## 配置示例

```json
{
  "diplomacy": {
    "max_rivals_formula": "3 + prestige / 100",
    "base_improve_relation_cost": 50,
    "improve_relation_opinion_gain": 15,
    "improve_relation_cooldown": 180,
    "alliance_opinion_requirement": 50,
    "rivalry_opinion_penalty": -50,
    "neighbor_base_opinion": -10,
    "opinion_decay_rate": 0.01
  },
  "diplomatic_plays": {
    "base_duration": 180,
    "early_resolution_threshold": 2.0,
    "support_calculation": {
      "alliance_weight": 1.5,
      "rival_weight": -1.0,
      "interest_weight": 0.5,
      "power_weight": 0.3
    }
  }
}
```
