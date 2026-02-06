# 战争系统模块

## 模块概述

本模块负责管理游戏中的战争系统，包含战争分数计算、陆军/海军战斗机制、战争目标、和平谈判等核心功能。战斗采用实时制，支持单位动画和补给线模拟。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用 `CharacterBody2D` 或 `Node2D` 作为军事单位
- 使用 `AnimationPlayer` 处理战斗动画
- 使用 `Navigation2D` 处理单位移动

### 核心数据结构

#### 1. War (战争)
```csharp
public class War
{
    public int Id { get; set; }
    public string Name { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    
    // 参战方
    public WarSide Attacker { get; set; }
    public WarSide Defender { get; set; }
    
    // 战争分数
    public float WarScore { get; set; }  // 正数进攻方优势，负数防守方优势
    public WarScoreBreakdown ScoreBreakdown { get; set; }
    
    // 战争目标
    public List<WarGoal> WarGoals { get; set; }
    
    // 战争状态
    public WarState State { get; set; }
    
    // 战争名称生成
    public static string GenerateWarName(Country attacker, Country defender, WarGoal goal)
    {
        return $"{attacker.Adjective}-{defender.Adjective}战争";
    }
    
    // 每日更新
    public void DailyUpdate()
    {
        // 计算战争分数
        CalculateWarScore();
        
        // 检查战争目标完成度
        CheckWarGoalProgress();
        
        // 检查停战条件
        if (ShouldAutoWhitePeace())
        {
            EndWar(WarEndType.WhitePeace);
        }
    }
    
    private void CalculateWarScore()
    {
        float score = 0;
        
        // 战斗胜利分数
        score += ScoreBreakdown.BattleWins * 5;
        score -= ScoreBreakdown.BattleLosses * 5;
        
        // 占领分数
        score += ScoreBreakdown.OccupiedProvinces.Count * 10;
        score -= ScoreBreakdown.LostProvinces.Count * 10;
        
        // 封锁分数
        score += ScoreBreakdown.BlockadeEfficiency * 20;
        
        // 消耗分数
        score -= ScoreBreakdown.AttackerCasualties / 1000f;
        score += ScoreBreakdown.DefenderCasualties / 1000f;
        
        WarScore = Mathf.Clamp(score, -100, 100);
    }
}

public class WarSide
{
    public int LeaderId { get; set; }              // 主导国
    public List<int> Members { get; set; }        // 所有成员国
    public float TotalManpower { get; set; }
    public float MobilizationProgress { get; set; }
}

public class WarScoreBreakdown
{
    public int BattleWins { get; set; }
    public int BattleLosses { get; set; }
    public List<int> OccupiedProvinces { get; set; }
    public List<int> LostProvinces { get; set; }
    public float BlockadeEfficiency { get; set; }
    public int AttackerCasualties { get; set; }
    public int DefenderCasualties { get; set; }
}

public enum WarState
{
    Active,        // 进行中
    Stalemate,     // 僵局
    Negotiating,   // 谈判中
    Ended          // 已结束
}

public enum WarEndType
{
    Victory,       // 胜利
    Defeat,        // 失败
    WhitePeace,    // 白和平
    Negotiated     // 谈判结束
}
```

#### 2. WarGoal (战争目标)
```csharp
public class WarGoal
{
    public WarGoalType Type { get; set; }
    public int TargetCountryId { get; set; }
    public int? TargetProvinceId { get; set; }
    public float WarScoreCost { get; set; }
    public bool IsFulfilled { get; set; }
    
    // 检查目标是否完成
    public bool CheckCompletion(War war)
    {
        return Type switch
        {
            WarGoalType.Conquest => CheckConquest(war),
            WarGoalType.TakeProvince => CheckProvinceTaken(war),
            WarGoalType.Humiliate => CheckHumiliation(war),
            WarGoalType.ForceGovernment => CheckGovernmentChange(war),
            WarGoalType.Liberate => CheckLiberation(war),
            _ => false
        };
    }
    
    private bool CheckConquest(War war)
    {
        // 征服目标：战争分数达到要求
        return Math.Abs(war.WarScore) >= WarScoreCost;
    }
    
    private bool CheckProvinceTaken(War war)
    {
        // 夺取省份：目标省份被占领
        if (!TargetProvinceId.HasValue) return false;
        var province = MapData.Instance.Provinces[TargetProvinceId.Value];
        return province.OccupierId == war.Attacker.LeaderId;
    }
}

public enum WarGoalType
{
    Conquest,           // 征服
    TakeProvince,       // 夺取省份
    Humiliate,          // 羞辱
    ForceGovernment,    // 强制政体
    Liberate,          // 解放
    Independence       // 独立
}
```

