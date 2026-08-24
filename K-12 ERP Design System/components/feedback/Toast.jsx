import React from "react";
import { Icon } from "../utilities/Icon.jsx";

const ICONS = { info: "info", success: "check-circle", warning: "alert-triangle", error: "alert-circle" };

/**
 * Toast — a brief, non-blocking confirmation/notice. Presentational: render
 * inside a ToastViewport. Severity sets icon + accent; optional action.
 */
export function Toast({ variant = "info", title, children, action, onDismiss, className = "", ...rest }) {
  const role = variant === "error" ? "alert" : "status";
  return (
    <div className={["ds-toast", `ds-toast--${variant}`, className].filter(Boolean).join(" ")} role={role} aria-live={variant === "error" ? "assertive" : "polite"} {...rest}>
      <Icon className="ds-toast__icon" name={ICONS[variant]} size={18} />
      <div className="ds-toast__body">
        {title && <p className="ds-toast__title">{title}</p>}
        {children && <div className="ds-toast__text">{children}</div>}
      </div>
      {action && <div className="ds-toast__action">{action}</div>}
      {onDismiss && (
        <button type="button" className="ds-toast__x" aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

/** ToastViewport — fixed stack that positions toasts in a screen corner. */
export function ToastViewport({ position = "bottom-right", children, className = "" }) {
  return <div className={["ds-toast-viewport", `ds-toast-viewport--${position}`, className].filter(Boolean).join(" ")}>{children}</div>;
}
