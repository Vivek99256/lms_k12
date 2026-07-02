import React from "react";
import { Icon } from "../utilities/Icon.jsx";
import { Button } from "../buttons/Button.jsx";

/**
 * ConfirmationDialog — require deliberate confirmation for a consequential
 * action. `destructive` uses a danger confirm button. Built for alertdialog
 * semantics; consequences stated in text.
 */
export function ConfirmationDialog({
  open,
  onCancel,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onCancel && onCancel();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="ds-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel && onCancel()}>
      <div className="ds-modal ds-modal--sm ds-confirm" role="alertdialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="ds-confirm__body">
          <span className={["ds-confirm__icon", destructive ? "ds-confirm__icon--danger" : ""].filter(Boolean).join(" ")}>
            <Icon name={destructive ? "alert-triangle" : "help-circle"} size={22} />
          </span>
          <div className="ds-confirm__text">
            {title && <h2 className="ds-modal__title">{title}</h2>}
            {children && <div className="ds-modal__desc">{children}</div>}
          </div>
        </div>
        <div className="ds-modal__footer">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={destructive ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
