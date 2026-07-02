import React from "react";

const PALETTE = [
  "var(--color-brand-600)",
  "var(--color-success-500)",
  "var(--color-warning-500)",
  "var(--color-info-500)",
  "var(--color-brand-300)",
  "var(--color-error-500)",
];

/**
 * ChartLegend — labels (and optional values) for chart series with swatches.
 * items: [{ label, value?, color? }]. Colors default to the chart palette.
 */
export function ChartLegend({ items = [], orientation = "horizontal", className = "" }) {
  return (
    <ul className={["ds-chart-legend", `ds-chart-legend--${orientation}`, className].filter(Boolean).join(" ")}>
      {items.map((it, i) => (
        <li key={i} className="ds-chart-legend__item">
          <span className="ds-chart-legend__swatch" style={{ background: it.color || PALETTE[i % PALETTE.length] }} />
          <span className="ds-chart-legend__label">{it.label}</span>
          {it.value != null && <span className="ds-chart-legend__value">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}
