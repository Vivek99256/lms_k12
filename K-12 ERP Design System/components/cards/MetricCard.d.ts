import * as React from "react";

export interface MetricTrend {
  direction: "up" | "down" | "flat";
  /** e.g. "+12%". */
  value: string;
  /** e.g. "vs last term". */
  label?: string;
}

/**
 * Highlights a single KPI/stat with an optional trend (arrow + text, not color
 * alone). Canonical metric surface — do NOT create `stat-card`/`kpi-card`.
 *
 * @dsCard group="Components"
 */
export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** Lucide icon name shown top-right. */
  icon?: string;
  trend?: MetricTrend;
  variant?: "kpi" | "stat";
  loading?: boolean;
}
export function MetricCard(props: MetricCardProps): JSX.Element;
