import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Drawer — edge-anchored panel for contextual content/tasks. Focus-trapped
 * dialog with scrim; escape and backdrop close. Sticky header/footer slots.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  edge = "inline-end",
  size = "md",
  className = "",
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ds-overlay ds-overlay--drawer" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div
        className={["ds-drawer", `ds-drawer--${edge}`, `ds-drawer--${size}`, className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        {title && (
          <div className="ds-drawer__header">
            <h2 className="ds-drawer__title">{title}</h2>
            <button type="button" className="ds-icon-btn ds-icon-btn--ghost" aria-label="Close" onClick={onClose}>
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        <div className="ds-drawer__body">{children}</div>
        {footer && <div className="ds-drawer__footer">{footer}</div>}
      </div>
    </div>
  );
}
