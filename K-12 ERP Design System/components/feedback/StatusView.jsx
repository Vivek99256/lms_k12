import React from "react";
import { Icon } from "../utilities/Icon.jsx";

const PRESET = {
  empty:      { icon: "inbox", title: "Nothing here yet" },
  error:      { icon: "alert-octagon", title: "Something went wrong" },
  success:    { icon: "check-circle", title: "All done" },
  "no-results": { icon: "search-x", title: "No matches found" },
  "no-access": { icon: "lock", title: "You don't have access" },
  offline:    { icon: "wifi-off", title: "You're offline" },
};

/**
 * StatusView — fills a region for empty / error / success / no-results /
 * no-access / offline states. Canonical state view — do NOT create separate
 * empty-state / error-state / success-state components.
 */
export function StatusView({
  variant = "empty",
  icon,
  title,
  description,
  actions,
  size = "md",
  className = "",
  ...rest
}) {
  const preset = PRESET[variant] || PRESET.empty;
  const role = variant === "error" ? "alert" : "status";
  return (
    <div className={["ds-status-view", `ds-status-view--${variant}`, `ds-status-view--${size}`, className].filter(Boolean).join(" ")} role={role} {...rest}>
      <span className="ds-status-view__icon"><Icon name={icon || preset.icon} size={size === "lg" ? 40 : 28} stroke={1.5} /></span>
      <h2 className="ds-status-view__title">{title || preset.title}</h2>
      {description && <p className="ds-status-view__desc">{description}</p>}
      {actions && <div className="ds-status-view__actions">{actions}</div>}
    </div>
  );
}
