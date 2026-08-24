import React from "react";
import { Icon } from "../utilities/Icon.jsx";

/**
 * Modal — focused blocking task/content in a centered dialog with a scrim.
 * Escape and backdrop click close it (unless dismissible=false). Focus is
 * moved in on open and returned to the trigger on close.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
  variant = "standard",
  className = "",
}) {
  const ref = React.useRef(null);
  const returnRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    returnRef.current = document.activeElement;
    const onKey = (e) => e.key === "Escape" && dismissible && onClose && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const el = ref.current;
      if (el) {
        const focusable = el.querySelector("[autofocus], button, [href], input, select, textarea, [tabindex]");
        (focusable || el).focus();
      }
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(t);
      if (returnRef.current && returnRef.current.focus) returnRef.current.focus();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div className="ds-overlay" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose && onClose()}>
      <div
        ref={ref}
        className={["ds-modal", `ds-modal--${size}`, `ds-modal--${variant}`, className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
      >
        {(title || dismissible) && (
          <div className="ds-modal__header">
            <div className="ds-modal__titles">
              {title && <h2 className="ds-modal__title">{title}</h2>}
              {description && <p className="ds-modal__desc">{description}</p>}
            </div>
            {dismissible && (
              <button type="button" className="ds-icon-btn ds-icon-btn--ghost" aria-label="Close" onClick={onClose}>
                <Icon name="x" size={18} />
              </button>
            )}
          </div>
        )}
        <div className="ds-modal__body">{children}</div>
        {footer && <div className="ds-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
