import * as React from "react";

/** Card wrapper for a chart: title, actions, legend, and loading/empty/error states. */
export interface ChartTileProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  legend?: React.ReactNode;
  /** Override content with a state view. */
  state?: "loading" | "empty" | "error";
  children?: React.ReactNode;
  className?: string;
}
export function ChartTile(props: ChartTileProps): JSX.Element;
