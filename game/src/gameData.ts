import {
  GameState,
  Country,
  Province,
  Commodity,
  CommodityType,
  NationalFocus,
  Command,
  CommandType,
  Building,
  BuildingType,
  Army,
  Resources,
} from './types';

// 创建初始商品数据
export const createInitialMarket = (): Map<CommodityType, Commodity> => {
  const market = new Map<CommodityType, Commodity>();
  
  const commodities: Commodity[] = [
    { type: CommodityType.IRON, name: '铁矿', basePrice: 10, currentPrice: 10, supply: 1000, demand: 800 },
    { type: CommodityType.COAL, name: '煤炭', basePrice: 8, currentPrice: 8, supply: 1200, demand: 1000 },
    { type: CommodityType.STEEL, name: '钢铁', basePrice: 30, currentPrice: 30, supply: 500, demand: 600 },
    { type: CommodityType.MACHINERY, name: '机器', basePrice: 100, currentPrice: 100, supply: 200, demand: 250 },
    { type: CommodityType.FOOD, name: '食物', basePrice: 5, currentPrice: 5, supply: 3000, demand: 2800 },
    { type: CommodityType.CONSUMER_GOODS, name: '消费品', basePrice: 20, currentPrice: 20, supply: 800, demand: 900 },
  ];
  
  commodities.forEach(c => market.set(c.type, c));
  return market;
};

// 创建初始国策
export const createInitialFocuses = (): Map<string, NationalFocus> => {
  const focuses = new Map<string, NationalFocus>();
  
  const focusList: NationalFocus[] = [
    {
      id: 'industrial_expansion',
      name: '工业扩张',
      description: '发展国内工业，增加机器产能',
      duration: 70,
      progress: 0,
      completed: false,
      prerequisites: [],
      effects: {
        resources: {
          money: 0,
          manpower: 0,
          politicalPower: 0,
          commodities: new Map([[CommodityType.MACHINERY, 50]]),
        },
      },
    },
    {
      id: 'military_buildup',
      name: '军事建设',
      description: '扩充军队规模',
      duration: 50,
      progress: 0,
      completed: false,
      prerequisites: [],
      effects: {
        resources: {
          money: -5000,
          manpower: 50000,
          politicalPower: 0,
          commodities: new Map(),
        },
      },
    },
    {
      id: 'resource_extraction',
      name: '资源开采',
      description: '提升矿产资源开采效率',
      duration: 60,
      progress: 0,
      completed: false,
      prerequisites: [],
      effects: {
        modifiers: {
          miningEfficiency: 1.2,
        },
      },
    },
    {
      id: 'free_trade',
      name: '自由贸易',
      description: '开放市场，降低贸易成本',
      duration: 40,
      progress: 0,
      completed: false,
      prerequisites: ['industrial_expansion'],
      effects: {
        modifiers: {
          tradeCost: 0.8,
        },
      },
    },
  ];
  
  focusList.forEach(f => focuses.set(f.id, f));
  return focuses;
};

// 创建初始省份
export const createInitialProvinces = (): Map<string, Province> => {
  const provinces = new Map<string, Province>();
  
  const provinceList: Province[] = [
    { id: 'p1', name: '首都省', position: { x: 300, y: 200 }, owner: 'player', resources: { [CommodityType.IRON]: 500 } },
    { id: 'p2', name: '工业省', position: { x: 450, y: 200 }, owner: 'player', resources: { [CommodityType.COAL]: 800 } },
    { id: 'p3', name: '农业省', position: { x: 375, y: 300 }, owner: 'player', resources: { [CommodityType.FOOD]: 1200 } },
    { id: 'p4', name: '边境省', position: { x: 550, y: 250 }, owner: 'ai1', resources: { [CommodityType.IRON]: 300 } },
    { id: 'p5', name: '资源省', position: { x: 300, y: 350 }, owner: 'player', resources: { [CommodityType.COAL]: 600, [CommodityType.IRON]: 400 } },
  ];
  
  provinceList.forEach(p => provinces.set(p.id, p));
  return provinces;
};

// 创建初始国家
export const createInitialCountries = (): Map<string, Country> => {
  const countries = new Map<string, Country>();
  
  const playerCountry: Country = {
    id: 'player',
    name: '玩家国家',
    color: '#4169E1',
    resources: {
      money: 10000,
      manpower: 100000,
      politicalPower: 100,
      commodities: new Map([
        [CommodityType.IRON, 100],
        [CommodityType.COAL, 150],
        [CommodityType.MACHINERY, 20],
      ]),
    },
    provinces: ['p1', 'p2', 'p3', 'p5'],
    armies: [
      {
        id: 'army1',
        name: '第1集团军',
        size: 10000,
        position: { x: 300, y: 200 },
        targetPosition: null,
        movementSpeed: 2,
        countryId: 'player',
      },
    ],
    buildings: [],
    completedFocuses: [],
    activeFocus: null,
  };
  
  const aiCountry: Country = {
    id: 'ai1',
    name: 'AI国家',
    color: '#DC143C',
    resources: {
      money: 8000,
      manpower: 80000,
      politicalPower: 80,
      commodities: new Map([
        [CommodityType.IRON, 80],
        [CommodityType.COAL, 120],
      ]),
    },
    provinces: ['p4'],
    armies: [
      {
        id: 'army2',
        name: '敌军',
        size: 8000,
        position: { x: 550, y: 250 },
        targetPosition: null,
        movementSpeed: 2,
        countryId: 'ai1',
      },
    ],
    buildings: [],
    completedFocuses: [],
    activeFocus: null,
  };
  
  countries.set('player', playerCountry);
  countries.set('ai1', aiCountry);
  return countries;
};

// 创建初始游戏状态
export const createInitialGameState = (): GameState => {
  return {
    currentDate: 0,
    isPlaying: false,
    speed: 1,
    countries: createInitialCountries(),
    provinces: createInitialProvinces(),
    market: createInitialMarket(),
    commandQueue: [],
    nationalFocuses: createInitialFocuses(),
    playerCountryId: 'player',
  };
};
