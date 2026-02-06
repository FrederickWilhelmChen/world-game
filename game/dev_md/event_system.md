# 事件系统模块

## 模块概述

本模块负责管理游戏中的事件系统，包含随机事件、历史事件、事件链、触发条件、选项与后果等机制。事件驱动游戏进程，增加游戏的不确定性和叙事深度。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用 `Resource` 存储事件配置
- 使用事件队列管理待触发事件
- 使用Godot的 `Popup` 或自定义窗口显示事件

### 核心数据结构

#### 1. GameEvent (游戏事件)
```csharp
public class GameEvent
{
    public string Id { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string FlavorText { get; set; }
    
    // 事件类型
    public EventType Type { get; set; }
    
    // 触发条件
    public List<EventCondition> TriggerConditions { get; set; }
    
    // 触发概率 (0-1)
    public float BaseChance { get; set; } = 0.1f;
    
    // 触发概率修正
    public Dictionary<string, float> ChanceModifiers { get; set; }
    
    // 冷却时间 (天数)
    public int CooldownDays { get; set; } = 365;
    
    // 选项
    public List<EventOption> Options { get; set; }
    
    // 是否只触发一次
    public bool IsOneTime { get; set; }
    
    // 图片资源路径
    public string ImagePath { get; set; }
    
    // 声音资源路径
    public string SoundPath { get; set; }
    
    // 检查是否可以触发
    public bool CanTrigger(Country country)
    {
        // 检查是否已触发过
        if (IsOneTime && EventManager.Instance.HasTriggered(Id, country.Id))
            return false;
        
        // 检查冷却
        if (EventManager.Instance.IsOnCooldown(Id, country.Id))
            return false;
        
        // 检查触发条件
        foreach (var condition in TriggerConditions)
        {
            if (!condition.Check(country))
                return false;
        }
        
        return true;
    }
    
    // 计算触发概率
    public float CalculateTriggerChance(Country country)
    {
        float chance = BaseChance;
        
        // 应用修正
        foreach (var (key, modifier) in ChanceModifiers)
        {
            chance += GetModifierValue(key, country) * modifier;
        }
        
        return Mathf.Clamp(chance, 0, 1);
    }
}

public enum EventType
{
    Random,         // 随机事件
    Historical,     // 历史事件
    Chain,          // 事件链
    Crisis,         // 危机事件
    Decision        // 决策事件
}

public class EventCondition
{
    public ConditionType Type { get; set; }
    public string Target { get; set; }
    public ComparisonOperator Operator { get; set; }
    public object Value { get; set; }
    
    public bool Check(Country country)
    {
        var actualValue = GetActualValue(Type, Target, country);
        return Compare(actualValue, Operator, Value);
    }
}

public enum ConditionType
{
    CountryProperty,    // 国家属性
    Law,               // 法律
    Technology,        // 科技
    Resource,          // 资源
    Building,          // 建筑
    Population,        // 人口
    War,              // 战争
    Relation,         // 外交关系
    Province          // 省份
}

public enum ComparisonOperator
{
    Equal,
    NotEqual,
    GreaterThan,
    LessThan,
    GreaterOrEqual,
    LessOrEqual
}
```

