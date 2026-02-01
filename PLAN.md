# 世界模拟游戏 - 实施计划

## 项目概述

基于墨卡托投影的交互式世界地图，显示各国实时经济数据，使用Flask后端 + Leaflet.js前端。

---

## 技术架构

```
world-game/
├── backend/
│   ├── app.py                 # Flask主应用
│   ├── api/
│   │   └── country_data.py    # /api/country/<iso_code> 接口
│   ├── crawler/
│   │   ├── scheduler.py       # APScheduler定时任务调度
│   │   ├── worldbank_gdp.py   # GDP数据爬虫（季度更新）
│   │   ├── eia_oil.py         # 原油产量爬虫（月度更新）
│   │   ├── fao_agriculture.py # 粮食产量爬虫（年度更新）
│   │   └── usgs_minerals.py   # 矿产产量爬虫（年度更新）
│   └── utils/
│       ├── data_manager.py    # 数据整合与版本管理
│       └── lag_checker.py     # 数据滞后检测与标注
├── data/
│   ├── raw/                   # 原始爬取数据（JSON格式）
│   │   ├── gdp/
│   │   ├── oil/
│   │   ├── agriculture/
│   │   └── minerals/
│   └── merged/
│       └── countries_data.json # 整合后的最终数据
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── map.js             # Leaflet地图初始化
│       ├── data_loader.js     # 悬停数据加载
│       └── tooltip.js         # 信息弹窗组件
├── static/
│   └── geojson/
│       └── world_50m.geojson  # Natural Earth边界数据
├── requirements.txt
├── PLAN.md                    # 本文件
└── README.md                  # 项目说明
```

---

## 数据源调研结果

### 1. 国家边界数据

| 数据源 | 精度 | 大小 | 协议 | 获取方式 |
|--------|------|------|------|----------|
| **Natural Earth 1:50m** | 中 | 892KB | CC0 (公共领域) | GitHub: martynafford/natural-earth-geojson |
| Natural Earth 1:10m | 高 | 5.4MB | CC0 | 官网下载 |
| Natural Earth 1:110m | 低 | 214KB | CC0 | 官网下载 |

**采用方案**: Natural Earth 1:50m，精度适中，文件大小合理

### 2. 经济数据源（无需API密钥）

| 数据类型 | 数据源 | 获取方式 | 更新频率建议 | 典型滞后时间 |
|----------|--------|----------|--------------|--------------|
| **GDP** | World Bank | 开放API（无需密钥） | 季度 | 3-6个月 |
| **原油产量** | EIA | 官网CSV下载 | 月度 | 1-2个月 |
| **粮食产量** | FAO FAOSTAT | 网页爬取/下载 | 年度 | 6-12个月 |
| **有色金属** | USGS | 网页爬取/下载 | 年度 | 12个月 |
| **黄金产量** | USGS/World Gold Council | 网页爬取 | 年度 | 12个月 |

### 3. API端点示例

**World Bank GDP API**（无需密钥）:
```
https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=300&date=2020:2024
```

**EIA数据页面**:
```
https://www.eia.gov/dnav/pet/pet_crd_crpdn_adc_mbbl_m.htm
```

---

## 数据滞后标注规范

根据需求，超过1个月滞后的数据需要标注来源和发布日期。

### 标注规则

| 数据类型 | 更新频率 | 预期滞后 | 标注格式 |
|----------|----------|----------|----------|
| GDP | 季度 | 3-6个月 | `滞后，发布日：2024-Q2` |
| 原油产量 | 月度 | 1-2个月 | `滞后，发布日：2024-09` |
| 粮食产量 | 年度 | 6-12个月 | `滞后，发布日：2023` |
| 矿产产量 | 年度 | 12个月 | `滞后，发布日：2023` |

### 数据新鲜度检查逻辑

```python
# 伪代码
def check_data_freshness(data_date, current_date, max_lag_days=30):
    lag_days = (current_date - data_date).days
    if lag_days > max_lag_days:
        return f"滞后，发布日：{data_date.strftime('%Y-%m')}"
    return None
```

