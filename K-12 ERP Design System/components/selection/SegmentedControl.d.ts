import * as React from "react";

export interface SegmentOption {
  value: string;
  label?: string;
  /** Lucide icon name (icon-only or icon+label). */
  icon?: string;
}

/** Switch between a few mutually-exclusive views/modes (chart timeframe, calendar view, density). */
export interface SegmentedControlProps {
  options: SegmentOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  label?: string;
  className?: string;
}
export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
