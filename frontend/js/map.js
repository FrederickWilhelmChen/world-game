import { clearCountryCache, fetchCountryData } from "./data_loader.js";
import { hideTooltip, initTooltip, moveTooltip, showTooltip } from "./tooltip.js";
import { formatCompact, formatLocaleNumber } from "./formatters.js";
import DataViz from "./data_viz.js";

const map = L.map("map", {
  minZoom: 2,
  maxZoom: 6,
  zoomSnap: 0.5,
  // 禁用地球环绕，防止左右两端出现空白
  worldCopyJump: false,
  // 限制地图边界到单个世界，避免多个地球副本
  maxBounds: [[-90, -180], [90, 180]],
  maxBoundsViscosity: 1.0,
}).setView([20, 0], 2);

// 让地图在容器中尽量“铺满”横向空间，减少两侧空白。
// Leaflet 默认以世界宽度适配当前缩放级别；在宽屏容器里会出现左右留白。
function fitWorldToViewport() {
  try {
    const size = map.getSize();
    if (!size || !size.x) {
      return;
    }
    // WebMercator 世界在 zoom=0 时宽度为 256px；每 +1 zoom 宽度翻倍。
    // 取能覆盖当前容器宽度的最小 zoom。
    const targetZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Math.ceil(Math.log2(size.x / 256))));
    const current = map.getZoom();
    if (Number.isFinite(targetZoom) && targetZoom !== current) {
      map.setZoom(targetZoom, { animate: false });
    }
  } catch (e) {
    // Ignore.
  }
}

// 初次加载和窗口尺寸变化时重新适配。
fitWorldToViewport();
window.addEventListener("resize", () => {
  // 等布局稳定后再计算
  window.requestAnimationFrame(() => {
    map.invalidateSize({ pan: false, animate: false });
    fitWorldToViewport();
  });
});

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

// Four blue shades (4-color palette). Used for adjacent-country coloring.
const BLUE_PALETTE = [
  "#d9f0ff",
  "#bfe4ff",
  "#8fc9ff",
  "#66afe6",
];

// Special-case China with a non-blue fill to avoid any adjacency misses.
const CHINA_OVERRIDE_COLOR = "#f0c27b";

const countryColorByIso = new Map();

// Data-driven colors (for visualization mode)
const dataColorsByIso = new Map();
let isDataColorMode = false;

let hoverPopLayer = null;
let hoverPopIso = null;
let hoverPopRemoveTimer = null;

let hoverIso = null;
let hoverLeaveTimer = null;

const countryLayersByIso = new Map();
const countryFeaturesByIso = new Map();
const countryDisplayNameByIso = new Map();

const hoverFetchPromises = new Map();

// Data visualization instance
let dataVizInstance = null;

// Store all countries data for visualization
const allCountriesData = {};

