import { clearCountryCache, fetchCountryData } from "./data_loader.js";
import { hideTooltip, initTooltip, moveTooltip, showTooltip } from "./tooltip.js";

const map = L.map("map", {
  minZoom: 2,
  maxZoom: 6,
  worldCopyJump: true,
  zoomSnap: 0.5,
}).setView([20, 0], 2);

// 使用 CartoDB Positron 底图（无行政边界，仅显示地形和海岸线）
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>",
  subdomains: "abcd",
  maxZoom: 7,
}).addTo(map);

initTooltip();
initCountryDetailsPanel();

let geojsonLayer;
let activeIso = null;

const baseStyle = {
  color: "#2a3f4a",
  weight: 1,
  fillColor: "#d6c3a2",
  fillOpacity: 0.85,
};

const highlightStyle = {
  color: "#b76e4c",
  weight: 2,
  fillOpacity: 0.95,
};

const refreshButton = document.getElementById("refresh-data");
const refreshStatus = document.getElementById("refresh-status");

// 主要国家集合（小比例时显示这些国家的首都）
const MAJOR_COUNTRIES = new Set([
  "CHN", "JPN", "IND", "KAZ", "IRN", 
  "SAU", "SGP", "THA", "PHL", "VNM", "AUS", "NZL",
  "USA", "CAN", "MEX", "COL", "VEN", "PER", "BRA", "ARG",
  "GBR", "RUS", "MNG", "FRA", "DEU", "ITA", "TUR",
  "EGY", "ZAF", "SEN", "ETH", "KEN", "COD"
]);

// 存储所有首都标记
const capitalMarkers = [];
let capitalsLoaded = false;

// 标签朝左的国家（其他默认朝右）
const LEFT_LABEL_COUNTRIES = new Set(["GBR", "CAN", "COL", "THA"]);

// 需要过滤掉的首都（按国家和城市名）
const EXCLUDED_CAPITALS = [
  { iso: "ZAF", name: "Bloemfontein" } // 南非布隆方丹
];

