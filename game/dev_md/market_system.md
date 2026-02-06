# 市场系统模块

## 模块概述

本模块负责管理游戏中的市场系统，模拟自发的供需平衡与价格形成机制。价格根据供需关系动态调整，国家政策（关税、补贴、市场法）对市场行为产生不同程度的影响。

## 技术实现

### 引擎选择
- **Godot 4.3+ with C#**
- 使用 `Dictionary` 存储市场数据
- 使用事件队列处理交易

### 核心数据结构

#### 1. Market (市场)
```csharp
public class Market
{
    public int Id { get; set; }
    public string Name { get; set; }
    
    // 市场范围 (包含的国家)
    public List<int> MemberCountries { get; set; }
    
    // 价格表
    public Dictionary<ResourceType, GoodData> Goods { get; set; }
    
    // 市场规模 (整合度)
    public float IntegrationLevel { get; set; }  // 0-1, 影响价格波动幅度
    
    // 市场中心 (首都或最大城市)
    public int CenterProvinceId { get; set; }
    
    // 每日市场更新
    public void DailyUpdate()
    {
        ClearDailyData();
        
        // 收集所有供需
        CollectSupplyAndDemand();
        
        // 计算新价格
        CalculateNewPrices();
        
        // 执行交易
        ExecuteTrades();
        
        // 更新历史数据
        UpdatePriceHistory();
    }
    
    private void CollectSupplyAndDemand()
    {
        foreach (var countryId in MemberCountries)
        {
            var country = MapData.Instance.Countries[countryId];
            
            // 收集供给 (生产)
            foreach (var provinceId in country.OwnedProvinces)
            {
                var province = MapData.Instance.Provinces[provinceId];
                
                foreach (var building in province.Buildings)
                {
                    if (building is IResourceProducer producer)
                    {
                        var output = producer.GetDailyOutput();
                        foreach (var (resource, amount) in output)
                        {
                            Goods[resource].DailySupply += amount;
                        }
                    }
                }
            }
            
            // 收集需求 (POP消费 + 建筑消耗)
            CollectDemandFromCountry(country);
        }
    }
    
    private void CalculateNewPrices()
    {
        foreach (var (resource, data) in Goods)
        {
            float oldPrice = data.CurrentPrice;
            float supply = data.DailySupply;
            float demand = data.DailyDemand;
            
            // 供需比
            float ratio = supply / Mathf.Max(demand, 1);
            
            // 价格弹性公式
            // P_new = P_old * (1 + 0.25 * ln(ratio))
            // ln(1) = 0, 价格不变
            // ratio > 1 (供大于求), 价格下降
            // ratio < 1 (供不应求), 价格上升
            float priceChange = 0.25f * Mathf.Log(ratio);
            
            // 应用市场整合度 (整合度越高，价格波动越小)
            priceChange *= (1 - IntegrationLevel * 0.5f);
            
            // 限制每日最大价格变动 (防止剧烈波动)
            priceChange = Mathf.Clamp(priceChange, -0.2f, 0.2f);
            
            data.CurrentPrice = oldPrice * (1 + priceChange);
            
            // 价格下限 (防止免费商品)
            data.CurrentPrice = Mathf.Max(data.CurrentPrice, data.BasePrice * 0.1f);
            
            // 价格上限 (防止恶性通胀)
            data.CurrentPrice = Mathf.Min(data.CurrentPrice, data.BasePrice * 10);
        }
    }
}
```

