import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * IconButton — an action represented by an icon alone in tight space.
 * Requires an accessible name via `label` (also used as the tooltip title).
 */
export function IconButton({
  icon,
  label,
  variant = "default",
  size = "md",
  type = "button",
  disabled = false,
  className = "",
  ...rest
}) {
  const cls = ["ds-icon-btn", `ds-icon-btn--${variant}`, `ds-icon-btn--${size}`, className]
    .filter(Boolean)
    .join(" ");
  const iconSize = size === "sm" ? 16 : size === "lg" ? 22 : 18;
  return (
    <button type={type} className={cls} aria-label={label} title={label} disabled={disabled} {...rest}>
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