// 国家中文名称映射表
const COUNTRY_NAMES_ZH = {
  "CHN": "中国", "USA": "美国", "JPN": "日本", "IND": "印度", "RUS": "俄罗斯",
  "GBR": "英国", "FRA": "法国", "DEU": "德国", "ITA": "意大利", "ESP": "西班牙",
  "CAN": "加拿大", "MEX": "墨西哥", "BRA": "巴西", "ARG": "阿根廷", "AUS": "澳大利亚",
  "ZAF": "南非", "EGY": "埃及", "KOR": "韩国", "IDN": "印度尼西亚", "SAU": "沙特阿拉伯",
  "TUR": "土耳其", "IRN": "伊朗", "THA": "泰国", "VNM": "越南", "PAK": "巴基斯坦",
  "BGD": "孟加拉国", "PHL": "菲律宾", "MYS": "马来西亚", "MMR": "缅甸", "KHM": "柬埔寨",
  "LAO": "老挝", "SGP": "新加坡", "CHN-HK": "中国香港", "TWN": "中国台湾",
  "CHN-MO": "中国澳门", "MNG": "蒙古", "KAZ": "哈萨克斯坦", "UZB": "乌兹别克斯坦",
  "TKM": "土库曼斯坦", "KGZ": "吉尔吉斯斯坦", "TJK": "塔吉克斯坦", "AFG": "阿富汗",
  "IRQ": "伊拉克", "SYR": "叙利亚", "JOR": "约旦", "LBN": "黎巴嫩", "ISR": "以色列",
  "PSE": "巴勒斯坦（约旦河西岸与加沙）", "PSX": "巴勒斯坦（约旦河西岸与加沙）", "YEM": "也门", "OMN": "阿曼", "ARE": "阿联酋", "QAT": "卡塔尔",
  "KWT": "科威特", "BHR": "巴林", "LKA": "斯里兰卡", "MDV": "马尔代夫", "NPL": "尼泊尔",
  "BTN": "不丹", "UKR": "乌克兰", "POL": "波兰", "ROU": "罗马尼亚",
  "CZE": "捷克", "SVK": "斯洛伐克", "HUN": "匈牙利", "AUT": "奥地利", "CHE": "瑞士",
  "NLD": "荷兰", "BEL": "比利时", "DNK": "丹麦", "NOR": "挪威", "SWE": "瑞典",
  "FIN": "芬兰", "IRL": "爱尔兰", "PRT": "葡萄牙", "GRC": "希腊", "BGR": "保加利亚",
  "SRB": "塞尔维亚", "HRV": "克罗地亚", "SVN": "斯洛文尼亚", "BIH": "波黑",
  "MKD": "北马其顿", "ALB": "阿尔巴尼亚", "MNE": "黑山", "MDA": "摩尔多瓦",
  "BLR": "白俄罗斯", "LTU": "立陶宛", "LVA": "拉脱维亚", "EST": "爱沙尼亚",
  "ISL": "冰岛", "NZL": "新西兰", "PNG": "巴布亚新几内亚", "FJI": "斐济",
  "NCL": "新喀里多尼亚", "PYF": "法属波利尼西亚", "GUM": "关岛", "PLW": "帕劳",
  "MNP": "北马里亚纳群岛", "ASM": "美属萨摩亚", "TON": "汤加", "WSM": "萨摩亚",
  "KIR": "基里巴斯", "TUV": "图瓦卢", "NRU": "瑙鲁", "VUT": "瓦努阿图",
  "SLB": "所罗门群岛", "VCT": "圣文森特和格林纳丁斯", "LCA": "圣卢西亚",
  "DMA": "多米尼克", "ATG": "安提瓜和巴布达", "KNA": "圣基茨和尼维斯",
  "GRD": "格林纳达", "TTO": "特立尼达和多巴哥", "BRB": "巴巴多斯",
  "COL": "哥伦比亚", "VEN": "委内瑞拉", "GUY": "圭亚那",
  "SUR": "苏里南", "GUF": "法属圭亚那", "PER": "秘鲁", "BOL": "玻利维亚",
  "PRY": "巴拉圭", "URY": "乌拉圭", "CHL": "智利", "ECU": "厄瓜多尔",
  "GTM": "危地马拉", "BLZ": "伯利兹", "HND": "洪都拉斯", "SLV": "萨尔瓦多",
  "NIC": "尼加拉瓜", "CRI": "哥斯达黎加", "PAN": "巴拿马", "CUB": "古巴",
  "JAM": "牙买加", "HTI": "海地", "DOM": "多米尼加", "PRI": "波多黎各",
  "DZA": "阿尔及利亚", "MAR": "摩洛哥", "TUN": "突尼斯",
  "LBY": "利比亚", "SDN": "苏丹", "ETH": "埃塞俄比亚", "ERI": "厄立特里亚",
  "AGO": "安哥拉", "GEO": "格鲁吉亚", "AZE": "阿塞拜疆", "ARM": "亚美尼亚",
  "CYP": "塞浦路斯", "XKX": "科索沃", "CYN": "北塞浦路斯",
  "DJI": "吉布提", "SOM": "索马里", "KEN": "肯尼亚", "UGA": "乌干达",
  "RWA": "卢旺达", "BDI": "布隆迪", "TZA": "坦桑尼亚", "MWI": "马拉维",
  "ZMB": "赞比亚", "ZWE": "津巴布韦", "MOZ": "莫桑比克", "MDG": "马达加斯加",
  "MUS": "毛里求斯", "COM": "科摩罗", "SYC": "塞舌尔", "REU": "留尼汪",
  "MYT": "马约特", "GAB": "加蓬", "GNQ": "赤道几内亚", "COG": "刚果（布）",
  "COD": "刚果（金）", "CAF": "中非", "TCD": "乍得", "CMR": "喀麦隆",
  "NGA": "尼日利亚", "BEN": "贝宁", "TGO": "多哥", "GHA": "加纳",
  "CIV": "科特迪瓦", "LBR": "利比里亚", "SLE": "塞拉利昂", "GIN": "几内亚",
  "GNB": "几内亚比绍", "SEN": "塞内加尔", "GMB": "冈比亚", "MLI": "马里",
  "BFA": "布基纳法索", "NER": "尼日尔", "MRT": "毛里塔尼亚", "ESH": "西撒哈拉",
  "LSO": "莱索托", "SWZ": "斯威士兰", "NAM": "纳米比亚", "BWA": "博茨瓦纳"
};

