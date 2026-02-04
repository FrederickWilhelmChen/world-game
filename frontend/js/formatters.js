// Formatting utilities for numbers and values

export function formatCompact(value) {
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

export function formatLocaleNumber(value, { maxFractionDigits = 1 } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  try {
    return Number(value).toLocaleString("zh-CN", {
      maximumFractionDigits: maxFractionDigits,
    });
  } catch (e) {
    return String(value);
  }
}