function hashString(value) {
  if (!value) {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function countryFillColor(iso) {
  if (!iso || iso === "-99") {
    return "#b9cde0";
  }

  // Use data-driven colors in visualization mode
  if (isDataColorMode && dataColorsByIso.has(String(iso))) {
    return dataColorsByIso.get(String(iso));
  }
  
  // In data color mode but not in top 10, use a neutral gray (darker for better visibility)
  if (isDataColorMode) {
    return "#d4d4d4";
  }

  if (String(iso).toUpperCase() === "CHN") {
    return CHINA_OVERRIDE_COLOR;
  }

  const mapped = countryColorByIso.get(String(iso));
  if (mapped) {
    return mapped;
  }

  const idx = hashString(String(iso)) % BLUE_PALETTE.length;
  return BLUE_PALETTE[idx];
}

function geometryRings(geometry) {
  if (!geometry || !geometry.type) {
    return [];
  }
  if (geometry.type === "Polygon") {
    return geometry.coordinates || [];
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates || [];
    const rings = [];
    polygons.forEach((polygon) => {
      (polygon || []).forEach((ring) => {
        rings.push(ring);
      });
    });
    return rings;
  }
  return [];
}

function buildFourColorMap(worldGeojson) {
  countryColorByIso.clear();

  const segToIsos = new Map();
  const nodes = new Set();
  const SCALE = 10000; // 1e-4 deg quantization to stabilize shared edges

  const coordKey = (coord) => {
    const x = Math.round((coord?.[0] ?? 0) * SCALE);
    const y = Math.round((coord?.[1] ?? 0) * SCALE);
    return `${x},${y}`;
  };

  const segKey = (a, b) => {
    const ak = coordKey(a);
    const bk = coordKey(b);
    return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
  };

  const addSeg = (iso, a, b) => {
    const key = segKey(a, b);
    if (!segToIsos.has(key)) {
      segToIsos.set(key, new Set());
    }
    segToIsos.get(key).add(iso);
  };

  const features = worldGeojson?.features || [];
  for (const feature of features) {
    const props = feature?.properties || {};
    const iso = resolveIso(props);
    if (!iso || iso === "-99") {
      continue;
    }
    const isoKey = String(iso);
    nodes.add(isoKey);

    const rings = geometryRings(feature?.geometry);
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 2) {
        continue;
      }
      const firstKey = coordKey(ring[0]);
      const lastKey = coordKey(ring[ring.length - 1]);
      const closed = firstKey === lastKey;
      const limit = closed ? ring.length - 1 : ring.length;
      if (limit < 2) {
        continue;
      }
      for (let i = 0; i < limit; i += 1) {
        const a = ring[i];
        const b = ring[(i + 1) % limit];
        addSeg(isoKey, a, b);
      }
    }
  }

  const neighbors = new Map();
  nodes.forEach((iso) => {
    neighbors.set(iso, new Set());
  });

  for (const isoSet of segToIsos.values()) {
    if (!isoSet || isoSet.size < 2) {
      continue;
    }
    const list = Array.from(isoSet);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        neighbors.get(a)?.add(b);
        neighbors.get(b)?.add(a);
      }
    }
  }

  // DSATUR greedy coloring with 4 colors.
  const colorIndex = new Map();
  const satColors = new Map();
  nodes.forEach((iso) => {
    satColors.set(iso, new Set());
  });

  const degree = (iso) => neighbors.get(iso)?.size || 0;
  const saturation = (iso) => satColors.get(iso)?.size || 0;

  while (colorIndex.size < nodes.size) {
    let pick = null;
    for (const iso of nodes) {
      if (colorIndex.has(iso)) {
        continue;
      }
      if (!pick) {
        pick = iso;
        continue;
      }
      const s1 = saturation(iso);
      const s2 = saturation(pick);
      if (s1 !== s2) {
        if (s1 > s2) {
          pick = iso;
        }
        continue;
      }
      const d1 = degree(iso);
      const d2 = degree(pick);
      if (d1 !== d2) {
        if (d1 > d2) {
          pick = iso;
        }
        continue;
      }
      if (String(iso) < String(pick)) {
        pick = iso;
      }
    }

    const used = new Set();
    (neighbors.get(pick) || new Set()).forEach((nb) => {
      const c = colorIndex.get(nb);
      if (c !== undefined && c !== null) {
        used.add(c);
      }
    });

    let chosen = null;
    for (let c = 0; c < BLUE_PALETTE.length; c += 1) {
      if (!used.has(c)) {
        chosen = c;
        break;
      }
    }
    if (chosen === null) {
      // Should be rare; fall back to any color.
      chosen = 0;
    }

    colorIndex.set(pick, chosen);
    (neighbors.get(pick) || new Set()).forEach((nb) => {
      if (colorIndex.has(nb)) {
        return;
      }
      satColors.get(nb)?.add(chosen);
    });
  }

  for (const [iso, idx] of colorIndex.entries()) {
    countryColorByIso.set(iso, BLUE_PALETTE[idx]);
  }
}

function baseStyle(feature) {
  const props = feature?.properties || {};
  const iso = resolveIso(props);
  return {
    stroke: false,
    fillColor: countryFillColor(iso),
    fillOpacity: 0.76,
  };
}

function hoverStyle(feature) {
  const props = feature?.properties || {};
  const iso = resolveIso(props);
  return {
    stroke: true,
    color: "rgba(234, 247, 255, 0.95)",
    weight: 0.55,
    fillColor: countryFillColor(iso),
    // Keep the base shape mostly transparent on hover so the pop layer
    // can scale without creating a double-filled "ghost".
    fillOpacity: 0.04,
    lineJoin: "round",
  };
}

