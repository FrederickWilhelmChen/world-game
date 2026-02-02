# 数据源说明

本项目使用的公开数据源如下，所有数据按爬虫任务落地到 `data/raw`，并由合并任务生成 `data/merged/countries_data.json` 供前端查询。

## GDP

- 来源: World Bank API (indicator: NY.GDP.MKTP.CD)
- 抓取方式: `backend/crawler/worldbank_gdp.py`
- 更新时间: 季度刷新（scheduler），前端刷新按钮触发时可立即更新
- 落地目录: `data/raw/gdp/*.json`

## 原油产量

- 来源: Our World in Data (energy-data.csv, oil_production)
- 抓取方式: `backend/crawler/eia_oil.py`
- 单位: 桶/日（由 TWh 近似折算）
- 落地目录: `data/raw/oil/*.json`

## 粮食产量

- 来源: Our World in Data grapher CSV (wheat/rice/maize production)
- 抓取方式: `backend/crawler/fao_agriculture.py`
- 单位: 吨/年
- 落地目录: `data/raw/agriculture/*.json`

## 有色金属产量

- 来源: USGS Mineral Commodity Summaries (MCS) Excel
- 抓取方式: `backend/crawler/usgs_minerals.py`
- 单位: 吨/年
- 落地目录: `data/raw/minerals/*.json`

## 黄金产量

- 来源: USGS Mineral Commodity Summaries 2025 (MCS) - ScienceBase 数据发布
- 数据验证: 中国 ~380 吨/年，澳大利亚 ~290-296 吨/年（符合实际）
- 抓取方式: `backend/crawler/usgs_minerals.py`
- 备用来源: Wikipedia - Lists of countries by mineral production（当 USGS 不可访问时自动切换）
- 单位: 公斤/年（数据源为 metric tons，已转换为公斤）
- 落地目录: `data/raw/minerals/*.json`

## 数据刷新入口

- 后端接口: `POST /api/data/refresh`，可选参数 `scope` (`gdp`/`oil`/`agriculture`/`minerals`/`all`)
- 前端按钮: `frontend/index.html` 的 “Refresh data” 按钮调用该接口
