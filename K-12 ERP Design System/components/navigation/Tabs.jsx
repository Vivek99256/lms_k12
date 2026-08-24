import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Tabs — switch between peer sections. tabs: [{ id, label, icon?, badge? }].
 * Controlled via activeId/onChange. Variants: underline, enclosed.
 * The active state is styled directly on the tab (border / pill) so it is always
 * visible; hover/press/active use token transitions for a tactile feel.
 */
export function Tabs({ tabs = [], activeId, onChange, variant = "underline", className = "" }) {
  const active = activeId ?? (tabs[0] && tabs[0].id);
  return (
    <div className={["ds-tabs", `ds-tabs--${variant}`, className].filter(Boolean).join(" ")} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          className={["ds-tabs__tab", t.id === active ? "is-active" : ""].filter(Boolean).join(" ")}
          onClick={() => onChange && onChange(t.id)}
        >
          {t.icon && <Icon name={t.icon} size={16} />}
          <span>{t.label}</span>
          {t.badge != null && <span className="ds-tabs__badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
