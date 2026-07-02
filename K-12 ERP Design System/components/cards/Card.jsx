import React from "react";

/**
 * Card — a bounded surface grouping related content. Optional header (title +
 * actions) and footer slots. `interactive`/`selectable` add hover/selected.
 */
export function Card({
  children,
  title,
  subtitle,
  actions,
  footer,
  variant = "default",
  selected = false,
  onClick,
  padded = true,
  className = "",
  ...rest
}) {
  const interactive = variant === "interactive" || variant === "selectable" || Boolean(onClick);
  const cls = ["ds-card", `ds-card--${variant}`, selected ? "is-selected" : "", interactive ? "is-interactive" : "", className].filter(Boolean).join(" ");
  return (
    <div className={cls} onClick={onClick} {...rest}>
      {(title || actions) && (
        <div className="ds-card__header">
          <div className="ds-card__titles">
            {title && <h3 className="ds-card__title">{title}</h3>}
            {subtitle && <p className="ds-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ds-card__actions">{actions}</div>}
        </div>
      )}
      <div className={padded ? "ds-card__body" : "ds-card__body ds-card__body--flush"}>{children}</div>
      {footer && <div className="ds-card__footer">{footer}</div>}
    </div>
  );
}
