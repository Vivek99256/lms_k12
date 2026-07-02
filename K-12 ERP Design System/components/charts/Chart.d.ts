import * as React from "react";

export interface ChartSeries {
  name: string;
  values: number[];
}
export interface ChartDatum {
  label: string;
  value: number;
}

/**
 * Lightweight SVG chart. For bar/column/line/area pass `categories` + `series`;
 * for donut/pie pass `data`. Always pair with an accessible data table in real
 * screens (charts alone aren't sufficient for AA).
 */
export interface ChartProps {
  type?: "bar" | "column" | "line" | "area" | "donut" | "pie";
  categories?: string[];
  series?: ChartSeries[];
  data?: ChartDatum[];
  height?: number;
  colors?: string[];
  showGrid?: boolean;
  className?: string;
}
export function Chart(props: ChartProps): JSX.Element;