#### 2. EventOption (事件选项)
```csharp
public class EventOption
{
    public string Id { get; set; }
    public string Text { get; set; }
    public string Tooltip { get; set; }
    
    // 可见条件
    public List<EventCondition> VisibilityConditions { get; set; }
    
    // 可用条件
    public List<EventCondition> AvailabilityConditions { get; set; }
    
    // 效果
    public List<EventEffect> Effects { get; set; }
    
    // 后续事件
    public string NextEventId { get; set; }
    public int NextEventDelay { get; set; } = 0;
    
    // AI选择权重
    public float AIWeight { get; set; } = 1.0f;
    
    // 检查是否可见
    public bool IsVisible(Country country)
    {
        if (VisibilityConditions == null) return true;
        
        foreach (var condition in VisibilityConditions)
        {
            if (!condition.Check(country))
                return false;
        }
        return true;
    }
    
    // 检查是否可用
    public bool IsAvailable(Country country)
    {
        if (AvailabilityConditions == null) return true;
        
        foreach (var condition in AvailabilityConditions)
        {
            if (!condition.Check(country))
                return false;
        }
        return true;
    }
    
    // 执行效果
    public void Execute(Country country)
    {
        foreach (var effect in Effects)
        {
            effect.Apply(country);
        }
        
        // 触发后续事件
        if (!string.IsNullOrEmpty(NextEventId))
        {
            EventManager.Instance.QueueEvent(NextEventId, country.Id, NextEventDelay);
        }
    }
}

public class EventEffect
{
    public EffectType Type { get; set; }
    public string Target { get; set; }
    public object Value { get; set; }
    
    public void Apply(Country country)
    {
        switch (Type)
        {
            case EffectType.ModifyProperty:
                ModifyCountryProperty(country, Target, Value);
                break;
                
            case EffectType.UnlockTechnology:
                country.UnlockTechnology((string)Value);
                break;
                
            case EffectType.ChangeLaw:
                ChangeLaw(country, Target, Value);
                break;
                
            case EffectType.SpawnBuilding:
                SpawnBuilding(country, Target, (int)Value);
                break;
                
            case EffectType.ModifyRelation:
                ModifyRelation(country, Target, (float)Value);
                break;
                
            case EffectType.TriggerWar:
                TriggerWar(country, Target, (WarGoal)Value);
                break;
                
            case EffectType.SpawnRebel:
                SpawnRebels(country, Target, (int)Value);
                break;
                
            case EffectType.ModifyPop:
                ModifyPopulation(country, Target, Value);
                break;
        }
    }
}

public enum EffectType
{
    ModifyProperty,      // 修改国家属性
    UnlockTechnology,    // 解锁科技
    ChangeLaw,          // 改变法律
    SpawnBuilding,      // 生成建筑
    ModifyRelation,     // 修改外交关系
    TriggerWar,         // 触发战争
    SpawnRebel,         // 生成叛军
    ModifyPop,          // 修改人口
    AddModifier,        // 添加修正
    RemoveModifier,     // 移除修正
    TriggerEvent        // 触发其他事件
}
```

#### 3. EventChain (事件链)
```csharp
public class EventChain
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    
    // 事件序列
    public List<ChainEvent> Events { get; set; }
    
    // 当前进度
    public int CurrentIndex { get; set; }
    
    // 是否完成
    public bool IsComplete { get; set; }
    
    // 检查是否可开始
    public bool CanStart(Country country)
    {
        if (Events.Count == 0) return false;
        return Events[0].Event.CanTrigger(country);
    }
    
    // 推进事件链
    public void Advance(Country country)
    {
        if (IsComplete) return;
        
        CurrentIndex++;
        
        if (CurrentIndex >= Events.Count)
        {
            IsComplete = true;
            OnChainComplete(country);
        }
        else
        {
            // 触发下一个事件
            var nextEvent = Events[CurrentIndex];
            EventManager.Instance.TriggerEvent(nextEvent.Event, country);
        }
    }
    
    private void OnChainComplete(Country country)
    {
        // 事件链完成的奖励
        EventManager.Instance.TriggerEvent(
            new ChainCompletedEvent(this, country));
    }
}

public class ChainEvent
{
    public GameEvent Event { get; set; }
    public int DelayDays { get; set; }  // 距离上一个事件的天数
    public bool IsMandatory { get; set; }  // 是否必然触发
}
```

