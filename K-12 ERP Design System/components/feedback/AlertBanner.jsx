import React from "react";
import { Icon } from "../utilities/Icon.jsx";

const ICONS = { info: "info", success: "check-circle", warning: "alert-triangle", error: "alert-circle" };

/**
 * AlertBanner — persistent page/section-level message. Severity sets the role,
 * icon, and colors. Optional title, action, and dismiss control.
 */
export function AlertBanner({ variant = "info", title, children, action, onDismiss, className = "", ...rest }) {
  const role = variant === "error" || variant === "warning" ? "alert" : "status";
  return (
    <div className={["ds-alert", `ds-alert--${variant}`, className].filter(Boolean).join(" ")} role={role} {...rest}>
      <Icon className="ds-alert__icon" name={ICONS[variant]} size={18} />
      <div className="ds-alert__body">
        {title && <p className="ds-alert__title">{title}</p>}
        {children && <div className="ds-alert__text">{children}</div>}
      </div>
      {action && <div className="ds-alert__action">{action}</div>}
      {onDismiss && (
        <button type="button" className="ds-alert__x" aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
