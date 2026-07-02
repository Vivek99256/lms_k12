import React from "react";

/** Divider — a hairline separator, horizontal or vertical, with optional label. */
export function Divider({ orientation = "horizontal", label, className = "", ...rest }) {
  if (label && orientation === "horizontal") {
    return (
      <div className={["ds-divider ds-divider--labeled", className].filter(Boolean).join(" ")} role="separator" {...rest}>
        <span className="ds-divider__label">{label}</span>
      </div>
    );
  }
  return <div className={["ds-divider", `ds-divider--${orientation}`, className].filter(Boolean).join(" ")} role="separator" {...rest} />;
}
