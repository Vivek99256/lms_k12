import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * BottomNav — primary mobile navigation for frequent destinations. Visible
 * only on mobile in the app frame. items: [{ id, label, icon, badge? }].
 */
export function BottomNav({ items = [], activeId, onSelect, className = "" }) {
  return (
    <nav className={["ds-bottom-nav", className].filter(Boolean).join(" ")} aria-label="Primary">
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <button
            key={it.id}
            type="button"
            className={["ds-bottom-nav__item", active ? "is-active" : ""].filter(Boolean).join(" ")}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect && onSelect(it.id)}
          >
            <span className="ds-bottom-nav__icon">
              <Icon name={it.icon} size={22} />
              {it.badge != null && <span className="ds-bottom-nav__badge">{it.badge}</span>}
            </span>
            <span className="ds-bottom-nav__label">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