function popStyle(feature) {
  const props = feature?.properties || {};
  const iso = resolveIso(props);
  return {
    interactive: false,
    stroke: false,
    fillColor: countryFillColor(iso),
    fillOpacity: 0.92,
  };
}

function explodeFeatureToPolygons(feature) {
  if (!feature || feature.type !== "Feature") {
    return [];
  }
  const geom = feature.geometry;
  if (!geom || !geom.type) {
    return [];
  }

  const base = {
    type: "Feature",
    properties: feature.properties || {},
  };

  if (geom.type === "Polygon") {
    return [{ ...base, geometry: geom }];
  }
  if (geom.type === "MultiPolygon") {
    const coords = geom.coordinates || [];
    return coords.map((coordinates) => ({
      ...base,
      geometry: { type: "Polygon", coordinates },
    }));
  }

  return [];
}

function explodeGeojsonToPolygons(input) {
  if (!input) {
    return null;
  }

  const features = [];

  if (input.type === "FeatureCollection") {
    for (const feature of input.features || []) {
      features.push(...explodeFeatureToPolygons(feature));
    }
  } else if (input.type === "Feature") {
    features.push(...explodeFeatureToPolygons(input));
  } else {
    return input;
  }

  if (features.length === 0) {
    return input;
  }
  return { type: "FeatureCollection", features };
}

function getLayerElement(layer) {
  return layer?.getElement ? layer.getElement() : layer?._path;
}

function triggerJelly(el, className) {
  if (!el) {
    return;
  }
  el.classList.remove("country-jelly-in", "country-jelly-out");
  try {
    // Force reflow so animation can retrigger.
    void el.getBoundingClientRect();
  } catch (error) {
    // Ignore.
  }
  el.classList.add(className);
}

function clearHoverPopTimer() {
  if (!hoverPopRemoveTimer) {
    return;
  }
  clearTimeout(hoverPopRemoveTimer);
  hoverPopRemoveTimer = null;
}

function clearHoverLeaveTimer() {
  if (!hoverLeaveTimer) {
    return;
  }
  clearTimeout(hoverLeaveTimer);
  hoverLeaveTimer = null;
}

function removeHoverPopNow() {
  clearHoverPopTimer();
  if (hoverPopLayer) {
    map.removeLayer(hoverPopLayer);
  }
  hoverPopLayer = null;
  hoverPopIso = null;
}

function applyPopClasses(className) {
  if (!hoverPopLayer) {
    return;
  }
  hoverPopLayer.eachLayer((layer) => {
    const el = getLayerElement(layer);
    if (!el) {
      return;
    }
    el.classList.add("country-shape", "country-pop");
    triggerJelly(el, className);
  });
}

function showHoverPop(feature, iso) {
  clearHoverPopTimer();
  if (hoverPopLayer && hoverPopIso === iso) {
    // Already showing this country's pop layer.
    applyPopClasses("country-jelly-in");
    return;
  }

  removeHoverPopNow();
  hoverPopIso = iso;
  const exploded = explodeGeojsonToPolygons(feature);
  hoverPopLayer = L.geoJSON(exploded, {
    style: popStyle,
    interactive: false,
  }).addTo(map);

  // Defer class injection to ensure SVG path exists.
  requestAnimationFrame(() => {
    applyPopClasses("country-jelly-in");
    if (hoverPopLayer?.bringToFront) {
      hoverPopLayer.bringToFront();
    }
  });
}

function hideHoverPop() {
  if (!hoverPopLayer) {
    return;
  }
  applyPopClasses("country-jelly-out");
  clearHoverPopTimer();
  hoverPopRemoveTimer = setTimeout(() => {
    removeHoverPopNow();
  }, 540);
}

