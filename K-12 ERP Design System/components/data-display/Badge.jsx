import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Badge — status / count / dot indicator. Meaning is conveyed by text + shape
 * (and an optional icon), never color alone.
 */
export function Badge({ children, variant = "neutral", appearance = "status", icon, dot = false, size = "md", className = "", ...rest }) {
  const cls = ["ds-badge", `ds-badge--${variant}`, `ds-badge--${appearance}`, `ds-badge--${size}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {dot && <span className="ds-badge__dot" aria-hidden="true" />}
      {icon && <Icon name={icon} size={size === "sm" ? 11 : 12} stroke={2} />}
      {children}
    </span>
  );
}