// 存储国家首都信息
const countryCapitals = new Map();

// 手动设置特殊国家首都（补充数据中没有的）
const MANUAL_CAPITALS = {
  "PSX": "耶路撒冷",  // 巴勒斯坦首都
  "PSE": "耶路撒冷"   // 巴勒斯坦ISO代码
};

function setRefreshStatus(message) {
  if (refreshStatus) {
    refreshStatus.textContent = message;
  }
}

async function refreshAllData() {
  if (!refreshButton) {
    return;
  }
  refreshButton.disabled = true;
  setRefreshStatus("正在刷新数据...");

  try {
    const response = await fetch("/api/data/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "all" }),
    });
    if (!response.ok) {
      throw new Error("刷新失败");
    }
    const payload = await response.json();
    clearCountryCache();
    const stamp = payload?.last_crawl || payload?.generated_at || "";
    setRefreshStatus(stamp ? `已更新: ${stamp}` : "已更新");
  } catch (error) {
    setRefreshStatus("刷新失败");
  } finally {
    refreshButton.disabled = false;
  }
}

function resolveIso(props) {
  const iso = props?.ADM0_A3 || props?.ISO_A3 || props?.ISO_A3_EH || props?.ISO3;
  return iso;
}

function resolveName(props) {
  const iso = resolveIso(props);
  // 优先使用中文名称映射
  if (iso && COUNTRY_NAMES_ZH[iso]) {
    return COUNTRY_NAMES_ZH[iso];
  }
  // 如果没有中文映射，返回英文名称
  return props?.ADMIN || props?.NAME_LONG || props?.NAME || "未知";
}

function formatCompact(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  const absolute = Math.abs(value);
  const units = [
    { limit: 1e12, label: "万亿" },
    { limit: 1e9, label: "十亿" },
    { limit: 1e6, label: "兆" },
    { limit: 1e3, label: "千" },
  ];
  for (const unit of units) {
    if (absolute >= unit.limit) {
      return `${(value / unit.limit).toFixed(3)} ${unit.label}`;
    }
  }
  return Number(value).toFixed(3);
}