#### 2. GoodData (商品数据)
```csharp
public class GoodData
{
    public ResourceType Type { get; set; }
    public float CurrentPrice { get; set; }           // 当前价格
    public float BasePrice { get; set; }              // 基准价格
    
    // 每日数据 (每日重置)
    public float DailySupply { get; set; }
    public float DailyDemand { get; set; }
    public float DailyTraded { get; set; }
    
    // 历史数据
    public List<PricePoint> PriceHistory { get; set; }
    public float AveragePrice7Days => CalculateAveragePrice(7);
    public float PriceTrend => CalculateTrend();
    
    // 市场状态
    public MarketStatus Status => DetermineStatus();
    
    public MarketStatus DetermineStatus()
    {
        float ratio = DailySupply / Mathf.Max(DailyDemand, 1);
        
        if (ratio < 0.5f) return MarketStatus.SevereShortage;   // 严重短缺
        if (ratio < 0.8f) return MarketStatus.Shortage;         // 短缺
        if (ratio > 2.0f) return MarketStatus.Surplus;          // 过剩
        if (ratio > 3.0f) return MarketStatus.SevereSurplus;    // 严重过剩
        return MarketStatus.Balanced;                           // 平衡
    }
}

public struct PricePoint
{
    public int Year { get; set; }
    public int Month { get; set; }
    public int Day { get; set; }
    public float Price { get; set; }
}

public enum MarketStatus
{
    SevereShortage,   // 严重短缺 - 价格上涨剧烈
    Shortage,         // 短缺 - 价格上涨
    Balanced,         // 平衡 - 价格稳定
    Surplus,          // 过剩 - 价格下降
    SevereSurplus     // 严重过剩 - 价格暴跌
}
```

#### 3. TradeRoute (贸易路线)
```csharp
public class TradeRoute
{
    public int Id { get; set; }
    public int FromMarketId { get; set; }
    public int ToMarketId { get; set; }
    
    // 路线经过的省份
    public List<int> Path { get; set; }
    public float Distance { get; set; }
    
    // 运输的商品
    public Dictionary<ResourceType, float> Goods { get; set; }
    
    // 运输成本
    public float BaseTransportCost { get; set; }
    public float CurrentEfficiency { get; set; }  // 受基础设施影响
    
    // 关税
    public float TariffRate { get; set; }  // 由目标市场设定
    
    // 计算运输成本
    public float CalculateTransportCost(ResourceType resource, float amount)
    {
        float weight = ResourceDefinitions[resource].Weight;
        float baseCost = Distance * weight * amount * BaseTransportCost;
        return baseCost / CurrentEfficiency;
    }
    
    // 计算关税
    public float CalculateTariff(float value)
    {
        return value * TariffRate;
    }
    
    // 更新效率 (基础设施变化时调用)
    public void UpdateEfficiency()
    {
        float avgInfrastructure = CalculateAverageInfrastructure();
        CurrentEfficiency = 0.5f + avgInfrastructure * 0.5f;  // 0.5-1.0
    }
}
```

