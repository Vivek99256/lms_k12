import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * MetricCard — highlight a single KPI/stat with optional trend and icon.
 * Trend direction is conveyed by an arrow icon + text, never color alone.
 * This is the canonical metric surface (variants: stat, kpi).
 */
export function MetricCard({
  label,
  value,
  unit,
  icon,
  trend,          // { direction: "up"|"down"|"flat", value: "+12%", label?: "vs last term" }
  variant = "kpi",
  loading = false,
  className = "",
  ...rest
}) {
  const cls = ["ds-metric", `ds-metric--${variant}`, className].filter(Boolean).join(" ");
  if (loading) {
    return (
      <div className={cls} aria-busy="true" {...rest}>
        <div className="ds-skel ds-skel--text" style={{ width: "50%" }} />
        <div className="ds-skel ds-skel--text" style={{ width: "70%", height: 28, marginTop: 8 }} />
      </div>
    );
  }
  const dirIcon = trend ? (trend.direction === "up" ? "trending-up" : trend.direction === "down" ? "trending-down" : "minus") : null;
  const trendCls = trend ? `ds-metric__trend ds-metric__trend--${trend.direction}` : "";
  return (
    <div className={cls} {...rest}>
      <div className="ds-metric__head">
        <span className="ds-metric__label">{label}</span>
        {icon && <span className="ds-metric__icon"><Icon name={icon} size={18} /></span>}
      </div>
      <div className="ds-metric__value">
        {value}
        {unit && <span className="ds-metric__unit">{unit}</span>}
      </div>
      {trend && (
        <div className={trendCls}>
          <Icon name={dirIcon} size={14} stroke={2} />
          <span className="ds-metric__trend-val">{trend.value}</span>
          {trend.label && <span className="ds-metric__trend-label">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
