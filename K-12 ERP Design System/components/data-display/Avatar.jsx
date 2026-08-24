import React from "react";
import { Icon } from "../utilities/Icon.jsx";

function initials(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

/**
 * Avatar — represent a person/entity via image, initials, or icon fallback.
 * `status` renders a presence dot. Use AvatarGroup for stacked collections.
 */
export function Avatar({ name, src, icon, size = "md", status, shape = "circle", className = "", ...rest }) {
  const [broken, setBroken] = React.useState(false);
  const showImg = src && !broken;
  const cls = ["ds-avatar", `ds-avatar--${size}`, `ds-avatar--${shape}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} role="img" aria-label={name || undefined} {...rest}>
      {showImg ? (
        <img className="ds-avatar__img" src={src} alt={name || ""} onError={() => setBroken(true)} />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 16 : size === "lg" ? 24 : 18} />
      ) : (
        <span className="ds-avatar__initials">{initials(name)}</span>
      )}
      {status && <span className={`ds-avatar__status ds-avatar__status--${status}`} aria-hidden="true" />}
    </span>
  );
}

/** AvatarGroup — overlapping stack with an overflow count. */
export function AvatarGroup({ children, max = 4, size = "md", className = "" }) {
  const items = React.Children.toArray(children);
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  return (
    <span className={["ds-avatar-group", className].filter(Boolean).join(" ")}>
      {shown}
      {extra > 0 && <span className={`ds-avatar ds-avatar--${size} ds-avatar--circle ds-avatar__more`}>+{extra}</span>}
    </span>
  );
}