#### 3. Army (陆军)
```csharp
public class Army : Node2D
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int CountryId { get; set; }
    public int CommanderId { get; set; }
    
    // 位置
    public int CurrentProvinceId { get; set; }
    public Vector2 Position { get; set; }
    public ArmyState State { get; set; }
    
    // 部队组成
    public ArmyComposition Composition { get; set; }
    
    // 兵力状态
    public int TotalMen => Composition.TotalCount;
    public float Morale { get; set; } = 1.0f;           // 士气 0-1
    public float Organization { get; set; } = 1.0f;     // 组织度 0-1
    public float Equipment { get; set; } = 1.0f;        // 装备率 0-1
    public float Supply { get; set; } = 1.0f;           // 补给 0-1
    
    // 战斗统计
    public float TotalAttack => CalculateAttack();
    public float TotalDefense => CalculateDefense();
    public float CombatWidth => CalculateCombatWidth();
    
    // 移动
    public int TargetProvinceId { get; set; } = -1;
    public float MovementProgress { get; set; }
    public List<int> MovementPath { get; set; }
    
    public override void _Process(double delta)
    {
        base._Process(delta);
        
        // 处理移动
        if (State == ArmyState.Moving && TargetProvinceId >= 0)
        {
            ProcessMovement(delta);
        }
        
        // 更新补给
        UpdateSupply();
        
        // 恢复组织度
        if (State == ArmyState.Idle && Organization < 1.0f)
        {
            Organization += 0.01f * (float)delta;
            Organization = Mathf.Min(Organization, 1.0f);
        }
    }
    
    private void ProcessMovement(double delta)
    {
        var province = MapData.Instance.Provinces[CurrentProvinceId];
        var targetProvince = MapData.Instance.Provinces[TargetProvinceId];
        
        // 计算移动速度
        float baseSpeed = GetMovementSpeed();
        float terrainModifier = GetTerrainModifier(targetProvince.Terrain);
        float actualSpeed = baseSpeed * terrainModifier * (Supply > 0.3f ? 1.0f : 0.5f);
        
        MovementProgress += actualSpeed * (float)delta;
        
        // 动画更新
        Position = Position.Lerp(targetProvince.Centroid, (float)delta * 2);
        
        if (MovementProgress >= 1.0f)
        {
            ArriveAtProvince();
        }
    }
    
    private void ArriveAtProvince()
    {
        CurrentProvinceId = TargetProvinceId;
        TargetProvinceId = -1;
        MovementProgress = 0;
        State = ArmyState.Idle;
        
        // 检查战斗
        CheckForCombat();
    }
    
    private void CheckForCombat()
    {
        var province = MapData.Instance.Provinces[CurrentProvinceId];
        
        // 检查是否有敌军
        var enemyArmies = GetEnemyArmiesInProvince();
        if (enemyArmies.Count > 0)
        {
            // 发起战斗
            var battle = BattleManager.Instance.StartBattle(this, enemyArmies);
            State = ArmyState.InBattle;
        }
    }
    
    private float CalculateAttack()
    {
        float attack = 0;
        
        // 步兵
        attack += Composition.Infantry.Count * 1.0f * GetUnitTechModifier(UnitType.Infantry);
        // 骑兵
        attack += Composition.Cavalry.Count * 1.5f * GetUnitTechModifier(UnitType.Cavalry);
        // 炮兵
        attack += Composition.Artillery.Count * 0.8f * GetUnitTechModifier(UnitType.Artillery);
        
        // 修正
        attack *= Morale * Organization * Equipment;
        attack *= (0.5f + Supply * 0.5f);  // 补给影响
        
        // 指挥官加成
        attack *= (1 + GetCommanderBonus());
        
        return attack;
    }
    
    private float CalculateDefense()
    {
        float defense = CalculateAttack() * 0.7f;  // 基础防御为攻击的70%
        
        // 地形加成
        var province = MapData.Instance.Provinces[CurrentProvinceId];
        defense *= GetDefensiveTerrainBonus(province.Terrain);
        
        // 要塞加成
        defense *= (1 + province.Fortification * 0.1f);
        
        return defense;
    }
    
    // 开始移动
    public void MoveTo(int targetProvinceId)
    {
        if (State == ArmyState.InBattle) return;
        
        // 路径寻找
        MovementPath = FindPath(CurrentProvinceId, targetProvinceId);
        if (MovementPath == null || MovementPath.Count == 0) return;
        
        TargetProvinceId = MovementPath[0];
        State = ArmyState.Moving;
        MovementProgress = 0;
    }
    
    // 受到攻击
    public void TakeDamage(float damage, DamageType type)
    {
        switch (type)
        {
            case DamageType.Casualties:
                // 兵员损失
                int casualties = (int)(damage * 10);
                ApplyCasualties(casualties);
                break;
                
            case DamageType.Morale:
                Morale -= damage;
                if (Morale <= 0) Retreat();
                break;
                
            case DamageType.Organization:
                Organization -= damage;
                if (Organization <= 0) Retreat();
                break;
        }
    }
    
    private void Retreat()
    {
        State = ArmyState.Retreating;
        
        // 寻找撤退方向
        var retreatProvince = FindRetreatProvince();
        if (retreatProvince >= 0)
        {
            MoveTo(retreatProvince);
        }
        
        // 士气损失
        Morale = 0.1f;
        Organization = 0.2f;
    }
}

public class ArmyComposition
{
    public UnitStack Infantry { get; set; } = new();
    public UnitStack Cavalry { get; set; } = new();
    public UnitStack Artillery { get; set; } = new();
    
    public int TotalCount => Infantry.Count + Cavalry.Count + Artillery.Count;
    
    public float GetCombatWidth()
    {
        // 战斗宽度 = 基础宽度 + 技术加成
        return 10 + Infantry.Count * 0.01f + Cavalry.Count * 0.005f;
    }
}

public class UnitStack
{
    public UnitType Type { get; set; }
    public int Count { get; set; }
    public float Experience { get; set; }  // 经验值
    public float Equipment { get; set; }   // 装备率
}

public enum ArmyState
{
    Idle,        // 待机
    Moving,      // 移动中
    InBattle,    // 战斗中
    Retreating,  // 撤退中
    Sieging      // 围城
}
```

