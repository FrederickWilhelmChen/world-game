# World Game - 模块说明与技术路线

## 技术路线

- **后端**: Flask 提供 API 与静态资源服务，`Flask-CORS` 处理跨域。
- **数据管线**: 爬虫按数据源分别拉取并落盘为 JSON，数据合并生成 `data/merged/countries_data.json` 供 API 查询。
- **前端**: Leaflet.js 显示墨卡托世界地图，加载 GeoJSON 边界；鼠标悬停时请求后端 API 并展示 Tooltip。
- **数据存储**: 原始数据存放于 `data/raw/*`，合并数据存放于 `data/merged`。

## 模块职责

### 后端

- `backend/app.py`
  - Flask 应用入口，注册 API 蓝图。
  - 提供 `/api/health` 健康检查。
  - 读取 `data/merged/countries_data.json` 作为数据源。
  - 通过 `/` 和 `/frontend/*` 直接提供前端页面与资源。

- `backend/api/country_data.py`
  - 实现 `/api/country/<iso_code>` 查询接口。
  - 返回合并后的国家数据，不存在返回 404。

- `backend/utils/data_manager.py`
  - 封装数据读取与缓存。
  - 通过文件修改时间判断是否需要重新加载。

- `backend/utils/lag_checker.py`
  - 数据滞后检测工具，按时间差生成滞后说明。

- `backend/crawler/*`
  - 预留各数据源爬虫入口（GDP、原油、粮食、矿产）。

### 数据目录

- `data/raw/*`
  - 各数据源原始 JSON 数据，按类型与时间分目录存放。

- `data/merged/countries_data.json`
  - API 读取的统一数据格式，包含国家名称、首都、经济指标与滞后标注。

### 前端

- `frontend/index.html`
  - 页面骨架与字体加载。
  - 引入 Leaflet 与本地脚本。

- `frontend/css/style.css`
  - 主题视觉定义、地图容器、Tooltip 组件样式。

- `frontend/js/map.js`
  - Leaflet 地图初始化与底图加载。
  - 加载 `static/geojson/world_50m_custom.geojson` 并渲染国家边界。
  - 绑定鼠标悬停事件，触发数据加载与 Tooltip 展示。
  - 资本标注显示。

- `frontend/js/data_loader.js`
  - 通过 `/api/country/<iso>` 拉取数据并在内存缓存。

- `frontend/js/tooltip.js`
  - Tooltip DOM 控制与位置跟随。

### 静态资源

- `static/geojson/world_50m_custom.geojson`
  - 基于 Natural Earth 1:50m，使用中国自然资源部官方边界数据替换中国几何，并移除台湾、索马里兰等争议要素。

## 运行数据流

1. 爬虫按计划拉取 GDP/原油/粮食/矿产数据，写入 `data/raw/*`。
2. 数据合并任务生成 `data/merged/countries_data.json`。
3. 前端载入地图并监听悬停事件。
4. 悬停触发 `/api/country/<iso>` 请求，后端从合并数据中响应。
5. Tooltip 展示对应国家的经济指标与滞后说明。

## 依赖清单

- 后端: Flask, Flask-CORS, requests, beautifulsoup4, pandas, python-dateutil
- 前端: Leaflet.js (CDN), Natural Earth GeoJSON