#### 4. EventManager (事件管理器)
```csharp
public partial class EventManager : Node
{
    public static EventManager Instance { get; private set; }
    
    // 所有事件定义
    public Dictionary<string, GameEvent> EventDefinitions { get; private set; }
    
    // 事件链定义
    public Dictionary<string, EventChain> ChainDefinitions { get; private set; }
    
    // 已触发事件记录
    public Dictionary<(string, int), DateTime> TriggeredEvents { get; private set; }
    
    // 冷却中的事件
    public Dictionary<(string, int), DateTime> Cooldowns { get; private set; }
    
    // 事件队列
    public Queue<QueuedEvent> EventQueue { get; private set; }
    
    // 活跃的事件链
    public Dictionary<int, List<EventChain>> ActiveChains { get; private set; }
    
    [Signal]
    public delegate void EventTriggeredEventHandler(GameEvent evt, int countryId);
    
    [Signal]
    public delegate void EventOptionSelectedEventHandler(GameEvent evt, EventOption option, int countryId);
    
    public override void _Ready()
    {
        Instance = this;
        LoadEventDefinitions();
    }
    
    private void LoadEventDefinitions()
    {
        EventDefinitions = new Dictionary<string, GameEvent>();
        ChainDefinitions = new Dictionary<string, EventChain>();
        
        // 从JSON/Resource加载事件
        LoadEventsFromDirectory("res://events/");
        LoadChainsFromDirectory("res://event_chains/");
        
        TriggeredEvents = new Dictionary<(string, int), DateTime>();
        Cooldowns = new Dictionary<(string, int), DateTime>();
        EventQueue = new Queue<QueuedEvent>();
        ActiveChains = new Dictionary<int, List<EventChain>>();
    }
    
    // 每日检查
    public void DailyUpdate()
    {
        // 处理事件队列
        ProcessEventQueue();
        
        // 检查随机事件
        CheckRandomEvents();
        
        // 检查历史事件
        CheckHistoricalEvents();
        
        // 更新冷却
        UpdateCooldowns();
    }
    
    private void ProcessEventQueue()
    {
        var toRemove = new List<QueuedEvent>();
        
        foreach (var queued in EventQueue)
        {
            queued.DaysRemaining--;
            
            if (queued.DaysRemaining <= 0)
            {
                if (EventDefinitions.TryGetValue(queued.EventId, out var evt))
                {
                    var country = MapData.Instance.Countries[queued.CountryId];
                    if (evt.CanTrigger(country))
                    {
                        TriggerEvent(evt, country);
                    }
                }
                toRemove.Add(queued);
            }
        }
        
        foreach (var queued in toRemove)
        {
            EventQueue = new Queue<QueuedEvent>(EventQueue.Where(q => q != queued));
        }
    }
    
    private void CheckRandomEvents()
    {
        foreach (var country in MapData.Instance.Countries)
        {
            // 每个国家每天最多触发一个随机事件
            if (RandomManager.Roll(0.05f))  // 5%基础概率
            {
                var candidates = EventDefinitions.Values
                    .Where(e => e.Type == EventType.Random && e.CanTrigger(country))
                    .ToList();
                
                if (candidates.Count > 0)
                {
                    // 加权随机选择
                    var selected = WeightedRandomSelect(candidates, country);
                    if (selected != null && RandomManager.Roll(selected.CalculateTriggerChance(country)))
                    {
                        TriggerEvent(selected, country);
                    }
                }
            }
        }
    }
    
    private void CheckHistoricalEvents()
    {
        var currentDate = GameManager.Instance.CurrentDate;
        
        foreach (var country in MapData.Instance.Countries)
        {
            var candidates = EventDefinitions.Values
                .Where(e => e.Type == EventType.Historical 
                    && e.CanTrigger(country)
                    && !HasTriggered(e.Id, country.Id))
                .ToList();
            
            foreach (var evt in candidates)
            {
                // 历史事件根据年份触发
                if (ShouldTriggerHistoricalEvent(evt, currentDate, country))
                {
                    TriggerEvent(evt, country);
                }
            }
        }
    }
    
    private bool ShouldTriggerHistoricalEvent(GameEvent evt, DateTime date, Country country)
    {
        // 从事件ID或条件中提取年份
        // 例如: "event_1848_revolution" 对应 1848年
        
        int eventYear = ExtractYearFromEvent(evt);
        
        if (eventYear <= 0) return false;
        
        // 在当前年份±1年内可能触发
        if (Math.Abs(date.Year - eventYear) <= 1)
        {
            float yearProgress = (date.Month - 1) / 12f;
            float chance = evt.BaseChance * (1 + yearProgress);
            return RandomManager.Roll(chance);
        }
        
        return false;
    }
    
    // 触发事件
    public void TriggerEvent(GameEvent evt, Country country)
    {
        // 记录触发
        TriggeredEvents[(evt.Id, country.Id)] = GameManager.Instance.CurrentDate;
        
        // 设置冷却
        if (evt.CooldownDays > 0)
        {
            Cooldowns[(evt.Id, country.Id)] = GameManager.Instance.CurrentDate
                .AddDays(evt.CooldownDays);
        }
        
        // 如果是玩家国家，显示事件窗口
        if (country.Id == GameManager.Instance.PlayerCountryId)
        {
            ShowEventWindow(evt, country);
        }
        else
        {
            // AI选择
            AISelectOption(evt, country);
        }
        
        EmitSignal(SignalName.EventTriggered, evt, country.Id);
    }
    
    private void ShowEventWindow(GameEvent evt, Country country)
    {
        var window = EventWindowScene.Instantiate<EventWindow>();
        window.Setup(evt, country);
        GetTree().Root.AddChild(window);
    }
    
    private void AISelectOption(GameEvent evt, Country country)
    {
        // 获取可用选项
        var availableOptions = evt.Options
            .Where(o => o.IsVisible(country) && o.IsAvailable(country))
            .ToList();
        
        if (availableOptions.Count == 0) return;
        
        // 加权随机选择
        var selected = WeightedRandomSelect(availableOptions, country);
        selected?.Execute(country);
        
        EmitSignal(SignalName.EventOptionSelected, evt, selected, country.Id);
    }
    
    // 玩家选择选项
    public void PlayerSelectOption(string eventId, string optionId)
    {
        if (!EventDefinitions.TryGetValue(eventId, out var evt)) return;
        
        var country = MapData.Instance.Countries[GameManager.Instance.PlayerCountryId];
        var option = evt.Options.FirstOrDefault(o => o.Id == optionId);
        
        if (option != null && option.IsAvailable(country))
        {
            option.Execute(country);
            EmitSignal(SignalName.EventOptionSelected, evt, option, country.Id);
        }
    }
    
    // 排队事件
    public void QueueEvent(string eventId, int countryId, int delayDays)
    {
        EventQueue.Enqueue(new QueuedEvent
        {
            EventId = eventId,
            CountryId = countryId,
            DaysRemaining = delayDays
        });
    }
    
    // 检查是否已触发
    public bool HasTriggered(string eventId, int countryId)
    {
        return TriggeredEvents.ContainsKey((eventId, countryId));
    }
    
    // 检查是否在冷却中
    public bool IsOnCooldown(string eventId, int countryId)
    {
        if (Cooldowns.TryGetValue((eventId, countryId), out var cooldownEnd))
        {
            return GameManager.Instance.CurrentDate < cooldownEnd;
        }
        return false;
    }
}

public class QueuedEvent
{
    public string EventId { get; set; }
    public int CountryId { get; set; }
    public int DaysRemaining { get; set; }
}
```

