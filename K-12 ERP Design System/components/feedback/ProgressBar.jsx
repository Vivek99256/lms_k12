import React from "react";

/**
 * ProgressBar — determinate or indeterminate task progress.
 * value 0–100 (determinate); omit / set indeterminate for unknown progress.
 */
export function ProgressBar({ value = 0, max = 100, indeterminate = false, variant = "brand", size = "md", showValue = false, label, className = "" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={["ds-progress", `ds-progress--${size}`, className].filter(Boolean).join(" ")}>
      {(label || showValue) && (
        <div className="ds-progress__head">
          {label && <span className="ds-progress__label">{label}</span>}
          {showValue && !indeterminate && <span className="ds-progress__value">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="ds-progress__track"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={["ds-progress__fill", `ds-progress__fill--${variant}`, indeterminate ? "is-indeterminate" : ""].filter(Boolean).join(" ")}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