#### 4. MarketManager (市场管理器)
```csharp
public partial class MarketManager : Node
{
    public static MarketManager Instance { get; private set; }
    
    public Dictionary<int, Market> Markets { get; private set; }
    public List<TradeRoute> TradeRoutes { get; private set; }
    
    // 商品价格缓存 (用于快速查询)
    public Dictionary<ResourceType, float> GlobalPrices { get; private set; }
    
    public override void _Ready()
    {
        Instance = this;
    }
    
    // 初始化市场
    public void InitializeMarkets()
    {
        // 每个国家初始有自己的本地市场
        foreach (var country in MapData.Instance.Countries)
        {
            var market = CreateMarketForCountry(country);
            Markets[market.Id] = market;
        }
        
        // 创建贸易路线
        GenerateTradeRoutes();
    }
    
    private Market CreateMarketForCountry(Country country)
    {
        var capital = MapData.Instance.Provinces[country.CapitalProvinceId];
        
        var market = new Market
        {
            Id = country.Id,
            Name = $"{country.Name} Market",
            MemberCountries = new List<int> { country.Id },
            CenterProvinceId = country.CapitalProvinceId,
            IntegrationLevel = CalculateIntegration(country),
            Goods = new Dictionary<ResourceType, GoodData>()
        };
        
        // 初始化所有商品价格
        foreach (var (type, definition) in ResourceProductionManager.Instance.ResourceDefinitions)
        {
            market.Goods[type] = new GoodData
            {
                Type = type,
                BasePrice = definition.BasePrice,
                CurrentPrice = definition.BasePrice,
                PriceHistory = new List<PricePoint>()
            };
        }
        
        return market;
    }
    
    // 每日更新
    public override void _Process(double delta)
    {
        // 在GameManager中控制调用频率
    }
    
    public void DailyUpdate()
    {
        // 更新所有市场
        foreach (var market in Markets.Values)
        {
            market.DailyUpdate();
        }
        
        // 处理国际贸易
        ProcessInternationalTrade();
        
        // 更新全球平均价格
        UpdateGlobalPrices();
    }
    
    private void ProcessInternationalTrade()
    {
        foreach (var route in TradeRoutes)
        {
            var fromMarket = Markets[route.FromMarketId];
            var toMarket = Markets[route.ToMarketId];
            
            foreach (var (resource, _) in route.Goods.ToList())
            {
                // 套利交易
                float priceDiff = toMarket.Goods[resource].CurrentPrice 
                    - fromMarket.Goods[resource].CurrentPrice;
                
                float transportCost = route.CalculateTransportCost(resource, 1);
                float tariff = route.CalculateTariff(toMarket.Goods[resource].CurrentPrice);
                
                float profit = priceDiff - transportCost - tariff;
                
                if (profit > 0)
                {
                    // 有利可图，执行贸易
                    float tradeAmount = CalculateTradeVolume(route, resource, profit);
                    ExecuteTrade(route, resource, tradeAmount);
                }
            }
        }
    }
    
    // 购买接口
    public bool Buy(ResourceType resource, float amount, object buyer)
    {
        var market = GetMarketForBuyer(buyer);
        var data = market.Goods[resource];
        
        float cost = amount * data.CurrentPrice;
        
        // 检查库存
        if (data.DailySupply < amount)
        {
            // 短缺，只能买部分
            amount = data.DailySupply;
            cost = amount * data.CurrentPrice;
        }
        
        // 扣除库存
        data.DailySupply -= amount;
        data.DailyTraded += amount;
        
        return true;
    }
    
    // 出售接口
    public void Sell(ResourceType resource, float amount, object seller)
    {
        var market = GetMarketForSeller(seller);
        market.Goods[resource].DailySupply += amount;
    }
    
    // 获取商品价格
    public float GetPrice(ResourceType resource, int marketId = -1)
    {
        if (marketId >= 0 && Markets.ContainsKey(marketId))
        {
            return Markets[marketId].Goods[resource].CurrentPrice;
        }
        
        return GlobalPrices[resource];
    }
}
```

## 价格形成机制详解

### 基础价格公式

```csharp
public float CalculateEquilibriumPrice(ResourceType resource, Market market)
{
    var data = market.Goods[resource];
    
    // 基础价格
    float basePrice = data.BasePrice;
    
    // 供需调节
    float supply = data.DailySupply;
    float demand = data.DailyDemand;
    
    // 市场出清价格
    float marketClearingPrice;
    
    if (demand > 0)
    {
        float ratio = supply / demand;
        
        // 使用对数函数实现价格弹性
        // 当 ratio = 1 (供需平衡), ln(1) = 0, 价格 = 基准价
        // 当 ratio = 2 (供大于求), ln(2) ≈ 0.69, 价格下降17%
        // 当 ratio = 0.5 (供不应求), ln(0.5) ≈ -0.69, 价格上涨17%
        float adjustment = 0.25f * Mathf.Log(ratio);
        
        marketClearingPrice = basePrice * (1 + adjustment);
    }
    else
    {
        marketClearingPrice = basePrice * 0.5f;  // 无需求时价格暴跌
    }
    
    // 价格粘性 (价格不会瞬间调整)
    float priceStickiness = 0.3f;  // 每日价格调整幅度上限
    float maxChange = data.CurrentPrice * priceStickiness;
    
    float targetPrice = Mathf.Clamp(
        marketClearingPrice,
        data.CurrentPrice - maxChange,
        data.CurrentPrice + maxChange
    );
    
    return targetPrice;
}
```

### 政策影响

