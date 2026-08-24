import React from "react";

/** Spinner — indeterminate progress indicator. `overlay` centers on a scrim. */
export function Spinner({ size = "md", overlay = false, label = "Loading", className = "" }) {
  const px = size === "sm" ? 16 : size === "lg" ? 32 : 22;
  const spinner = (
    <span
      className={["ds-spinner", className].filter(Boolean).join(" ")}
      style={{ width: px, height: px }}
      role="status"
      aria-label={label}
    />
  );
  if (overlay) return <span className="ds-spinner-overlay">{spinner}</span>;
  return spinner;
}