## 事件配置示例

### 随机事件

```json
{
  "id": "agricultural_boom",
  "type": "random",
  "title": "农业丰收",
  "description": "今年风调雨顺，农业生产获得了意外的丰收。",
  "base_chance": 0.02,
  "trigger_conditions": [
    {
      "type": "country_property",
      "target": "owned_provinces",
      "operator": "greater_than",
      "value": 3
    }
  ],
  "options": [
    {
      "id": "celebrate",
      "text": "庆祝丰收！",
      "effects": [
        {
          "type": "modify_property",
          "target": "stability",
          "value": 5
        },
        {
          "type": "modify_property",
          "target": "treasury",
          "value": 1000
        }
      ]
    }
  ]
}
```

### 历史事件

```json
{
  "id": "industrial_revolution_spreads",
  "type": "historical",
  "title": "工业革命扩散",
  "description": "工业革命的成果开始向世界其他地区扩散，工厂和铁路正在改变生产方式。",
  "base_chance": 0.8,
  "trigger_conditions": [
    {
      "type": "technology",
      "target": "mechanized_workshops",
      "operator": "equal",
      "value": false
    },
    {
      "type": "country_property",
      "target": "literacy_rate",
      "operator": "greater_than",
      "value": 0.15
    }
  ],
  "options": [
    {
      "id": "embrace",
      "text": "拥抱工业化",
      "effects": [
        {
          "type": "unlock_technology",
          "target": "",
          "value": "mechanized_workshops"
        }
      ],
      "next_event": "industrial_unrest",
      "next_event_delay": 365
    },
    {
      "id": "resist",
      "text": "抵制变革",
      "effects": [
        {
          "type": "modify_property",
          "target": "stability",
          "value": -10
        }
      ]
    }
  ]
}
```

### 事件链

```json
{
  "id": "revolution_of_1848",
  "name": "1848年革命",
  "events": [
    {
      "event_id": "liberal_unrest",
      "delay_days": 0,
      "mandatory": true
    },
    {
      "event_id": "demands_for_reform",
      "delay_days": 30,
      "mandatory": false
    },
    {
      "event_id": "revolution_breaks_out",
      "delay_days": 60,
      "mandatory": false
    }
  ]
}
```

## 危机事件