#### 4. Navy (海军)
```csharp
public class Navy : Node2D
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int CountryId { get; set; }
    
    // 位置
    public Vector2 Position { get; set; }  // 海上坐标
    public int? PortProvinceId { get; set; }  // 停泊港口
    public NavyState State { get; set; }
    
    // 舰队组成
    public NavyComposition Composition { get; set; }
    
    // 战斗力
    public float TotalPower => CalculatePower();
    public float Speed => CalculateSpeed();
    
    // 任务
    public NavyMission CurrentMission { get; set; }
    public int? TargetSeaZone { get; set; }
    
    private float CalculatePower()
    {
        float power = 0;
        
        power += Composition.CapitalShips.Count * 10.0f;
        power += Composition.Cruisers.Count * 5.0f;
        power += Composition.Frigates.Count * 2.0f;
        
        // 科技修正
        power *= GetNavalTechModifier();
        
        return power;
    }
    
    public void StartMission(NavyMission mission, int target)
    {
        CurrentMission = mission;
        TargetSeaZone = target;
        State = NavyState.OnMission;
    }
    
    public void Engage(Navy enemy)
    {
        BattleManager.Instance.StartNavalBattle(this, enemy);
        State = NavyState.InBattle;
    }
}

public class NavyComposition
{
    public ShipStack CapitalShips { get; set; } = new();   // 主力舰
    public ShipStack Cruisers { get; set; } = new();       // 巡洋舰
    public ShipStack Frigates { get; set; } = new();       // 护卫舰
    public ShipStack Transports { get; set; } = new();     // 运输船
}

public enum NavyMission
{
    Patrol,      // 巡逻
    Intercept,   // 拦截
    Escort,      // 护航
    Blockade,    // 封锁
    Transport    // 运输
}

public enum NavyState
{
    InPort,      // 在港
    AtSea,       // 在海上
    OnMission,   // 执行任务
    InBattle,    // 战斗中
    Retreating   // 撤退
}
```

