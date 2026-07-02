import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * AssistantLauncher — floating vertical rail that opens the assistant / switches
 * agents when the panel is collapsed. A primary button opens the assistant;
 * optional agent items select a capability. items: [{ id, icon, label, badge? }].
 */
export function AssistantLauncher({
  items = [],
  activeId,
  onSelect,
  primaryIcon = "sparkles",
  primaryLabel = "Ask assistant",
  onPrimary,
  className = "",
}) {
  return (
    <div className={["ds-assist-rail", className].filter(Boolean).join(" ")} role="toolbar" aria-label="Assistant">
      <button type="button" className="ds-assist-rail__btn is-primary" aria-label={primaryLabel} title={primaryLabel} onClick={onPrimary}>
        <Icon name={primaryIcon} size={20} />
      </button>
      {items.length > 0 && <span className="ds-assist-rail__divider" aria-hidden="true" />}
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={["ds-assist-rail__btn", it.id === activeId ? "is-active" : ""].filter(Boolean).join(" ")}
          aria-label={it.label}
          title={it.label}
          aria-pressed={it.id === activeId}
          onClick={() => onSelect && onSelect(it.id)}
        >
          <Icon name={it.icon} size={20} />
          {it.badge && <span className="ds-assist-rail__dot" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