function initCountryDetailsPanel() {
  const panel = document.getElementById("country-detail");
  if (!panel) {
    return;
  }

  const nameEl = panel.querySelector("[data-role='country-name']");
  const metaEl = panel.querySelector("[data-role='country-meta']");
  const metricsEl = panel.querySelector("[data-role='country-metrics']");

  const safeText = (value) => (value === null || value === undefined ? "—" : value);

  const buildMetric = ({ icon, label, value, unit, note }) => {
    if (value === null || value === undefined || value === "—") {
      return "";
    }
    const noteHtml = note ? `<div class="detail-note">${note}</div>` : "";
    return `
      <div class="detail-card">
        <div class="detail-card-header">
          <span class="detail-icon">${icon}</span>
          <span class="detail-label">${label}</span>
        </div>
        <div class="detail-value">${value}${unit ? ` ${unit}` : ""}</div>
        ${noteHtml}
      </div>
    `;
  };

  const render = (detail) => {
    if (!detail) {
      if (nameEl) {
        nameEl.textContent = "选择国家";
      }
      if (metaEl) {
        metaEl.textContent = "点击高亮国家查看详情。";
      }
      if (metricsEl) {
        metricsEl.innerHTML = "";
      }
      return;
    }

    const { name, capital, data } = detail;
    if (nameEl) {
      nameEl.textContent = safeText(name);
    }
    if (metaEl) {
      const capitalText = capital ? `首都: ${capital}` : "首都: —";
      metaEl.textContent = capitalText;
    }

    if (!metricsEl) {
      return;
    }

    if (!data) {
      metricsEl.innerHTML = "<div class=\"detail-empty\">无可用数据。</div>";
      return;
    }

    const gdpCompact = formatCompact(data?.gdp?.value);
    const oilCompact = formatCompact(data?.oil_production?.value);
    const grainCompact = formatCompact(data?.grain_production?.total);
    const metals = data?.nonferrous_metals;
    const goldCompact = formatCompact(data?.gold_production?.value);
    const gdpValue = gdpCompact ? `$${gdpCompact}` : "—";
    const oilValue = oilCompact || "—";
    const grainValue = grainCompact || "—";
    const goldValue = goldCompact || "—";

    const metricsHtml = [
      buildMetric({
        icon: "💵",
        label: "GDP",
        value: gdpValue,
        unit: data?.gdp?.unit,
        note: data?.gdp?.lag_note,
      }),
      buildMetric({
        icon: "🛢️",
        label: "石油",
        value: oilValue,
        unit: data?.oil_production?.unit,
        note: data?.oil_production?.lag_note,
      }),
      buildMetric({
        icon: "🌾",
        label: "粮食",
        value: grainValue,
        unit: data?.grain_production?.unit,
        note: data?.grain_production?.lag_note,
      }),
      buildMetric({
        icon: "🏅",
        label: "黄金",
        value: goldValue,
        unit: data?.gold_production?.unit,
        note: data?.gold_production?.lag_note,
      }),
    ]
      .filter(Boolean)
      .join("");

    const categoryLabels = {
      aluminum: "铝",
      copper: "铜",
      nickel: "镍"
    };

    const metalsHtml = metals?.by_category
      ? `<div class="detail-card">
          <div class="detail-card-header">
            <span class="detail-icon">⛏️</span>
            <span class="detail-label">有色金属</span>
          </div>
          <div class="detail-sublist">
            ${Object.entries(metals.by_category)
              .map(([key, value]) => {
                const compact = formatCompact(value);
                if (!compact) {
                  return "";
                }
                const label = categoryLabels[key] || key;
                return `<div class="detail-subitem"><span>${label}</span><span>${compact}</span></div>`;
              })
              .filter(Boolean)
              .join("")}
          </div>
          ${metals?.unit ? `<div class="detail-unit">单位: ${metals.unit}</div>` : ""}
          ${metals?.lag_note ? `<div class="detail-note">${metals.lag_note}</div>` : ""}
        </div>`
      : "";

    const fullHtml = `${metricsHtml}${metalsHtml}`.trim();
    metricsEl.innerHTML = fullHtml || "<div class=\"detail-empty\">无可用数据。</div>";
  };

  window.addEventListener("country:select", (event) => {
    render(event.detail);
  });
}

function renderMetric(label, value, unit, note) {
  if (value === null || value === undefined) {
    return "";
  }
  const noteHtml = note ? `<div class="metric-note">${note}</div>` : "";
  return `
    <div class="metric">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}${unit ? ` ${unit}` : ""}</div>
      ${noteHtml}
    </div>
  `;
}

