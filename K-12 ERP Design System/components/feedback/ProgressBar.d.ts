import * as React from "react";

/** Determinate or indeterminate task progress (uploads, imports, long ops). */
export interface ProgressBarProps {
  /** 0–max; ignored when indeterminate. */
  value?: number;
  max?: number;
  indeterminate?: boolean;
  variant?: "brand" | "success" | "warning" | "error";
  size?: "sm" | "md";
  showValue?: boolean;
  label?: React.ReactNode;
  className?: string;
}
export function ProgressBar(props: ProgressBarProps): JSX.Element;
