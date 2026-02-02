import { clearCountryCache, fetchCountryData } from "./data_loader.js";
import { hideTooltip, initTooltip, moveTooltip, showTooltip } from "./tooltip.js";

const map = L.map("map", {
  minZoom: 2,
  maxZoom: 6,
  worldCopyJump: true,
  zoomSnap: 0.5,
}).setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
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

const LABEL_COUNTRY_ISOS = new Set([
  "CHN",
  "JPN",
  "KAZ",
  "UZB",
  "IND",
  "THA",
  "VNM",
  "IDN",
  "IRN",
  "IRQ",
  "SYR",
  "ISR",
  "SAU",
  "AUS",
  "NZL",
  "PHL",
  "RUS",
  "POL",
  "DEU",
  "SWE",
  "FRA",
  "ESP",
  "GBR",
  "ITA",
  "TUR",
  "EGY",
  "ETH",
  "DZA",
  "LBY",
  "MAR",
  "NGA",
  "ZAF",
  "COD",
  "COG",
  "USA",
  "CAN",
  "MEX",
  "BRA",
  "ARG",
  "VEN",
  "COL",
  "CHL",
]);

const refreshButton = document.getElementById("refresh-data");
const refreshStatus = document.getElementById("refresh-status");

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
  return (
    props?.ISO_A3 ||
    props?.ISO_A3_EH ||
    props?.ADM0_A3 ||
    props?.ISO3
  );
}

function resolveName(props) {
  return props?.ADMIN || props?.NAME_LONG || props?.NAME || "Unknown";
}

function shouldShowLabel(props) {
  const iso = resolveIso(props);
  return Boolean(iso && LABEL_COUNTRY_ISOS.has(iso));
}

function resolveLabelLatLng(feature) {
  const props = feature.properties || {};
  const labelX = props.LABEL_X;
  const labelY = props.LABEL_Y;
  if (labelX !== undefined && labelY !== undefined) {
    return [labelY, labelX];
  }
  return null;
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

function addCapitalMarker(_props) {
  return;
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
    metricsEl.innerHTML = fullHtml || "<div class=\"detail-empty\">No data available.</div>";
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
  const capital = props?.CAPITAL;

  if (shouldShowLabel(props)) {
    const labelLatLng = resolveLabelLatLng(feature);
    if (labelLatLng) {
      const labelMarker = L.marker(labelLatLng, {
        interactive: false,
        keyboard: false,
        opacity: 0,
      });
      labelMarker.bindTooltip(name, {
        permanent: true,
        direction: "center",
        className: "country-label",
        opacity: 0.85,
      });
      labelMarker.addTo(map);
    } else {
      layer.bindTooltip(name, {
        permanent: true,
        direction: "center",
        className: "country-label",
        opacity: 0.65,
      });
    }
  }

  addCapitalMarker(props);

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

fetch("/static/geojson/world_50m.geojson")
  .then((response) => response.json())
  .then((geojson) => {
    geojsonLayer = L.geoJSON(geojson, {
      style: baseStyle,
      onEachFeature,
    }).addTo(map);
  })
  .catch(() => {
    showTooltip(
      { originalEvent: { pageX: 40, pageY: 40 } },
      "<div class=\"metric\">GeoJSON file not found. Add world_50m.geojson in static/geojson.</div>"
    );
  });

if (refreshButton) {
  refreshButton.addEventListener("click", refreshAllData);
}

fetch("/static/geojson/populated_places_50m.geojson")
  .then((response) => response.json())
  .then((places) => {
    const features = places?.features || [];
    for (const feature of features) {
      const props = feature.properties || {};
      if (props.ADM0CAP !== 1) {
        continue;
      }
      const countryIso = props.ADM0_A3 || props.SOV_A3;
      if (!countryIso || !LABEL_COUNTRY_ISOS.has(countryIso)) {
        continue;
      }
      const name = props.NAME || props.NAME_EN;
      const lat = feature.geometry?.coordinates?.[1] ?? props.LATITUDE;
      const lon = feature.geometry?.coordinates?.[0] ?? props.LONGITUDE;
      if (!name || lat === undefined || lon === undefined) {
        continue;
      }
      const marker = L.circleMarker([lat, lon], {
        radius: 3,
        color: "#b76e4c",
        weight: 1,
        fillColor: "#b76e4c",
        fillOpacity: 0.9,
      });
      marker.bindTooltip(name, {
        permanent: true,
        direction: "right",
        className: "capital-label",
        opacity: 0.9,
      });
      marker.addTo(map);
    }
  })
  .catch(() => {
    return;
  });
