import {
  GameState,
  Command,
  CommandType,
  BuildingType,
  CommodityType,
  Building,
  Country,
  Position,
} from './types';

// 游戏引擎类
export class GameEngine {
  // 执行命令
  static executeCommand(state: GameState, command: Command): GameState {
    const newState = { ...state };
    
    switch (command.type) {
      case CommandType.BUILD:
        return this.executeBuildCommand(newState, command);
      case CommandType.MOVE_ARMY:
        return this.executeMoveArmyCommand(newState, command);
      case CommandType.START_FOCUS:
        return this.executeStartFocusCommand(newState, command);
      case CommandType.TRADE:
        return this.executeTradeCommand(newState, command);
      default:
        return newState;
    }
  }
  
  // 执行建造命令
  static executeBuildCommand(state: GameState, command: Command): GameState {
    const { buildingType, provinceId } = command.data;
    const country = state.countries.get(command.countryId);
    
    if (!country) return state;
    
    // 检查是否有足够资源
    const costs = this.getBuildingCosts(buildingType);
    if (!this.canAfford(country, costs)) {
      console.log('资源不足，无法建造');
      return state;
    }
    
    // 扣除资源
    this.deductResources(country, costs);
    
    // 创建建筑
    const building: Building = {
      id: `building_${Date.now()}_${Math.random()}`,
      type: buildingType,
      name: this.getBuildingName(buildingType),
      provinceId,
      constructionProgress: 0,
      constructionTime: this.getBuildingConstructionTime(buildingType),
      isComplete: false,
      input: this.getBuildingInput(buildingType),
      output: this.getBuildingOutput(buildingType),
    };
    
    country.buildings.push(building);
    
    return state;
  }
  
  // 执行军队移动命令
  static executeMoveArmyCommand(state: GameState, command: Command): GameState {
    const { armyId, targetPosition } = command.data;
    const country = state.countries.get(command.countryId);
    
    if (!country) return state;
    
    const army = country.armies.find(a => a.id === armyId);
    if (army) {
      army.targetPosition = targetPosition;
    }
    
    return state;
  }
  
  // 执行国策命令
  static executeStartFocusCommand(state: GameState, command: Command): GameState {
    const { focusId } = command.data;
    const country = state.countries.get(command.countryId);
    const focus = state.nationalFocuses.get(focusId);
    
    if (!country || !focus) return state;
    
    // 检查前置条件
    const canStart = focus.prerequisites.every(prereq => 
      country.completedFocuses.includes(prereq)
    );
    
    if (!canStart) {
      console.log('不满足前置条件');
      return state;
    }
    
    // 检查是否有政治点数
    if (country.resources.politicalPower < 50) {
      console.log('政治点数不足');
      return state;
    }
    
    country.resources.politicalPower -= 50;
    country.activeFocus = focusId;
    
    return state;
  }
  
  // 执行贸易命令
  static executeTradeCommand(state: GameState, command: Command): GameState {
    const { commodityType, amount, isBuying } = command.data;
    const country = state.countries.get(command.countryId);
    const commodity = state.market.get(commodityType);
    
    if (!country || !commodity) return state;
    
    const cost = commodity.currentPrice * amount;
    
    if (isBuying) {
      if (country.resources.money < cost) {
        console.log('金钱不足');
        return state;
      }
      
      country.resources.money -= cost;
      const current = country.resources.commodities.get(commodityType) || 0;
      country.resources.commodities.set(commodityType, current + amount);
      
      commodity.supply -= amount;
      commodity.demand += amount * 0.1;
    } else {
      const current = country.resources.commodities.get(commodityType) || 0;
      if (current < amount) {
        console.log('商品不足');
        return state;
      }
      
      country.resources.commodities.set(commodityType, current - amount);
      country.resources.money += cost;
      
      commodity.supply += amount;
      commodity.demand -= amount * 0.1;
    }
    
    return state;
  }
  
