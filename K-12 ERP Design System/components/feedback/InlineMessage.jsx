import React from "react";
import { Icon } from "../utilities/Icon.jsx";

const ICONS = { info: "info", success: "check-circle", warning: "alert-triangle", error: "alert-circle" };

/** InlineMessage — field/block-level validation or guidance text with an icon. */
export function InlineMessage({ variant = "error", children, className = "", ...rest }) {
  return (
    <p className={["ds-inline-msg", `ds-inline-msg--${variant}`, className].filter(Boolean).join(" ")} {...rest}>
      <Icon name={ICONS[variant]} size={14} stroke={2} />
      <span>{children}</span>
    </p>
  );
}
