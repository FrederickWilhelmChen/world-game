// 商品类型
export enum CommodityType {
  IRON = 'iron',
  COAL = 'coal',
  STEEL = 'steel',
  MACHINERY = 'machinery',
  FOOD = 'food',
  CONSUMER_GOODS = 'consumer_goods',
}

// 商品数据
export interface Commodity {
  type: CommodityType;
  name: string;
  basePrice: number;
  currentPrice: number;
  supply: number;
  demand: number;
}

// 资源
export interface Resources {
  money: number;
  manpower: number;
  politicalPower: number;
  commodities: Map<CommodityType, number>;
}

// 位置
export interface Position {
  x: number;
  y: number;
}

// 省份
export interface Province {
  id: string;
  name: string;
  position: Position;
  owner: string | null;
  resources: Partial<Record<CommodityType, number>>;
}

// 建筑类型
export enum BuildingType {
  MINE = 'mine',
  FACTORY = 'factory',
  MILITARY_BASE = 'military_base',
}

// 建筑
export interface Building {
  id: string;
  type: BuildingType;
  name: string;
  provinceId: string;
  constructionProgress: number;
  constructionTime: number;
  isComplete: boolean;
  input: Partial<Record<CommodityType, number>>;
  output: Partial<Record<CommodityType, number>>;
}

// 国策
export interface NationalFocus {
  id: string;
  name: string;
  description: string;
  duration: number;
  progress: number;
  completed: boolean;
  prerequisites: string[];
  effects: {
    resources?: Partial<Resources>;
    modifiers?: Record<string, number>;
  };
}

// 军队
export interface Army {
  id: string;
  name: string;
  size: number;
  position: Position;
  targetPosition: Position | null;
  movementSpeed: number;
  countryId: string;
}

// 国家
export interface Country {
  id: string;
  name: string;
  color: string;
  resources: Resources;
  provinces: string[];
  armies: Army[];
  buildings: Building[];
  completedFocuses: string[];
  activeFocus: string | null;
}

// 命令类型
export enum CommandType {
  BUILD = 'build',
  MOVE_ARMY = 'move_army',
  START_FOCUS = 'start_focus',
  TRADE = 'trade',
}

// 命令
export interface Command {
  id: string;
  type: CommandType;
  countryId: string;
  scheduledDate: number;
  data: any;
}

// 游戏状态
export interface GameState {
  currentDate: number;
  isPlaying: boolean;
  speed: number;
  countries: Map<string, Country>;
  provinces: Map<string, Province>;
  market: Map<CommodityType, Commodity>;
  commandQueue: Command[];
  nationalFocuses: Map<string, NationalFocus>;
  playerCountryId: string;
}