function indexCountries() {
  countryLayersByIso.clear();
  countryFeaturesByIso.clear();
  countryDisplayNameByIso.clear();

  if (!geojsonLayer) {
    return;
  }

  geojsonLayer.eachLayer((layer) => {
    const feature = layer?.feature;
    const props = feature?.properties || {};
    const iso = resolveIso(props);
    if (!iso || iso === "-99") {
      return;
    }

    if (!countryLayersByIso.has(iso)) {
      countryLayersByIso.set(iso, new Set());
    }
    countryLayersByIso.get(iso).add(layer);

    if (!countryFeaturesByIso.has(iso)) {
      countryFeaturesByIso.set(iso, []);
    }
    countryFeaturesByIso.get(iso).push(feature);

    if (!countryDisplayNameByIso.has(iso)) {
      countryDisplayNameByIso.set(iso, resolveName(props));
    }
  });
}

function setIsoStyle(iso, styleFn) {
  const layers = countryLayersByIso.get(iso);
  if (!layers) {
    return;
  }
  layers.forEach((layer) => {
    const feature = layer?.feature;
    if (!feature) {
      return;
    }
    layer.setStyle(styleFn(feature));
  });
}

function featureCollectionForIso(iso) {
  const features = countryFeaturesByIso.get(iso);
  if (!features || features.length === 0) {
    return null;
  }
  return {
    type: "FeatureCollection",
    features,
  };
}

async function fetchCountryDataDedup(iso) {
  if (!iso || iso === "-99") {
    return null;
  }
  if (hoverFetchPromises.has(iso)) {
    return hoverFetchPromises.get(iso);
  }
  const promise = fetchCountryData(iso).finally(() => {
    hoverFetchPromises.delete(iso);
  });
  hoverFetchPromises.set(iso, promise);
  return promise;
}

function scheduleHoverLeave(iso) {
  clearHoverLeaveTimer();
  hoverLeaveTimer = setTimeout(() => {
    if (hoverIso !== iso) {
      return;
    }
    hideHoverPop();
    setIsoStyle(iso, baseStyle);
    hoverIso = null;
    hideTooltip();
  }, 110);
}

// Apply data-driven colors to map
function applyDataColors(colorMap) {
  dataColorsByIso.clear();
  
  if (colorMap && colorMap.size > 0) {
    isDataColorMode = true;
    colorMap.forEach((color, iso) => {
      dataColorsByIso.set(iso, color);
    });
  } else {
    isDataColorMode = false;
  }

  // Update all country styles
  if (geojsonLayer) {
    geojsonLayer.eachLayer((layer) => {
      const feature = layer?.feature;
      if (feature) {
        layer.setStyle(baseStyle(feature));
      }
    });
  }
}

