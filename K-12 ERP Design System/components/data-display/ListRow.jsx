import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * ListRow — a single selectable/actionable row for lists and master panes.
 * Compose freely via slots: leading (avatar/icon), title, subtitle, meta, and
 * trailing actions. `selected` and `onClick` make it interactive.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  selected = false,
  onClick,
  href,
  className = "",
  children,
  ...rest
}) {
  const interactive = Boolean(onClick || href);
  const cls = ["ds-list-row", selected ? "is-selected" : "", interactive ? "is-interactive" : "", className].filter(Boolean).join(" ");
  const Comp = href ? "a" : interactive ? "button" : "div";
  const props = href ? { href } : interactive ? { type: "button", onClick } : {};
  return (
    <Comp className={cls} aria-current={selected || undefined} {...props} {...rest}>
      {leading && <span className="ds-list-row__leading">{leading}</span>}
      <span className="ds-list-row__body">
        {title && <span className="ds-list-row__title">{title}</span>}
        {subtitle && <span className="ds-list-row__subtitle">{subtitle}</span>}
        {children}
      </span>
      {meta && <span className="ds-list-row__meta">{meta}</span>}
      {trailing && <span className="ds-list-row__trailing">{trailing}</span>}
    </Comp>
  );
}
