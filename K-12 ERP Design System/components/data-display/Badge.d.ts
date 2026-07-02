import * as React from "react";

/**
 * Status / count / presence indicator. Variant sets the semantic color; a
 * leading `dot` or `icon` keeps meaning accessible without relying on color.
 *
 * @dsCard group="Components"
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "brand" | "success" | "warning" | "error" | "info";
  /** `status` = filled pill; `count` = compact numeric; `dot` = tiny marker. */
  appearance?: "status" | "count" | "dot";
  /** Lucide icon name. */
  icon?: string;
  /** Show a leading status dot. */
  dot?: boolean;
  size?: "sm" | "md";
  children?: React.ReactNode;
}
export function Badge(props: BadgeProps): JSX.Element;