// Handle country highlight event from data viz
window.addEventListener('country:highlight', (event) => {
  const iso = event.detail?.iso;
  if (!iso) return;

  // Find the country layer and simulate a click
  const layers = countryLayersByIso.get(iso);
  if (layers && layers.size > 0) {
    const firstLayer = Array.from(layers)[0];
    // Trigger hover effect
    if (hoverIso && hoverIso !== iso) {
      setIsoStyle(hoverIso, baseStyle);
    }
    hoverIso = iso;
    setIsoStyle(iso, hoverStyle);
    
    const collection = featureCollectionForIso(iso);
    if (collection) {
      showHoverPop(collection, iso);
    }

    // Pan map to country if possible
    try {
      const bounds = firstLayer.getBounds();
      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds, { 
          padding: [50, 50],
          maxZoom: 4,
          animate: true,
          duration: 0.5
        });
      }
    } catch (e) {
      // Ignore errors
    }
  }
});

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
  // 如果没有中文映射,返回英文名称
  return props?.ADMIN || props?.NAME_LONG || props?.NAME || "未知";
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
    const goldReservesValue = formatLocaleNumber(data?.gold_reserves?.value, { maxFractionDigits: 1 });
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
      buildMetric({
        icon: "🏦",
        label: "黄金储备",
        value: goldReservesValue || "—",
        unit: data?.gold_reserves?.unit,
        note: data?.gold_reserves?.lag_note,
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
    renderMetric(
      "黄金储备",
      formatLocaleNumber(number(data?.gold_reserves?.value), { maxFractionDigits: 1 }),
      data?.gold_reserves?.unit,
      data?.gold_reserves?.lag_note
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
  const iso = resolveIso(props);
  const name = countryDisplayNameByIso.get(iso) || resolveName(props);
  // 从已加载的首都数据中获取
  const capital = countryCapitals.get(iso);

  layer.on("add", () => {
    const el = getLayerElement(layer);
    if (el) {
      el.classList.add("country-shape");
    }
  });

  layer.on({
    mouseover: async (event) => {
      activeIso = iso;
      clearHoverLeaveTimer();

      if (hoverIso !== iso) {
        if (hoverIso) {
          setIsoStyle(hoverIso, baseStyle);
        }
        hoverIso = iso;
        if (iso && iso !== "-99") {
          setIsoStyle(iso, hoverStyle);
        }
      }

      const collection = iso ? featureCollectionForIso(iso) : null;
      if (iso && iso !== "-99") {
        showHoverPop(collection || feature, iso);
      }

      showTooltip(event, buildTooltipContent({ name, capital, loading: true }));

      if (!iso || iso === "-99") {
        showTooltip(event, buildTooltipContent({ name, capital, data: null }));
        return;
      }

      const data = await fetchCountryDataDedup(iso);
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
      if (iso && iso !== "-99") {
        scheduleHoverLeave(iso);
        return;
      }
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
      const data = await fetchCountryDataDedup(iso);
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

      marker.on("mouseover", () => {
        try {
          marker.setStyle({ radius: 4, weight: 1.4, fillOpacity: 1.0 });
        } catch (e) {
          // Ignore.
        }
      });

      marker.on("mouseout", () => {
        try {
          marker.setStyle({ radius: 3, weight: 1, fillOpacity: 0.9 });
        } catch (e) {
          // Ignore.
        }
      });
      
      // 绑定首都名称标签（根据设置决定方向）
      marker.bindTooltip(name, {
        permanent: true,
        direction: labelDirection,
        offset: labelOffset,
        className: "capital-label",
        opacity: 0.98,
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

    // Build adjacent-country 4-color palette mapping.
    buildFourColorMap(geojson);
    
    geojsonLayer = L.geoJSON(geojson, {
      style: baseStyle,
      onEachFeature,
    }).addTo(map);

    indexCountries();
    
    // 3. 根据当前缩放级别显示首都
    updateCapitalVisibility();
    
    // 4. 加载所有国家数据用于可视化
    loadAllCountriesData().then(() => {
      // 5. 初始化数据可视化组件
      initDataViz();
    }).catch(err => {
      console.error("Failed to load viz data:", err);
    });
    
  } catch (error) {
    console.error("Map initialization error:", error);
    showTooltip(
      { originalEvent: { pageX: 40, pageY: 40 } },
      "<div class=\"metric\">地图数据文件未找到。请在 static/geojson 目录下放置 world_50m_custom.geojson 文件。</div>"
    );
  }
}

// Load all countries data for visualization
async function loadAllCountriesData() {
  console.log("Loading countries data...");
  try {
    const response = await fetch("/static/data/countries_data.json");
    console.log("Fetch response status:", response.status);
    if (!response.ok) {
      console.error("Failed to load countries data, status:", response.status);
      return;
    }
    const jsonData = await response.json();
    const countries = jsonData?.countries || {};
    console.log("Loaded countries count:", Object.keys(countries).length);
    
    // Store all countries data
    Object.assign(allCountriesData, countries);
    console.log("Countries data stored, total keys:", Object.keys(allCountriesData).length);
    
  } catch (error) {
    console.error("Error loading countries data:", error);
  }
}

// Initialize data visualization
function initDataViz() {
  console.log("Initializing DataViz...");
  console.log("allCountriesData keys:", Object.keys(allCountriesData).length);
  console.log("countryDisplayNameByIso size:", countryDisplayNameByIso.size);
  
  if (Object.keys(allCountriesData).length === 0) {
    console.warn("No countries data available for visualization");
    return;
  }

  try {
    dataVizInstance = new DataViz(allCountriesData, countryDisplayNameByIso);
    console.log("DataViz instance created successfully");
    
    // Set callback for map coloring
    dataVizInstance.setColorMapCallback((colorMap) => {
      applyDataColors(colorMap);
    });
    console.log("DataViz initialization complete");
  } catch (error) {
    console.error("Error initializing DataViz:", error);
    console.error("Data visualization features will be disabled");
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