  // 更新游戏状态（每个时间单位）
  static updateGameState(state: GameState): GameState {
    const newState = { ...state };
    
    // 处理命令队列
    const commandsToExecute = newState.commandQueue.filter(
      cmd => cmd.scheduledDate <= newState.currentDate
    );
    
    commandsToExecute.forEach(cmd => {
      this.executeCommand(newState, cmd);
    });
    
    newState.commandQueue = newState.commandQueue.filter(
      cmd => cmd.scheduledDate > newState.currentDate
    );
    
    // 更新建筑建造进度
    this.updateBuildings(newState);
    
    // 更新国策进度
    this.updateFocuses(newState);
    
    // 更新军队移动
    this.updateArmies(newState);
    
    // 更新市场价格
    this.updateMarket(newState);
    
    // 建筑产出
    this.processBuildingProduction(newState);
    
    // 增加政治点数
    newState.countries.forEach(country => {
      country.resources.politicalPower += 0.5;
    });
    
    return newState;
  }
  
  // 更新建筑
  static updateBuildings(state: GameState): void {
    state.countries.forEach(country => {
      country.buildings.forEach(building => {
        if (!building.isComplete) {
          building.constructionProgress += 1;
          if (building.constructionProgress >= building.constructionTime) {
            building.isComplete = true;
            console.log(`${building.name} 建造完成！`);
          }
        }
      });
    });
  }
  
  // 更新国策
  static updateFocuses(state: GameState): void {
    state.countries.forEach(country => {
      if (country.activeFocus) {
        const focus = state.nationalFocuses.get(country.activeFocus);
        if (focus && !focus.completed) {
          focus.progress += 1;
          
          if (focus.progress >= focus.duration) {
            focus.completed = true;
            country.completedFocuses.push(focus.id);
            country.activeFocus = null;
            
            // 应用效果
            if (focus.effects.resources) {
              if (focus.effects.resources.money !== undefined) {
                country.resources.money += focus.effects.resources.money;
              }
              if (focus.effects.resources.manpower !== undefined) {
                country.resources.manpower += focus.effects.resources.manpower;
              }
              if (focus.effects.resources.politicalPower !== undefined) {
                country.resources.politicalPower += focus.effects.resources.politicalPower;
              }
              if (focus.effects.resources.commodities) {
                focus.effects.resources.commodities.forEach((amount, type) => {
                  const current = country.resources.commodities.get(type) || 0;
                  country.resources.commodities.set(type, current + amount);
                });
              }
            }
            
            console.log(`国策 ${focus.name} 完成！`);
          }
        }
      }
    });
  }
  