```csharp
public float ApplyPolicyModifiers(float price, ResourceType resource, Market market)
{
    float modifiedPrice = price;
    
    // 收集所有成员国的政策
    foreach (var countryId in market.MemberCountries)
    {
        var country = MapData.Instance.Countries[countryId];
        var laws = country.CurrentLaws;
        
        // 市场法影响
        switch (laws.MarketLaw)
        {
            case MarketLawType.FreeMarket:
                // 自由市场：价格完全由供需决定
                break;
                
            case MarketLawType.Interventionism:
                // 干预主义：政府平抑价格波动
                modifiedPrice = StabilizePrice(modifiedPrice, resource, 0.1f);
                break;
                
            case MarketLawType.PlannedEconomy:
                // 计划经济：价格由设定
                modifiedPrice = GetPlannedPrice(resource, countryId);
                break;
        }
        
        // 价格管制
        if (country.PriceControls.ContainsKey(resource))
        {
            var control = country.PriceControls[resource];
            modifiedPrice = Mathf.Clamp(modifiedPrice, control.MinPrice, control.MaxPrice);
        }
        
        // 补贴
        if (country.Subsidies.ContainsKey(resource))
        {
            modifiedPrice -= country.Subsidies[resource];
        }
        
        // 消费税
        if (country.ConsumptionTaxes.ContainsKey(resource))
        {
            modifiedPrice *= (1 + country.ConsumptionTaxes[resource]);
        }
    }
    
    return modifiedPrice;
}
```

## 贸易系统

### 贸易路线生成

```csharp
public void GenerateTradeRoutes()
{
    TradeRoutes.Clear();
    
    var countries = MapData.Instance.Countries;
    
    // 为每对国家创建潜在的贸易路线
    for (int i = 0; i < countries.Length; i++)
    {
        for (int j = i + 1; j < countries.Length; j++)
        {
            var countryA = countries[i];
            var countryB = countries[j];
            
            // 寻找最短路径
            var path = FindTradePath(countryA, countryB);
            
            if (path != null)
            {
                var route = new TradeRoute
                {
                    Id = TradeRoutes.Count,
                    FromMarketId = countryA.Id,
                    ToMarketId = countryB.Id,
                    Path = path,
                    Distance = CalculatePathDistance(path),
                    Goods = new Dictionary<ResourceType, float>(),
                    BaseTransportCost = 0.01f,
                    TariffRate = 0.1f  // 基础关税10%
                };
                
                route.UpdateEfficiency();
                TradeRoutes.Add(route);
                
                // 创建反向路线
                var reverseRoute = new TradeRoute
                {
                    Id = TradeRoutes.Count,
                    FromMarketId = countryB.Id,
                    ToMarketId = countryA.Id,
                    Path = new List<int>(path).Reverse(),
                    Distance = route.Distance,
                    Goods = new Dictionary<ResourceType, float>(),
                    BaseTransportCost = route.BaseTransportCost,
                    TariffRate = route.TariffRate
                };
                
                reverseRoute.UpdateEfficiency();
                TradeRoutes.Add(reverseRoute);
            }
        }
    }
}
```

### 关税与贸易协定

```csharp
public class TariffSystem
{
    // 基础关税
    public float GetBaseTariffRate(int fromCountry, int toCountry, ResourceType resource)
    {
        var relation = DiplomacyManager.Instance.GetRelation(fromCountry, toCountry);
        var toCountryData = MapData.Instance.Countries[toCountry];
        
        float baseRate = toCountryData.BaseTariffRate;
        
        // 外交关系影响
        baseRate -= relation.Opinion * 0.001f;  // 每点好感降低0.1%关税
        
        // 贸易协定
        if (relation.HasTradeAgreement)
        {
            baseRate *= 0.5f;  // 贸易协定减半
        }
        
        // 同盟
        if (relation.IsAlly)
        {
            baseRate *= 0.3f;
        }
        
        // 关税同盟
        if (relation.IsInCustomsUnion)
        {
            baseRate = 0;
        }
        
        return Mathf.Max(baseRate, 0);
    }
    
    // 战略资源特殊关税
    public float GetStrategicResourceTariff(ResourceType resource, int countryId)
    {
        var country = MapData.Instance.Countries[countryId];
        
        // 如果国家缺乏该资源，可能设置出口关税
        if (IsResourceScarce(resource, countryId))
        {
            return 0.5f;  // 50%出口限制
        }
        
        return 0;
    }
}
```

## 市场整合