#### 5. Battle (战斗)
```csharp
public class Battle
{
    public int Id { get; set; }
    public BattleType Type { get; set; }
    public int ProvinceId { get; set; }  // 陆地战斗位置
    public int? SeaZoneId { get; set; }  // 海战位置
    
    // 参战方
    public BattleSide SideA { get; set; }
    public BattleSide SideB { get; set; }
    
    // 战斗状态
    public BattlePhase Phase { get; set; }
    public int Duration { get; set; }  // 战斗持续天数
    public float Progress { get; set; }  // 战斗进度 0-1
    
    // 战斗统计
    public BattleCasualties CasualtiesA { get; set; } = new();
    public BattleCasualties CasualtiesB { get; set; } = new();
    
    // 每日战斗结算
    public void DailyTick()
    {
        Duration++;
        
        // 计算双方战斗力
        float powerA = CalculateSidePower(SideA);
        float powerB = CalculateSidePower(SideB);
        
        // 战斗结果倾向
        float advantage = (powerA - powerB) / (powerA + powerB + 1);
        
        // 计算损失
        float baseCasualtiesRate = 0.02f;  // 基础伤亡率2%
        
        int casualtiesA = (int)(SideA.TotalMen * baseCasualtiesRate * (1 - advantage));
        int casualtiesB = (int)(SideB.TotalMen * baseCasualtiesRate * (1 + advantage));
        
        ApplyCasualties(SideA, casualtiesA);
        ApplyCasualties(SideB, casualtiesB);
        
        // 士气损失
        float moraleLossA = baseCasualtiesRate * (1 + advantage) * 2;
        float moraleLossB = baseCasualtiesRate * (1 - advantage) * 2;
        
        ApplyMoraleLoss(SideA, moraleLossA);
        ApplyMoraleLoss(SideB, moraleLossB);
        
        // 更新进度
        Progress += advantage * 0.1f;
        Progress = Mathf.Clamp(Progress, -1, 1);
        
        // 检查战斗结束条件
        CheckEndConditions();
    }
    
    private void CheckEndConditions()
    {
        // 一方全军覆没
        if (SideA.TotalMen <= 0)
        {
            EndBattle(BattleResult.DefenderVictory);
            return;
        }
        if (SideB.TotalMen <= 0)
        {
            EndBattle(BattleResult.AttackerVictory);
            return;
        }
        
        // 一方士气崩溃
        if (SideA.AverageMorale < 0.1f)
        {
            EndBattle(BattleResult.DefenderVictory);
            return;
        }
        if (SideB.AverageMorale < 0.1f)
        {
            EndBattle(BattleResult.AttackerVictory);
            return;
        }
        
        // 战斗超时 (30天)
        if (Duration >= 30)
        {
            EndBattle(BattleResult.Draw);
        }
    }
    
    private void EndBattle(BattleResult result)
    {
        // 记录结果
        var war = WarManager.Instance.GetWarForBattle(this);
        if (war != null)
        {
            switch (result)
            {
                case BattleResult.AttackerVictory:
                    war.ScoreBreakdown.BattleWins++;
                    break;
                case BattleResult.DefenderVictory:
                    war.ScoreBreakdown.BattleLosses++;
                    break;
            }
        }
        
        // 处理撤退
        if (result == BattleResult.DefenderVictory)
        {
            foreach (var army in SideA.Armies)
            {
                army.Retreat();
            }
        }
        else if (result == BattleResult.AttackerVictory)
        {
            foreach (var army in SideB.Armies)
            {
                army.Retreat();
            }
        }
        
        // 触发事件
        EventManager.Instance.TriggerEvent(
            new BattleEndedEvent(this, result));
        
        // 清理
        BattleManager.Instance.RemoveBattle(this);
    }
}

public class BattleSide
{
    public List<Army> Armies { get; set; } = new();
    public List<Navy> Navies { get; set; } = new();
    public int TotalMen => Armies.Sum(a => a.TotalMen);
    public float AverageMorale => Armies.Average(a => a.Morale);
}

public enum BattleType
{
    LandBattle,    // 陆战
    NavalBattle,   // 海战
    Siege          // 围城
}

public enum BattlePhase
{
    Deployment,    // 部署
    Skirmish,      // 前哨战
    MainBattle,    // 主力交战
    Pursuit        // 追击
}

public enum BattleResult
{
    AttackerVictory,
    DefenderVictory,
    Draw
}
```