---

## 实施阶段

### 阶段1：基础架构搭建（预计2-3小时）

**1.1 项目结构初始化**
- [ ] 创建目录结构
- [ ] 初始化Python虚拟环境
- [ ] 创建requirements.txt

**1.2 Flask后端框架**
- [ ] 安装Flask、Flask-CORS
- [ ] 创建app.py主应用
- [ ] 实现基础API接口 `/api/country/<iso_code>`
- [ ] 添加健康检查端点 `/api/health`

**1.3 数据存储结构**
- [ ] 设计JSON数据格式
- [ ] 创建data目录结构
- [ ] 实现数据读写工具类

### 阶段2：数据爬取系统（预计3-4小时）

**2.1 GDP数据爬虫**
- [ ] 实现World Bank API调用
- [ ] 解析JSON响应
- [ ] 存储到data/raw/gdp/
- [ ] 实现滞后检测

**2.2 原油产量爬虫**
- [ ] 分析EIA网站结构
- [ ] 实现CSV下载/网页爬取
- [ ] 数据清洗与格式化
- [ ] 存储到data/raw/oil/

**2.3 粮食产量爬虫**
- [ ] 分析FAO FAOSTAT网站
- [ ] 实现批量数据获取
- [ ] 按类别（小麦、水稻、玉米等）存储
- [ ] 存储到data/raw/agriculture/

**2.4 矿产产量爬虫**
- [ ] 分析USGS Mineral Commodity Summaries
- [ ] 提取有色金属和黄金数据
- [ ] 存储到data/raw/minerals/

**2.5 数据整合与调度**
- [ ] 实现数据合并逻辑
- [ ] 创建APScheduler定时任务
- [ ] 配置差异化更新频率：
  - GDP: 每季度（cron: `0 0 1 */3 *`）
  - 原油: 每月（cron: `0 0 1 * *`）
  - 粮食/矿产: 每年（cron: `0 0 1 1 *`）

### 阶段3：前端地图开发（预计2-3小时）

**3.1 Leaflet地图集成**
- [ ] 下载Natural Earth GeoJSON数据
- [ ] 初始化Leaflet地图（墨卡托投影）
- [ ] 加载并显示国家边界
- [ ] 添加国家名称和首都标注

**3.2 交互功能**
- [ ] 实现国家悬停高亮效果
- [ ] 创建信息提示框（Tooltip）
- [ ] 实现悬停时异步加载数据
- [ ] 格式化数据展示（单位、滞后标注）

**3.3 样式优化**
- [ ] 设计国家边界样式
- [ ] 设计悬停高亮样式
- [ ] 设计Tooltip样式
- [ ] 响应式布局适配

### 阶段4：整合与测试（预计1-2小时）

**4.1 前后端联调**
- [ ] 测试API数据返回
- [ ] 测试前端数据加载
- [ ] 测试悬停交互
- [ ] 验证数据滞后标注显示

**4.2 数据更新验证**
- [ ] 手动触发爬虫测试
- [ ] 验证定时任务执行
- [ ] 检查数据文件生成
- [ ] 验证数据整合结果

**4.3 性能优化**
- [ ] 优化GeoJSON加载性能
- [ ] 添加数据缓存机制
- [ ] 优化API响应速度

---

## 技术选型详细说明

### 后端技术栈

| 组件 | 用途 | 版本建议 |
|------|------|----------|
| Flask | Web框架 | >=2.0.0 |
| Flask-CORS | 跨域支持 | >=4.0.0 |
| requests | HTTP请求 | >=2.28.0 |
| beautifulsoup4 | HTML解析 | >=4.11.0 |
| APScheduler | 定时任务 | >=3.10.0 |
| pandas | 数据处理 | >=1.5.0 |
| python-dateutil | 日期处理 | >=2.8.0 |

### 前端技术栈

