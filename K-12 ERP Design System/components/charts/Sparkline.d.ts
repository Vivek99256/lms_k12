import * as React from "react";

/** Compact inline trend without axes (metric cards, table cells). */
export interface SparklineProps {
  data: number[];
  type?: "line" | "bar";
  tone?: "brand" | "success" | "error";
  width?: number;
  height?: number;
  className?: string;
}
export function Sparkline(props: SparklineProps): JSX.Element;
