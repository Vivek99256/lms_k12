import * as React from "react";

/** Indeterminate progress indicator. `overlay` centers it over a scrim. */
export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  overlay?: boolean;
  label?: string;
  className?: string;
}
export function Spinner(props: SpinnerProps): JSX.Element;