| 组件 | 用途 | 版本/来源 |
|------|------|----------|
| Leaflet.js | 地图库 | 1.9.x (CDN) |
| Natural Earth GeoJSON | 边界数据 | 1:50m |
| Vanilla JavaScript | 交互逻辑 | ES6+ |
| CSS3 | 样式 | - |

---

## 数据格式规范

### 原始数据存储格式

**GDP数据** (`data/raw/gdp/YYYY-MM.json`):
```json
{
  "last_updated": "2024-01-15T10:30:00Z",
  "data": {
    "CHN": {
      "value": 17734062600000,
      "unit": "USD",
      "year": 2023,
      "lag_days": 45,
      "lag_note": "滞后，发布日：2023"
    }
  }
}
```

**原油产量数据** (`data/raw/oil/YYYY-MM.json`):
```json
{
  "last_updated": "2024-01-15T10:30:00Z",
  "unit": "桶/日",
  "data": {
    "USA": {
      "value": 12900000,
      "year": 2023,
      "month": 11,
      "lag_note": "滞后，发布日：2023-11"
    }
  }
}
```

**粮食产量数据** (`data/raw/agriculture/YYYY.json`):
```json
{
  "last_updated": "2024-01-15T10:30:00Z",
  "unit": "吨/年",
  "data": {
    "CHN": {
      "total": 682000000,
      "by_category": {
        "wheat": 134000000,
        "rice": 212000000,
        "corn": 277000000
      },
      "year": 2023,
      "lag_note": "滞后，发布日：2023"
    }
  }
}
```

### 整合后数据格式

**最终数据** (`data/merged/countries_data.json`):
```json
{
  "metadata": {
    "generated_at": "2024-01-15T10:30:00Z",
    "version": "1.0"
  },
  "countries": {
    "CHN": {
      "name": "China",
      "name_zh": "中国",
      "capital": "Beijing",
      "gdp": {
        "value": 17734062600000,
        "unit": "USD",
        "year": 2023,
        "lag_note": "滞后，发布日：2023"
      },
      "oil_production": {
        "value": 4100000,
        "unit": "桶/日",
        "year": 2023,
        "month": 11,
        "lag_note": "滞后，发布日：2023-11"
      },
      "grain_production": {
        "total": 682000000,
        "unit": "吨/年",
        "by_category": {
          "wheat": 134000000,
          "rice": 212000000,
          "corn": 277000000
        },
        "year": 2023,
        "lag_note": "滞后，发布日：2023"
      }
    }
  }
}
```

---

## API接口规范

### 获取单个国家数据

**请求**:
```
GET /api/country/<iso_code>
```

**参数**:
- `iso_code`: ISO 3166-1 alpha-3 国家代码（如 CHN, USA, JPN）

**成功响应** (200 OK):
```json
{
  "code": "CHN",
  "name": "China",
  "name_zh": "中国",
  "capital": "Beijing",
  "gdp": {
    "value": 17734062600000,
    "unit": "USD",
    "year": 2023,
    "lag_note": "滞后，发布日：2023"
  },
  "oil_production": {
    "value": 4100000,
    "unit": "桶/日",
    "lag_note": "滞后，发布日：2023-11"
  },
  "grain_production": {
    "total": 682000000,
    "unit": "吨/年",
    "by_category": {
      "wheat": 134000000,
      "rice": 212000000,
      "corn": 277000000
    },
    "lag_note": "滞后，发布日：2023"
  }
}
```

**错误响应** (404 Not Found):
```json
{
  "error": "Country not found",
  "code": "XXX"
}
```

### 健康检查

**请求**:
```
GET /api/health
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "data_version": "1.0",
  "last_crawl": "2024-01-15T09:00:00Z"
}
```

---

## 定时任务配置

### APScheduler配置