function buildTooltipContent({ name, capital, data, loading }) {
  const title = `<h3>${name}</h3>`;
  const capitalLine = capital
    ? `<p>首都: ${capital}</p>`
    : `<p>首都: —</p>`;

  if (loading) {
    return `${title}${capitalLine}<div class="metric">正在加载数据...</div>`;
  }

  if (!data) {
    return `${title}${capitalLine}<div class="metric">无可用数据。</div>`;
  }

  const number = (value) => (value === null || value === undefined ? null : value);

  const metrics = [
    renderMetric(
      "GDP",
      formatCompact(number(data?.gdp?.value)),
      data?.gdp?.unit,
      data?.gdp?.lag_note
    ),
    renderMetric(
      "石油产量",
      formatCompact(number(data?.oil_production?.value)),
      data?.oil_production?.unit,
      data?.oil_production?.lag_note
    ),
    renderMetric(
      "粮食产量",
      formatCompact(number(data?.grain_production?.total)),
      data?.grain_production?.unit,
      data?.grain_production?.lag_note
    ),
  ].filter(Boolean).join("");

  const metals = data?.nonferrous_metals;
  const categoryLabels = {
    aluminum: "铝",
    copper: "铜",
    nickel: "镍"
  };

  const renderLocalizedSublist = (items) => {
    if (!items || Object.keys(items).length === 0) {
      return "";
    }
    const listItems = Object.entries(items)
      .map(([key, value]) => {
        const compact = formatCompact(value);
        if (!compact) {
          return "";
        }
        const label = categoryLabels[key] || key;
        return `<li>${label}: ${compact}</li>`;
      })
      .filter(Boolean)
      .join("");
    if (!listItems) {
      return "";
    }
    return `<ul class="metric-sublist">${listItems}</ul>`;
  };

  const metalsSection = metals
    ? `
        <div class="metric">
          <div class="metric-label">有色金属产量</div>
          <div class="metric-value">年份 ${metals?.year || "—"}${
            metals?.unit ? ` · ${metals.unit}` : ""
          }</div>
           ${renderLocalizedSublist(metals?.by_category)}
          ${metals?.lag_note ? `<div class="metric-note">${metals.lag_note}</div>` : ""}
        </div>
      `
    : "";

  const gold = data?.gold_production
    ? renderMetric(
        "黄金产量",
        formatCompact(number(data?.gold_production?.value)),
        data?.gold_production?.unit,
        data?.gold_production?.lag_note
      )
    : "";

  return `${title}${capitalLine}${metrics}${metalsSection}${gold}`;
}

function onEachFeature(feature, layer) {
  const props = feature.properties || {};
  const name = resolveName(props);
  const iso = resolveIso(props);
  // 从已加载的首都数据中获取
  const capital = countryCapitals.get(iso);

  layer.on({
    mouseover: async (event) => {
      activeIso = iso;
      layer.setStyle(highlightStyle);
      showTooltip(event, buildTooltipContent({ name, capital, loading: true }));

      if (!iso || iso === "-99") {
        showTooltip(event, buildTooltipContent({ name, capital, data: null }));
        return;
      }

      const data = await fetchCountryData(iso);
      if (activeIso !== iso) {
        return;
      }
      const resolvedCapital = data?.capital || capital;
      showTooltip(event, buildTooltipContent({ name, capital: resolvedCapital, data }));
    },
    mousemove: (event) => {
      moveTooltip(event);
    },
    mouseout: () => {
      layer.setStyle(baseStyle);
      hideTooltip();
    },
    click: async (event) => {
      activeIso = iso;
      if (!iso || iso === "-99") {
        window.dispatchEvent(
          new CustomEvent("country:select", {
            detail: { name, capital, iso, data: null },
          })
        );
        return;
      }
      const data = await fetchCountryData(iso);
      if (activeIso !== iso) {
        return;
      }
      const resolvedCapital = data?.capital || capital;
      window.dispatchEvent(
        new CustomEvent("country:select", {
          detail: { name, capital: resolvedCapital, iso, data },
        })
      );
    },
  });
}