  // 更新军队
  static updateArmies(state: GameState): void {
    state.countries.forEach(country => {
      country.armies.forEach(army => {
        if (army.targetPosition) {
          const dx = army.targetPosition.x - army.position.x;
          const dy = army.targetPosition.y - army.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < army.movementSpeed) {
            army.position = army.targetPosition;
            army.targetPosition = null;
            console.log(`${army.name} 到达目标位置`);
          } else {
            const ratio = army.movementSpeed / distance;
            army.position.x += dx * ratio;
            army.position.y += dy * ratio;
          }
        }
      });
    });
  }
  
  // 更新市场
  static updateMarket(state: GameState): void {
    state.market.forEach(commodity => {
      // 根据供需调整价格
      const supplyDemandRatio = commodity.supply / commodity.demand;
      
      if (supplyDemandRatio > 1.2) {
        commodity.currentPrice *= 0.98; // 供过于求，价格下降
      } else if (supplyDemandRatio < 0.8) {
        commodity.currentPrice *= 1.02; // 供不应求，价格上涨
      }
      
      // 价格不能低于基础价格的50%，不能高于300%
      commodity.currentPrice = Math.max(
        commodity.basePrice * 0.5,
        Math.min(commodity.currentPrice, commodity.basePrice * 3)
      );
      
      // 供需缓慢恢复平衡
      commodity.supply += (commodity.demand - commodity.supply) * 0.01;
      commodity.demand += (commodity.supply - commodity.demand) * 0.005;
    });
  }
  
  // 处理建筑产出
  static processBuildingProduction(state: GameState): void {
    state.countries.forEach(country => {
      country.buildings.forEach(building => {
        if (building.isComplete) {
          // 检查是否有足够的输入资源
          let canProduce = true;
          
          Object.entries(building.input).forEach(([type, amount]) => {
            const current = country.resources.commodities.get(type as CommodityType) || 0;
            if (current < amount) {
              canProduce = false;
            }
          });
          
          if (canProduce) {
            // 扣除输入资源
            Object.entries(building.input).forEach(([type, amount]) => {
              const current = country.resources.commodities.get(type as CommodityType) || 0;
              country.resources.commodities.set(type as CommodityType, current - amount);
            });
            
            // 增加输出资源
            Object.entries(building.output).forEach(([type, amount]) => {
              const current = country.resources.commodities.get(type as CommodityType) || 0;
              country.resources.commodities.set(type as CommodityType, current + amount);
            });
          }
        }
      });
    });
  }
  
  // 辅助方法
  static getBuildingCosts(type: BuildingType): { money: number; machinery: number; manpower: number } {
    switch (type) {
      case BuildingType.MINE:
        return { money: 1000, machinery: 5, manpower: 1000 };
      case BuildingType.FACTORY:
        return { money: 2000, machinery: 10, manpower: 2000 };
      case BuildingType.MILITARY_BASE:
        return { money: 3000, machinery: 8, manpower: 1500 };
      default:
        return { money: 0, machinery: 0, manpower: 0 };
    }
  }
  
  static getBuildingName(type: BuildingType): string {
    switch (type) {
      case BuildingType.MINE: return '矿场';
      case BuildingType.FACTORY: return '工厂';
      case BuildingType.MILITARY_BASE: return '军事基地';
      default: return '未知建筑';
    }
  }
  
  static getBuildingConstructionTime(type: BuildingType): number {
    switch (type) {
      case BuildingType.MINE: return 100;
      case BuildingType.FACTORY: return 150;
      case BuildingType.MILITARY_BASE: return 120;
      default: return 100;
    }
  }
  
  static getBuildingInput(type: BuildingType): Partial<Record<CommodityType, number>> {
    switch (type) {
      case BuildingType.MINE:
        return { [CommodityType.COAL]: 1 };
      case BuildingType.FACTORY:
        return { [CommodityType.IRON]: 2, [CommodityType.COAL]: 1 };
      case BuildingType.MILITARY_BASE:
        return { [CommodityType.STEEL]: 1 };
      default:
        return {};
    }
  }
  
  static getBuildingOutput(type: BuildingType): Partial<Record<CommodityType, number>> {
    switch (type) {
      case BuildingType.MINE:
        return { [CommodityType.IRON]: 5 };
      case BuildingType.FACTORY:
        return { [CommodityType.STEEL]: 3 };
      case BuildingType.MILITARY_BASE:
        return {};
      default:
        return {};
    }
  }
  
  static canAfford(country: Country, costs: { money: number; machinery: number; manpower: number }): boolean {
    const machinery = country.resources.commodities.get(CommodityType.MACHINERY) || 0;
    return (
      country.resources.money >= costs.money &&
      machinery >= costs.machinery &&
      country.resources.manpower >= costs.manpower
    );
  }
  
  static deductResources(country: Country, costs: { money: number; machinery: number; manpower: number }): void {
    country.resources.money -= costs.money;
    country.resources.manpower -= costs.manpower;
    
    const machinery = country.resources.commodities.get(CommodityType.MACHINERY) || 0;
    country.resources.commodities.set(CommodityType.MACHINERY, machinery - costs.machinery);
  }
}