```csharp
public class CrisisEvent : GameEvent
{
    public CrisisType CrisisType { get; set; }
    public float EscalationRate { get; set; }  // 升级速度
    public int MaxDuration { get; set; }  // 最大持续时间
    
    public float CurrentEscalation { get; set; }  // 当前紧张度
    public DateTime StartDate { get; set; }
    
    // 每日升级
    public void DailyEscalation()
    {
        CurrentEscalation += EscalationRate;
        
        if (CurrentEscalation >= 100)
        {
            TriggerCrisisOutcome();
        }
    }
    
    private void TriggerCrisisOutcome()
    {
        switch (CrisisType)
        {
            case CrisisType.Diplomatic:
                // 外交危机升级为战争
                WarManager.Instance.DeclareWar(...);
                break;
                
            case CrisisType.Economic:
                // 经济危机引发革命
                RevolutionSystem.TriggerRevolution(...);
                break;
                
            case CrisisType.Nationalist:
                // 民族主义危机导致独立战争
                SpawnIndependenceWar();
                break;
        }
    }
}

public enum CrisisType
{
    Diplomatic,     // 外交危机
    Economic,       // 经济危机
    Nationalist,    // 民族主义危机
    Religious,      // 宗教危机
    Succession      // 继承危机
}
```

## UI显示

```csharp
public partial class EventWindow : Window
{
    [Export] public TextureRect EventImage { get; set; }
    [Export] public Label TitleLabel { get; set; }
    [Export] public Label DescriptionLabel { get; set; }
    [Export] public VBoxContainer OptionsContainer { get; set; }
    
    private GameEvent _event;
    private Country _country;
    
    public void Setup(GameEvent evt, Country country)
    {
        _event = evt;
        _country = country;
        
        // 设置内容
        TitleLabel.Text = evt.Title;
        DescriptionLabel.Text = evt.Description;
        
        // 加载图片
        if (!string.IsNullOrEmpty(evt.ImagePath))
        {
            EventImage.Texture = GD.Load<Texture2D>(evt.ImagePath);
        }
        
        // 创建选项按钮
        CreateOptionButtons();
        
        // 播放音效
        if (!string.IsNullOrEmpty(evt.SoundPath))
        {
            AudioManager.Instance.PlaySound(evt.SoundPath);
        }
    }
    
    private void CreateOptionButtons()
    {
        foreach (var child in OptionsContainer.GetChildren())
            child.QueueFree();
        
        foreach (var option in _event.Options)
        {
            if (!option.IsVisible(_country)) continue;
            
            var button = new Button { Text = option.Text };
            
            // 提示
            if (!string.IsNullOrEmpty(option.Tooltip))
            {
                button.TooltipText = option.Tooltip;
            }
            
            // 不可用选项变灰
            if (!option.IsAvailable(_country))
            {
                button.Disabled = true;
                button.TooltipText += " [不可用]";
            }
            
            button.Pressed += () => OnOptionSelected(option);
            OptionsContainer.AddChild(button);
        }
    }
    
    private void OnOptionSelected(EventOption option)
    {
        option.Execute(_country);
        
        EventManager.Instance.PlayerSelectOption(_event.Id, option.Id);
        
        QueueFree();
    }
}
```

## 依赖关系

- **被依赖**: 所有其他系统 (作为触发器)
- **依赖**: map_design, population_system, market_system, industrial_system, war_system, diplomacy_system, internal_affairs_system

## 事件系统配置

```json
{
  "event_system": {
    "max_events_per_day_per_country": 1,
    "random_event_base_chance": 0.05,
    "historical_event_window": 365,
    "max_queue_size": 100,
    "event_cooldown_multiplier": 1.0
  },
  "event_types": {
    "random": { "weight": 1.0 },
    "historical": { "weight": 2.0 },
    "crisis": { "weight": 0.5 },
    "decision": { "weight": 1.5 }
  }
}
```

## 事件编辑器工具

```csharp
#if TOOLS
[Tool]
public partial class EventEditor : EditorPlugin
{
    public override void _EnterTree()
    {
        // 添加自定义事件编辑器
        AddCustomType("GameEventResource", "Resource", 
            GD.Load<Script>("res://editor/event_resource.gd"),
            GD.Load<Texture2D>("res://editor/icons/event.png"));
    }
    
    public override void _ExitTree()
    {
        RemoveCustomType("GameEventResource");
    }
}
#endif
```