```csharp
public class MarketIntegration
{
    // 计算市场整合度
    public float CalculateIntegration(Market market)
    {
        float integration = 0;
        int memberCount = market.MemberCountries.Count;
        
        if (memberCount == 0) return 0;
        
        foreach (var countryId in market.MemberCountries)
        {
            var country = MapData.Instance.Countries[countryId];
            
            // 基础设施平均值
            float avgInfrastructure = CalculateAverageInfrastructure(country);
            
            // 识字率
            float literacy = country.LiteracyRate;
            
            // 市场法
            float lawFactor = country.CurrentLaws.MarketLaw switch
            {
                MarketLawType.FreeMarket => 1.0f,
                MarketLawType.Interventionism => 0.7f,
                MarketLawType.PlannedEconomy => 0.3f,
                _ => 0.5f
            };
            
            integration += (avgInfrastructure + literacy + lawFactor) / 3f;
        }
        
        return integration / memberCount;
    }
    
    // 市场合并 (如关税同盟)
    public void MergeMarkets(int marketAId, int marketBId)
    {
        var marketA = MarketManager.Instance.Markets[marketAId];
        var marketB = MarketManager.Instance.Markets[marketBId];
        
        // 合并成员国
        marketA.MemberCountries.AddRange(marketB.MemberCountries);
        
        // 重新计算整合度
        marketA.IntegrationLevel = CalculateIntegration(marketA);
        
        // 移除旧市场
        MarketManager.Instance.Markets.Remove(marketBId);
        
        // 更新贸易路线
        UpdateTradeRoutesAfterMerge(marketA, marketB);
    }
}
```

## UI显示

```csharp
public partial class MarketPanel : Panel
{
    [Export] public ItemList GoodsList { get; set; }
    [Export] public GraphEdit PriceGraph { get; set; }
    [Export] public Label MarketStatusLabel { get; set; }
    
    public void UpdateDisplay(int marketId)
    {
        var market = MarketManager.Instance.Markets[marketId];
        
        // 更新商品列表
        GoodsList.Clear();
        foreach (var (resource, data) in market.Goods)
        {
            string item = $"{resource}: {data.CurrentPrice:F2} ({data.Status})";
            GoodsList.AddItem(item);
        }
        
        // 更新价格图表
        UpdatePriceGraph(market);
        
        // 市场状态
        MarketStatusLabel.Text = $"整合度: {market.IntegrationLevel:P0}";
    }
    
    private void UpdatePriceGraph(Market market)
    {
        PriceGraph.ClearConnections();
        
        // 绘制选定商品的价格历史
        var selectedResource = GetSelectedResource();
        var data = market.Goods[selectedResource];
        
        for (int i = 0; i < data.PriceHistory.Count - 1; i++)
        {
            var point1 = data.PriceHistory[i];
            var point2 = data.PriceHistory[i + 1];
            
            // 绘制线段
            var line = new Line2D();
            line.AddPoint(new Vector2(i * 10, 100 - point1.Price));
            line.AddPoint(new Vector2((i + 1) * 10, 100 - point2.Price));
            line.DefaultColor = Colors.Green;
            
            PriceGraph.AddChild(line);
        }
    }
}
```

## 配置文件

```json
{
  "market_mechanics": {
    "price_elasticity": 0.25,
    "price_stickiness": 0.3,
    "max_daily_price_change": 0.2,
    "min_price_ratio": 0.1,
    "max_price_ratio": 10.0
  },
  "trade": {
    "base_transport_cost": 0.01,
    "distance_multiplier": 0.001,
    "base_tariff_rate": 0.1,
    "infrastructure_weight": 0.5
  },
  "market_laws": {
    "free_market": {
      "integration_bonus": 1.0,
      "price_control": false
    },
    "interventionism": {
      "integration_bonus": 0.7,
      "price_stability": 0.1,
      "price_control": true
    },
    "planned_economy": {
      "integration_bonus": 0.3,
      "price_control": "full"
    }
  }
}
```

## 依赖关系

- **被依赖**: industrial_system, internal_affairs_system
- **依赖**: map_design, resource_production, population_system, diplomacy_system

## 性能优化

1. **缓存价格计算**: 不重复计算价格
2. **分批更新**: 市场按区域分批更新
3. **价格历史压缩**: 只保留最近一年的日数据
4. **交易批处理**: 小额交易批量执行