// 更新首都标记显示（根据缩放级别）
function updateCapitalVisibility() {
  const currentZoom = map.getZoom();
  const showAll = currentZoom >= 4; // 放大到级别4以上显示所有首都
  
  capitalMarkers.forEach(({ marker, iso }) => {
    const isMajor = MAJOR_COUNTRIES.has(iso);
    if (isMajor || showAll) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });
}

// 先加载首都数据，再加载地图
async function initializeMap() {
  try {
    // 1. 先加载首都数据
    const placesResponse = await fetch("/static/geojson/populated_places_50m.geojson");
    const places = await placesResponse.json();
    
    const features = places?.features || [];
    for (const feature of features) {
      const props = feature.properties || {};
      if (props.ADM0CAP !== 1) {
        continue;
      }
      const countryIso = props.ADM0_A3 || props.SOV_A3;
      if (!countryIso) {
        continue;
      }
      
      // 过滤台湾和索马里兰的首都（已合并到各自国家）
      if (countryIso === "TWN" || countryIso === "SOL") {
        continue;
      }
      
      // 优先使用中文名称，如果没有则使用英文
      const name = props.NAME_ZH || props.NAME || props.NAME_EN;
      const lat = feature.geometry?.coordinates?.[1] ?? props.LATITUDE;
      const lon = feature.geometry?.coordinates?.[0] ?? props.LONGITUDE;
      if (!name || lat === undefined || lon === undefined) {
        continue;
      }
      
      // 检查是否需要过滤掉这个城市
      const shouldExclude = EXCLUDED_CAPITALS.some(
        ex => ex.iso === countryIso && (ex.name === props.NAME || ex.name === props.NAME_EN)
      );
      if (shouldExclude) {
        continue;
      }
      
      // 存储首都信息供后续使用
      countryCapitals.set(countryIso, name);
      
      // 确定标签方向
      const isLeftLabel = LEFT_LABEL_COUNTRIES.has(countryIso);
      const labelDirection = isLeftLabel ? "left" : "right";
      const labelOffset = isLeftLabel ? [-5, 0] : [5, 0];
      
      // 创建首都标记（但不立即显示）
      const marker = L.circleMarker([lat, lon], {
        radius: 3,
        color: "#b76e4c",
        weight: 1,
        fillColor: "#b76e4c",
        fillOpacity: 0.9,
      });
      
      // 绑定首都名称标签（根据设置决定方向）
      marker.bindTooltip(name, {
        permanent: true,
        direction: labelDirection,
        offset: labelOffset,
        className: "capital-label",
        opacity: 0.9,
      });
      
      // 存储标记信息
      capitalMarkers.push({ marker, iso: countryIso });
    }
    
    // 添加手动设置的特殊国家首都
    for (const [iso, capital] of Object.entries(MANUAL_CAPITALS)) {
      if (!countryCapitals.has(iso)) {
        countryCapitals.set(iso, capital);
      }
    }
    
    capitalsLoaded = true;
    
    // 2. 再加载世界地图（此时 countryCapitals 已填充）
    const worldResponse = await fetch("/static/geojson/world_50m_custom.geojson");
    const geojson = await worldResponse.json();
    
    geojsonLayer = L.geoJSON(geojson, {
      style: baseStyle,
      onEachFeature,
    }).addTo(map);
    
    // 3. 根据当前缩放级别显示首都
    updateCapitalVisibility();
    
  } catch (error) {
    showTooltip(
      { originalEvent: { pageX: 40, pageY: 40 } },
      "<div class=\"metric\">地图数据文件未找到。请在 static/geojson 目录下放置 world_50m_custom.geojson 文件。</div>"
    );
  }
}

// 启动初始化
initializeMap();

if (refreshButton) {
  refreshButton.addEventListener("click", refreshAllData);
}

// 监听缩放事件，动态更新首都显示
map.on("zoomend", () => {
  if (capitalsLoaded) {
    updateCapitalVisibility();
  }
});
