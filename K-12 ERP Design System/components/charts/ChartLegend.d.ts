import * as React from "react";

export interface LegendItem {
  label: React.ReactNode;
  value?: React.ReactNode;
  color?: string;
}

/** Series labels + swatches (and optional values) for a chart. */
export interface ChartLegendProps {
  items: LegendItem[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}
export function ChartLegend(props: ChartLegendProps): JSX.Element;
