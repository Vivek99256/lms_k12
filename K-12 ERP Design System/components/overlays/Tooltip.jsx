import React from "react";

/**
 * Tooltip — brief text hint on hover/focus. Supplements a real label; never
 * the sole accessible name. Wraps a single interactive child.
 */
export function Tooltip({ label, placement = "top", children }) {
  const [show, setShow] = React.useState(false);
  return (
    <span
      className="ds-tooltip"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span className={["ds-tooltip__bubble", `ds-tooltip__bubble--${placement}`].join(" ")} role="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}
