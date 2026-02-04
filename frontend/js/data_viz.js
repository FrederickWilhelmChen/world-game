// Data Visualization Module
// Handles tabs, rankings, charts, and map coloring based on resource data

import { formatCompact, formatLocaleNumber } from './formatters.js';

// Data field configurations for different resource types
const DATA_CONFIGS = {
  gdp: {
    name: 'GDP',
    unit: 'USD',
    path: (data) => data?.gdp?.value,
    formatter: (val) => `$${formatCompact(val)}`,
    colorScale: generateColorScale('#e8f4f8', '#0c4a6e')
  },
  grain: {
    name: '粮食产量',
    unit: '吨/年',
    path: (data) => data?.grain_production?.total,
    formatter: (val) => `${formatCompact(val)} 吨`,
    colorScale: generateColorScale('#fef3c7', '#78350f')
  },
  oil: {
    name: '石油产量',
    unit: '桶/日',
    path: (data) => data?.oil_production?.value,
    formatter: (val) => `${formatCompact(val)} 桶/日`,
    colorScale: generateColorScale('#dbeafe', '#1e3a8a')
  },
  gold: {
    name: '黄金产量',
    unit: '吨',
    path: (data) => data?.gold_production?.value,
    formatter: (val) => `${formatCompact(val)} 吨`,
    colorScale: generateColorScale('#fef9c3', '#854d0e')
  },
  gold_reserves: {
    name: '黄金储备',
    unit: '吨',
    path: (data) => data?.gold_reserves?.value,
    formatter: (val) => `${formatLocaleNumber(val, { maxFractionDigits: 1 })} 吨`,
    colorScale: generateColorScale('#fef3c7', '#92400e')
  },
  aluminum: {
    name: '铝产量',
    unit: '吨',
    path: (data) => data?.nonferrous_metals?.by_category?.aluminum,
    formatter: (val) => `${formatCompact(val)} 吨`,
    colorScale: generateColorScale('#f3f4f6', '#374151')
  },
  copper: {
    name: '铜产量',
    unit: '吨',
    path: (data) => data?.nonferrous_metals?.by_category?.copper,
    formatter: (val) => `${formatCompact(val)} 吨`,
    colorScale: generateColorScale('#fed7aa', '#9a3412')
  },
  nickel: {
    name: '镍产量',
    unit: '吨',
    path: (data) => data?.nonferrous_metals?.by_category?.nickel,
    formatter: (val) => `${formatCompact(val)} 吨`,
    colorScale: generateColorScale('#e0e7ff', '#3730a3')
  }
};

// Generate color scale for map visualization
function generateColorScale(lightColor, darkColor) {
  return [
    '#f8f9fa',  // No data / very low
    lightColor,
    interpolateColor(lightColor, darkColor, 0.3),
    interpolateColor(lightColor, darkColor, 0.5),
    interpolateColor(lightColor, darkColor, 0.7),
    darkColor
  ];
}

// Simple color interpolation
function interpolateColor(color1, color2, factor) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  return rgbToHex(r, g, b);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Main DataViz class
export class DataViz {
  constructor(countriesData, countryDisplayNames) {
    console.log("DataViz constructor called");
    console.log("countriesData type:", typeof countriesData);
    console.log("countriesData keys:", Object.keys(countriesData).length);
    console.log("countryDisplayNames type:", typeof countryDisplayNames);
    
    this.countriesData = countriesData;
    this.countryDisplayNames = countryDisplayNames;
    this.currentTab = 'overview';
    this.currentRankings = [];
    this.colorMapCallback = null;
    
    console.log("Calling init...");
    this.init();
  }

  init() {
    console.log("DataViz init called");
    this.setupTabListeners();
    console.log("Tab listeners setup complete");
    this.switchTab('overview');
    console.log("Initial tab switch complete");
  }

  setupTabListeners() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    // Update active tab button
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');

    // Update active tab panel
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    // Check if tab panel exists, if not create it
    let tabPanel = document.getElementById(`tab-${tabId}`);
    if (!tabPanel) {
      tabPanel = this.createTabPanel(tabId);
      document.querySelector('.tabs-content').appendChild(tabPanel);
    }
    tabPanel.classList.add('active');

