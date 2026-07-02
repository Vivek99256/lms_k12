import * as React from "react";

/**
 * An action represented by an icon alone, for toolbars, table rows, and dense
 * controls. `label` is REQUIRED as the accessible name (never icon-only mute).
 */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Lucide icon name. */
  icon: string;
  /** Accessible name; also used as the native tooltip. Required. */
  label: string;
  variant?: "default" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export function IconButton(props: IconButtonProps): JSX.Element;