```python
# scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = BackgroundScheduler()

# GDP数据 - 每季度第一天 00:00
scheduler.add_job(
    crawl_gdp,
    trigger=CronTrigger(month='1,4,7,10', day=1, hour=0, minute=0),
    id='gdp_crawler',
    name='GDP Data Crawler'
)

# 原油产量 - 每月第一天 00:00
scheduler.add_job(
    crawl_oil,
    trigger=CronTrigger(day=1, hour=0, minute=0),
    id='oil_crawler',
    name='Oil Production Crawler'
)

# 粮食和矿产 - 每年1月1日 00:00
scheduler.add_job(
    crawl_agriculture,
    trigger=CronTrigger(month=1, day=1, hour=0, minute=0),
    id='agriculture_crawler',
    name='Agriculture Data Crawler'
)

scheduler.add_job(
    crawl_minerals,
    trigger=CronTrigger(month=1, day=1, hour=1, minute=0),
    id='minerals_crawler',
    name='Minerals Data Crawler'
)

# 数据整合 - 所有爬虫完成后执行
scheduler.add_job(
    merge_all_data,
    trigger=CronTrigger(hour='*/1'),  # 每小时检查一次
    id='data_merger',
    name='Data Merger'
)
```

---

## 风险评估与备选方案

### 主要风险

| 风险 | 可能性 | 影响 | 应对策略 |
|------|--------|------|----------|
| 数据源网站结构变更 | 中 | 高 | 添加异常处理，定期验证爬虫 |
| 爬虫被封禁/限速 | 低 | 中 | 添加请求延迟，使用User-Agent轮换 |
| 数据滞后超过预期 | 高 | 中 | 自动标注滞后信息，用户知晓 |
| GeoJSON文件过大 | 低 | 低 | 使用1:110m简化版本 |

### 备选数据源

如果主要数据源不可用：
- **GDP**: IMF世界经济展望数据库
- **原油**: BP世界能源统计年鉴
- **粮食**: USDA海外农业服务局
- **矿产**: World Bank矿产数据

---

## 开发检查清单

### 开发前准备
- [ ] Python 3.8+ 环境
- [ ] Git配置完成
- [ ] IDE/编辑器准备就绪
- [ ] 网络连接正常（测试数据源可访问）

### 阶段检查点

**阶段1完成后验证**:
- [ ] Flask服务可正常启动
- [ ] API接口返回预期格式
- [ ] 目录结构符合规范

**阶段2完成后验证**:
- [ ] 各爬虫可独立运行
- [ ] 数据文件正确生成
- [ ] 定时任务配置正确

**阶段3完成后验证**:
- [ ] 地图正常显示
- [ ] 国家边界清晰可见
- [ ] 悬停交互正常
- [ ] Tooltip显示完整信息

**阶段4完成后验证**:
- [ ] 前后端数据流完整
- [ ] 所有功能端到端测试通过
- [ ] 数据滞后标注正确显示
- [ ] 代码审查通过

---

## 预计时间表

| 阶段 | 预计工时 | 累计工时 |
|------|----------|----------|
| 阶段1：基础架构 | 2-3小时 | 2-3小时 |
| 阶段2：数据爬取 | 3-4小时 | 5-7小时 |
| 阶段3：前端地图 | 2-3小时 | 7-10小时 |
| 阶段4：整合测试 | 1-2小时 | 8-12小时 |

**总计**：8-12小时

---

## 后续优化方向

1. **数据可视化增强**：添加热力图、趋势图表
2. **数据对比功能**：支持多国数据对比
3. **历史数据趋势**：展示多年数据变化
4. **移动端适配**：优化手机/平板体验
5. **数据导出**：支持CSV/Excel导出
6. **多语言支持**：支持更多语言切换

---

## 参考资源

### 数据源
- Natural Earth Data: https://www.naturalearthdata.com/
- World Bank API: https://data.worldbank.org/
- EIA: https://www.eia.gov/
- FAO FAOSTAT: https://www.fao.org/faostat/
- USGS Minerals: https://www.usgs.gov/centers/national-minerals-information-center

### 技术文档
- Flask: https://flask.palletsprojects.com/
- Leaflet.js: https://leafletjs.com/
- APScheduler: https://apscheduler.readthedocs.io/
- GeoJSON: https://geojson.org/

---

**文档版本**: 1.0  
**创建日期**: 2024-01-15  
**最后更新**: 2024-01-15
