import * as React from "react";

/** Switch information density; set the result on a `[data-density]` ancestor. */
export interface DensityToggleProps {
  value?: "comfortable" | "cozy" | "compact";
  onChange?: (value: "comfortable" | "cozy" | "compact") => void;
  size?: "sm" | "md";
  className?: string;
}
export function DensityToggle(props: DensityToggleProps): JSX.Element;
