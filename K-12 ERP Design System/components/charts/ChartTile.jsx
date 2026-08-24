import React from "react";
import { StatusView } from "../feedback/StatusView.jsx";
import { Skeleton } from "../feedback/Skeleton.jsx";

/**
 * ChartTile — wraps a chart with a title, optional actions/legend, and
 * loading/empty/error states, inside a card surface.
 */
export function ChartTile({ title, subtitle, actions, legend, state, children, className = "" }) {
  return (
    <div className={["ds-chart-tile", className].filter(Boolean).join(" ")}>
      <div className="ds-chart-tile__header">
        <div className="ds-chart-tile__titles">
          {title && <h3 className="ds-chart-tile__title">{title}</h3>}
          {subtitle && <p className="ds-chart-tile__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="ds-chart-tile__actions">{actions}</div>}
      </div>
      <div className="ds-chart-tile__body">
        {state === "loading" ? (
          <Skeleton variant="block" height={200} />
        ) : state === "empty" ? (
          <StatusView variant="empty" title="No data for this range" />
        ) : state === "error" ? (
          <StatusView variant="error" description="Couldn't load this chart." />
        ) : (
          children
        )}
      </div>
      {legend && state == null && <div className="ds-chart-tile__legend">{legend}</div>}
    </div>
  );
}
