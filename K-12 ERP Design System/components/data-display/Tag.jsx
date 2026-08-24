import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Tag — lightweight label or filter chip. `removable` exposes a labeled remove
 * control; `selectable` toggles an active state.
 */
export function Tag({ children, variant = "neutral", removable = false, onRemove, selected, onClick, size = "md", className = "", ...rest }) {
  const interactive = Boolean(onClick) || selected !== undefined;
  const cls = ["ds-tag", `ds-tag--${variant}`, `ds-tag--${size}`, selected ? "is-selected" : "", interactive ? "is-interactive" : "", className].filter(Boolean).join(" ");
  const Comp = interactive ? "button" : "span";
  return (
    <Comp className={cls} onClick={onClick} type={interactive ? "button" : undefined} aria-pressed={selected} {...rest}>
      {children}
      {removable && (
        <button
          type="button"
          className="ds-tag__x"
          aria-label="Remove"
          onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); }}
        >
          <Icon name="x" size={12} stroke={2.25} />
        </button>
      )}
    </Comp>
  );
}