    this.currentTab = tabId;
    this.updateVisualization(tabId);
  }

  createTabPanel(tabId) {
    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = `tab-${tabId}`;
    panel.innerHTML = `
      <div class="chart-container" id="chart-${tabId}"></div>
    `;
    return panel;
  }

  updateVisualization(tabId) {
    // Handle overview mode - clear visualizations and reset map colors
    if (tabId === 'overview') {
      const container = document.getElementById(`chart-${tabId}`);
      if (container) {
        container.innerHTML = '';
      }
      // Clear data colors and return to default blue palette
      if (this.colorMapCallback) {
        this.colorMapCallback(null);
      }
      // Hide legend
      const legend = document.getElementById('map-legend');
      if (legend) {
        legend.style.display = 'none';
      }
      this.currentRankings = [];
      return;
    }

    const config = DATA_CONFIGS[tabId];
    if (!config) return;

    // Extract and sort data
    const rankings = this.extractRankings(tabId, config);
    this.currentRankings = rankings;

    // Update chart
    this.renderChart(tabId, rankings, config);

    // Update map colors
    this.updateMapColors(rankings, config);
  }

  extractRankings(tabId, config) {
    const rankings = [];
    
    for (const [isoCode, data] of Object.entries(this.countriesData)) {
      const value = config.path(data);
      if (value !== null && value !== undefined && value > 0) {
        const countryName = this.countryDisplayNames.get(isoCode) || isoCode;
        rankings.push({
          iso: isoCode,
          name: countryName,
          value: value
        });
      }
    }

    // Sort by value descending
    rankings.sort((a, b) => b.value - a.value);

    return rankings.slice(0, 10); // Top 10
  }

  renderChart(tabId, rankings, config) {
    const container = document.getElementById(`chart-${tabId}`);
    if (!container) return;

    const maxValue = rankings[0]?.value || 1;

    container.innerHTML = rankings.map((item, index) => {
      const percentage = (item.value / maxValue) * 100;
      return `
        <div class="chart-bar" data-iso="${item.iso}">
          <div class="chart-label">
            <span class="chart-label-name">${index + 1}. ${item.name}</span>
            <span class="chart-label-value">${config.formatter(item.value)}</span>
          </div>
          <div class="chart-bar-wrapper">
            <div class="chart-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.chart-bar').forEach(bar => {
      bar.addEventListener('click', () => {
        const iso = bar.getAttribute('data-iso');
        this.highlightCountry(iso);
      });
      bar.style.cursor = 'pointer';
    });
  }

  updateMapColors(rankings, config) {
    if (!this.colorMapCallback) return;

    // Create color map based on ranking values
    const colorMap = new Map();
    const values = rankings.map(r => r.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);

    rankings.forEach(item => {
      const normalized = (item.value - minValue) / (maxValue - minValue);
      const colorIndex = Math.floor(normalized * (config.colorScale.length - 1));
      const color = config.colorScale[Math.min(colorIndex, config.colorScale.length - 1)];
      colorMap.set(item.iso, color);
    });

    // Apply colors to map
    this.colorMapCallback(colorMap);
    
    // Update legend
    this.updateLegend(config, minValue, maxValue);
  }

  updateLegend(config, minValue, maxValue) {
    const legend = document.getElementById('map-legend');
    const legendTitle = document.getElementById('legend-title');
    const legendScale = document.getElementById('legend-scale');
    const legendMin = document.getElementById('legend-min');
    const legendMax = document.getElementById('legend-max');
    
    if (!legend || !legendTitle || !legendScale || !legendMin || !legendMax) return;
    
    // Show legend
    legend.style.display = 'block';
    
    // Update title
    legendTitle.textContent = config.name;
    
    // Update color scale
    legendScale.innerHTML = config.colorScale.slice(1).map(color => 
      `<div class="legend-color" style="background-color: ${color}"></div>`
    ).join('');
    
    // Update labels
    legendMin.textContent = config.formatter(minValue);
    legendMax.textContent = config.formatter(maxValue);
  }

  highlightCountry(iso) {
    // Trigger custom event for map to handle
    window.dispatchEvent(new CustomEvent('country:highlight', {
      detail: { iso }
    }));
  }

  setColorMapCallback(callback) {
    this.colorMapCallback = callback;
  }

  updateCountriesData(newData) {
    this.countriesData = newData;
    // Refresh current tab
    this.updateVisualization(this.currentTab);
  }
}

export default DataViz;
