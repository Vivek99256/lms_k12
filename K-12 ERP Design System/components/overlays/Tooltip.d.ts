import * as React from "react";

/** Brief text hint on hover/focus. Supplements (never replaces) a label. */
export interface TooltipProps {
  label: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  children?: React.ReactNode;
}
export function Tooltip(props: TooltipProps): JSX.Element;