## 战争管理器

```csharp
public partial class WarManager : Node
{
    public static WarManager Instance { get; private set; }
    
    public List<War> ActiveWars { get; private set; }
    public List<War> WarHistory { get; private set; }
    
    public override void _Ready()
    {
        Instance = this;
    }
    
    // 宣战
    public War DeclareWar(int attackerId, int defenderId, List<WarGoal> goals)
    {
        var attacker = MapData.Instance.Countries[attackerId];
        var defender = MapData.Instance.Countries[defenderId];
        
        var war = new War
        {
            Id = ActiveWars.Count,
            Name = War.GenerateWarName(attacker, defender, goals.First()),
            StartDate = GameManager.Instance.CurrentDate,
            Attacker = new WarSide { LeaderId = attackerId, Members = new() { attackerId } },
            Defender = new WarSide { LeaderId = defenderId, Members = new() { defenderId } },
            WarGoals = goals,
            State = WarState.Active,
            ScoreBreakdown = new WarScoreBreakdown
            {
                OccupiedProvinces = new(),
                LostProvinces = new()
            }
        };
        
        ActiveWars.Add(war);
        
        // 触发宣战事件
        EventManager.Instance.TriggerEvent(
            new WarDeclaredEvent(war));
        
        return war;
    }
    
    // 和平谈判
    public void NegotiatePeace(War war, int winningSide, PeaceDeal deal)
    {
        // 应用和平条款
        foreach (var term in deal.Terms)
        {
            ApplyPeaceTerm(term);
        }
        
        // 结束战争
        war.EndDate = GameManager.Instance.CurrentDate;
        war.State = WarState.Ended;
        
        ActiveWars.Remove(war);
        WarHistory.Add(war);
        
        // 触发和平事件
        EventManager.Instance.TriggerEvent(
            new PeaceSignedEvent(war, deal));
    }
    
    // 加入战争
    public void JoinWar(War war, int countryId, bool joinAttacker)
    {
        if (joinAttacker)
            war.Attacker.Members.Add(countryId);
        else
            war.Defender.Members.Add(countryId);
        
        EventManager.Instance.TriggerEvent(
            new CountryJoinedWarEvent(war, countryId));
    }
    
    public void DailyUpdate()
    {
        foreach (var war in ActiveWars.ToList())
        {
            war.DailyUpdate();
        }
        
        // 更新所有军队
        foreach (var country in MapData.Instance.Countries)
        {
            foreach (var army in country.Armies)
            {
                // 军队已在_process中更新
            }
        }
    }
}
```

## 补给系统

