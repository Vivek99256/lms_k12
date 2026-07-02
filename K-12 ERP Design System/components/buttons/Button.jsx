import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Button — the atomic action primitive. Variants set hierarchy/intent;
 * real <button> semantics; token-driven states incl. loading & disabled.
 */
export function Button({
  children,
  variant = "secondary",
  size = "md",
  type = "button",
  iconStart,
  iconEnd,
  loading = false,
  disabled = false,
  fullWidth = false,
  className = "",
  ...rest
}) {
  const cls = [
    "ds-btn",
    `ds-btn--${variant}`,
    `ds-btn--${size}`,
    fullWidth ? "ds-btn--block" : "",
    loading ? "is-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconSize = size === "sm" ? 16 : size === "lg" ? 20 : 18;

  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="ds-btn__spinner" aria-hidden="true" />}
      {!loading && iconStart && <Icon name={iconStart} size={iconSize} />}
      {children != null && <span className="ds-btn__label">{children}</span>}
      {!loading && iconEnd && <Icon name={iconEnd} size={iconSize} />}
    </button>
  );
}
