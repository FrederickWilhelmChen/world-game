let tooltipEl;

export function initTooltip() {
  tooltipEl = document.getElementById("tooltip");
}

export function showTooltip(event, content) {
  if (!tooltipEl) {
    return;
  }
  tooltipEl.innerHTML = content;
  tooltipEl.setAttribute("aria-hidden", "false");
  tooltipEl.style.opacity = "1";
  moveTooltip(event);
}

export function moveTooltip(event) {
  if (!tooltipEl || !event) {
    return;
  }
  const source = event.originalEvent || event;
  const x = source.clientX ?? 0;
  const y = source.clientY ?? 0;
  tooltipEl.style.transform = `translate(${x + 10}px, ${y + 12}px)`;
}

export function hideTooltip() {
  if (!tooltipEl) {
    return;
  }
  tooltipEl.setAttribute("aria-hidden", "true");
  tooltipEl.style.opacity = "0";
  tooltipEl.style.transform = "translate(-9999px, -9999px)";
}
