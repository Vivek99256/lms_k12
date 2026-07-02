import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * SidebarNav — primary module navigation rail. items: array of
 * { id, label, icon, badge? } or { section: "Label" } dividers.
 * `collapsed` renders an icon-only rail.
 */
export function SidebarNav({
  items = [],
  activeId,
  onSelect,
  collapsed = false,
  header,
  footer,
  className = "",
}) {
  return (
    <nav className={["ds-sidebar", collapsed ? "is-collapsed" : "", className].filter(Boolean).join(" ")} aria-label="Primary">
      {header && <div className="ds-sidebar__header">{header}</div>}
      <ul className="ds-sidebar__list">
        {items.map((it, i) => {
          if (it.section) {
            return !collapsed ? (
              <li key={`s-${i}`} className="ds-sidebar__section">{it.section}</li>
            ) : <li key={`s-${i}`} className="ds-sidebar__section-rule" aria-hidden="true" />;
          }
          const active = it.id === activeId;
          return (
            <li key={it.id}>
              <button
                type="button"
                className={["ds-sidebar__item", active ? "is-active" : ""].filter(Boolean).join(" ")}
                aria-current={active ? "page" : undefined}
                title={collapsed ? it.label : undefined}
                onClick={() => onSelect && onSelect(it.id)}
              >
                {it.icon && <Icon className="ds-sidebar__icon" name={it.icon} size={18} />}
                {!collapsed && <span className="ds-sidebar__label">{it.label}</span>}
                {!collapsed && it.badge != null && <span className="ds-sidebar__badge">{it.badge}</span>}
                {collapsed && it.badge != null && <span className="ds-sidebar__dot" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      {footer && <div className="ds-sidebar__footer">{footer}</div>}
    </nav>
  );
}
