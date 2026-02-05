import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { GameState, Command, CommandType, BuildingType, CommodityType, Position } from './types';
import { createInitialGameState } from './gameData';
import { GameEngine } from './gameEngine';

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showTradeMenu, setShowTradeMenu] = useState(false);
  const [selectedArmy, setSelectedArmy] = useState<string | null>(null);

  const playerCountry = gameState.countries.get(gameState.playerCountryId);

  // 游戏循环
  useEffect(() => {
    if (!gameState.isPlaying) return;

    const interval = setInterval(() => {
      setGameState(prevState => {
        const newState = GameEngine.updateGameState(prevState);
        newState.currentDate += 1;
        return newState;
      });
    }, 1000 / gameState.speed);

    return () => clearInterval(interval);
  }, [gameState.isPlaying, gameState.speed]);

  // 时间控制
  const togglePlaying = () => {
    setGameState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const changeSpeed = (speed: number) => {
    setGameState(prev => ({ ...prev, speed }));
  };

  // 添加命令到队列
  const addCommand = (command: Omit<Command, 'id'>) => {
    const newCommand: Command = {
      ...command,
      id: `cmd_${Date.now()}_${Math.random()}`,
    };

    setGameState(prev => ({
      ...prev,
      commandQueue: [...prev.commandQueue, newCommand],
    }));
  };

  // 建造建筑
  const buildBuilding = (buildingType: BuildingType, provinceId: string) => {
    addCommand({
      type: CommandType.BUILD,
      countryId: gameState.playerCountryId,
      scheduledDate: gameState.currentDate,
      data: { buildingType, provinceId },
    });
    setShowBuildMenu(false);
  };

  // 开始国策
  const startFocus = (focusId: string) => {
    if (!playerCountry) return;
    
    const focus = gameState.nationalFocuses.get(focusId);
    if (!focus) return;

    // 检查前置条件
    const canStart = focus.prerequisites.every(prereq => 
      playerCountry.completedFocuses.includes(prereq)
    );

    if (!canStart || playerCountry.activeFocus || focus.completed) {
      return;
    }

    addCommand({
      type: CommandType.START_FOCUS,
      countryId: gameState.playerCountryId,
      scheduledDate: gameState.currentDate,
      data: { focusId },
    });
  };

  // 移动军队
  const moveArmy = (armyId: string, targetPosition: Position) => {
    addCommand({
      type: CommandType.MOVE_ARMY,
      countryId: gameState.playerCountryId,
      scheduledDate: gameState.currentDate,
      data: { armyId, targetPosition },
    });
    setSelectedArmy(null);
  };

  // 贸易
  const trade = (commodityType: CommodityType, amount: number, isBuying: boolean) => {
    addCommand({
      type: CommandType.TRADE,
      countryId: gameState.playerCountryId,
      scheduledDate: gameState.currentDate,
      data: { commodityType, amount, isBuying },
    });
  };

  // 地图点击
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedArmy) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      moveArmy(selectedArmy, { x, y });
    }
  };

  if (!playerCountry) return <div>Loading...</div>;

  return (
    <div className="app">
      {/* 顶部栏 */}
      <div className="top-bar">
        <div className="time-controls">
          <div className="time-display">日期: {gameState.currentDate}</div>
          <button onClick={togglePlaying} className="primary">
            {gameState.isPlaying ? '⏸ 暂停' : '▶ 开始'}
          </button>
          <button onClick={() => changeSpeed(1)} disabled={gameState.speed === 1}>
            速度 1x
          </button>
          <button onClick={() => changeSpeed(2)} disabled={gameState.speed === 2}>
            速度 2x
          </button>
          <button onClick={() => changeSpeed(5)} disabled={gameState.speed === 5}>
            速度 5x
          </button>
          <span className="speed-display">
            {gameState.isPlaying ? `运行中 (${gameState.speed}x)` : '已暂停'}
          </span>
        </div>

        <div className="country-info">
          <div className="resource-item">
            💰 金钱: {Math.floor(playerCountry.resources.money)}
          </div>
          <div className="resource-item">
            👥 人力: {Math.floor(playerCountry.resources.manpower)}
          </div>
          <div className="resource-item">
            ⚖️ 政治点数: {Math.floor(playerCountry.resources.politicalPower)}
          </div>
        </div>
      </div>

      <div className="main-content">
        {/* 左侧面板 - 国策树 */}
        <div className="left-panel">
          <div className="panel-section">
            <h3>国策树</h3>
            {Array.from(gameState.nationalFocuses.values()).map(focus => {
              const canStart = focus.prerequisites.every(prereq => 
                playerCountry.completedFocuses.includes(prereq)
              );
              const isActive = playerCountry.activeFocus === focus.id;
              const isCompleted = focus.completed;
              const isDisabled = !canStart || playerCountry.activeFocus !== null && !isActive || isCompleted;

              return (
                <div
                  key={focus.id}
                  className={`focus-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => !isDisabled && startFocus(focus.id)}
                >
                  <div className="focus-name">{focus.name}</div>
                  <div className="focus-description">{focus.description}</div>
                  <div className="focus-description">
                    耗时: {focus.duration}天 | 花费: 50政治点数
                  </div>
                  {isActive && (
                    <div className="focus-progress">
                      <div
                        className="focus-progress-bar"
                        style={{ width: `${(focus.progress / focus.duration) * 100}%` }}
                      />
                    </div>
                  )}
                  {isCompleted && <div style={{ color: '#228B22' }}>✓ 已完成</div>}
                </div>
              );
            })}
          </div>

          <div className="panel-section">
            <h3>建筑</h3>
            {playerCountry.buildings.length === 0 ? (
              <div style={{ color: '#888', fontSize: '14px' }}>暂无建筑</div>
            ) : (
              playerCountry.buildings.map(building => (
                <div
                  key={building.id}
                  className={`building-item ${building.isComplete ? 'complete' : 'constructing'}`}
                >
                  <div className="building-name">{building.name}</div>
                  <div className="building-progress">
                    {building.isComplete
                      ? '✓ 已完成'
                      : `建造中: ${Math.floor((building.constructionProgress / building.constructionTime) * 100)}%`}
                  </div>
                  {building.isComplete && (
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '5px' }}>
                      产出: {Object.entries(building.output).map(([type, amount]) => 
                        `${amount} ${type}`
                      ).join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 中间 - 地图 */}
        <div className="center-content">
          <div className="map-container" onClick={handleMapClick}>
            {/* 省份 */}
            {Array.from(gameState.provinces.values()).map(province => {
              const owner = province.owner ? gameState.countries.get(province.owner) : null;
              return (
                <div
                  key={province.id}
                  className="province"
                  style={{
                    left: province.position.x - 40,
                    top: province.position.y - 40,
                    backgroundColor: owner?.color || '#666',
                    opacity: selectedProvince === province.id ? 1 : 0.7,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProvince(province.id);
                    if (province.owner === gameState.playerCountryId) {
                      setShowBuildMenu(true);
                    }
                  }}
                >
                  {province.name}
                </div>
              );
            })}

            {/* 军队 */}
            {Array.from(gameState.countries.values()).flatMap(country =>
              country.armies.map(army => (
                <div
                  key={army.id}
                  className="army"
                  style={{
                    left: army.position.x - 20,
                    top: army.position.y - 20,
                    backgroundColor: country.color,
                    border: selectedArmy === army.id ? '3px solid yellow' : '2px solid #000',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (army.countryId === gameState.playerCountryId) {
                      setSelectedArmy(army.id === selectedArmy ? null : army.id);
                    }
                  }}
                  title={`${army.name} (${army.size}人)`}
                >
                  ⚔
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧面板 - 市场和资源 */}
        <div className="right-panel">
          <div className="panel-section">
            <h3>全球市场</h3>
            <button onClick={() => setShowTradeMenu(!showTradeMenu)} className="primary" style={{ width: '100%', marginBottom: '10px' }}>
              {showTradeMenu ? '关闭交易' : '打开交易'}
            </button>
            
            {Array.from(gameState.market.values()).map(commodity => (
              <div key={commodity.type} className="commodity-item">
                <div>
                  <div className="commodity-name">{commodity.name}</div>
                  <div className="commodity-supply">
                    供应: {Math.floor(commodity.supply)} | 需求: {Math.floor(commodity.demand)}
                  </div>
                </div>
                <div>
                  <div className="commodity-price">¥{commodity.currentPrice.toFixed(2)}</div>
                  {showTradeMenu && (
                    <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                      <button onClick={() => trade(commodity.type, 10, true)} style={{ fontSize: '10px', padding: '4px 8px' }}>
                        买10
                      </button>
                      <button onClick={() => trade(commodity.type, 10, false)} style={{ fontSize: '10px', padding: '4px 8px' }}>
                        卖10
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="panel-section">
            <h3>库存</h3>
            {Array.from(playerCountry.resources.commodities.entries()).map(([type, amount]) => {
              const commodity = gameState.market.get(type);
              return (
                <div key={type} className="commodity-item">
                  <div className="commodity-name">{commodity?.name || type}</div>
                  <div>{Math.floor(amount)}</div>
                </div>
              );
            })}
          </div>

          <div className="panel-section">
            <h3>命令队列</h3>
            {gameState.commandQueue.length === 0 ? (
              <div style={{ color: '#888', fontSize: '14px' }}>无待执行命令</div>
            ) : (
              gameState.commandQueue.map(cmd => (
                <div key={cmd.id} style={{ padding: '8px', backgroundColor: '#333', marginBottom: '5px', borderRadius: '4px', fontSize: '12px' }}>
                  <div>类型: {cmd.type}</div>
                  <div>执行日期: {cmd.scheduledDate}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 建造菜单 */}
      {showBuildMenu && selectedProvince && (
        <div className="modal-overlay" onClick={() => setShowBuildMenu(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">建造建筑</div>
            <div className="modal-content">
              <div className="build-options">
                <div className="build-option" onClick={() => buildBuilding(BuildingType.MINE, selectedProvince)}>
                  <div className="build-option-name">⛏ 矿场</div>
                  <div className="build-option-cost">花费: ¥1000, 机器×5, 人力1000</div>
                  <div className="build-option-cost">建造时间: 100天</div>
                  <div className="build-option-cost">产出: 铁矿+5/天</div>
                </div>
                <div className="build-option" onClick={() => buildBuilding(BuildingType.FACTORY, selectedProvince)}>
                  <div className="build-option-name">🏭 工厂</div>
                  <div className="build-option-cost">花费: ¥2000, 机器×10, 人力2000</div>
                  <div className="build-option-cost">建造时间: 150天</div>
                  <div className="build-option-cost">产出: 钢铁+3/天</div>
                </div>
                <div className="build-option" onClick={() => buildBuilding(BuildingType.MILITARY_BASE, selectedProvince)}>
                  <div className="build-option-name">🏰 军事基地</div>
                  <div className="build-option-cost">花费: ¥3000, 机器×8, 人力1500</div>
                  <div className="build-option-cost">建造时间: 120天</div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowBuildMenu(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