```csharp
public class SupplySystem
{
    // 计算军队的补给状态
    public float CalculateArmySupply(Army army)
    {
        var province = MapData.Instance.Provinces[army.CurrentProvinceId];
        var country = MapData.Instance.Countries[army.CountryId];
        
        float supply = 1.0f;
        
        // 基础设施影响
        supply *= (0.3f + province.Infrastructure.GetSupplyEfficiency() * 0.7f);
        
        // 距离首都/补给中心的距离
        float distanceToSupply = CalculateDistanceToSupplySource(army);
        supply *= Mathf.Max(0.1f, 1 - distanceToSupply / 500);
        
        // 敌军封锁
        if (IsSupplyLineBlocked(army))
            supply *= 0.5f;
        
        // 海上补给 (海外军队)
        if (IsOverseas(army))
        {
            supply *= GetNavalSupplyEfficiency(army);
        }
        
        return Mathf.Clamp(supply, 0, 1);
    }
    
    // 补给不足的影响
    public void ApplySupplyEffects(Army army)
    {
        if (army.Supply > 0.7f) return;
        
        if (army.Supply < 0.3f)
        {
            // 严重补给不足
            army.Organization -= 0.05f;
            army.Morale -= 0.03f;
            
            // 非战斗损失
            int attrition = (int)(army.TotalMen * 0.005f);
            army.ApplyCasualties(attrition);
        }
        else if (army.Supply < 0.5f)
        {
            // 补给不足
            army.Organization -= 0.02f;
        }
    }
}
```

## UI显示

```csharp
public partial class WarPanel : Panel
{
    [Export] public ItemList WarList { get; set; }
    [Export] public Label WarScoreLabel { get; set; }
    [Export] public ProgressBar WarScoreBar { get; set; }
    [Export] public Button NegotiateButton { get; set; }
    
    public void UpdateDisplay(int countryId)
    {
        var countryWars = WarManager.Instance.ActiveWars
            .Where(w => IsCountryInvolved(w, countryId))
            .ToList();
        
        WarList.Clear();
        foreach (var war in countryWars)
        {
            string item = $"{war.Name} - 战争分数: {war.WarScore:F0}";
            WarList.AddItem(item);
        }
        
        // 更新战争分数显示
        if (countryWars.Count > 0)
        {
            var currentWar = countryWars[0];
            WarScoreLabel.Text = $"战争分数: {currentWar.WarScore:F0}";
            WarScoreBar.Value = (currentWar.WarScore + 100) / 2;  // -100到100映射到0-100
        }
    }
}

public partial class ArmyVisual : Node2D
{
    [Export] public Sprite2D UnitSprite { get; set; }
    [Export] public ProgressBar MoraleBar { get; set; }
    [Export] public ProgressBar OrgBar { get; set; }
    
    private Army _army;
    
    public void Setup(Army army)
    {
        _army = army;
        
        // 设置颜色
        var country = MapData.Instance.Countries[army.CountryId];
        UnitSprite.Modulate = country.Color;
    }
    
    public override void _Process(double delta)
    {
        // 更新位置
        Position = _army.Position;
        
        // 更新状态条
        MoraleBar.Value = _army.Morale * 100;
        OrgBar.Value = _army.Organization * 100;
        
        // 战斗动画
        if (_army.State == ArmyState.InBattle)
        {
            PlayBattleAnimation();
        }
    }
    
    private void PlayBattleAnimation()
    {
        // 使用Godot AnimationPlayer播放战斗动画
        var tween = CreateTween();
        tween.TweenProperty(this, "rotation", Rotation + 0.1f, 0.1f);
        tween.TweenProperty(this, "rotation", Rotation - 0.1f, 0.1f);
    }
}
```

## 依赖关系

- **被依赖**: diplomacy_system, internal_affairs_system, event_system
- **依赖**: map_design, population_system, tech_tree

## 配置示例

```json
{
  "war_mechanics": {
    "base_battle_score": 5,
    "occupation_score": 10,
    "blockade_max_score": 20,
    "battle_duration_max": 30,
    "base_casualty_rate": 0.02,
    "supply_range": 500
  },
  "units": {
    "infantry": {
      "attack": 1.0,
      "defense": 1.2,
      "speed": 1.0,
      "combat_width": 1.0
    },
    "cavalry": {
      "attack": 1.5,
      "defense": 0.8,
      "speed": 2.0,
      "combat_width": 1.0
    },
    "artillery": {
      "attack": 0.8,
      "defense": 0.5,
      "speed": 0.6,
      "combat_width": 1.5
    }
  }
}
```
