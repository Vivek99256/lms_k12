import React from "react";

const TONE = {
  brand: "var(--action-primary)",
  success: "var(--feedback-success-solid)",
  warning: "var(--feedback-warning-solid)",
  error: "var(--feedback-error-solid)",
  info: "var(--feedback-info-solid)",
};

/**
 * EventChip — a scheduled event within a calendar view. `tone` sets the accent;
 * `time` shows for timed events; `allDay` renders a filled block.
 */
export function EventChip({ title, time, tone = "brand", allDay = false, onClick, className = "" }) {
  const accent = TONE[tone] || TONE.brand;
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      className={["ds-event-chip", allDay ? "is-allday" : "", onClick ? "is-interactive" : "", className].filter(Boolean).join(" ")}
      style={allDay ? { background: accent } : { "--_accent": accent }}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      {!allDay && <span className="ds-event-chip__dot" style={{ background: accent }} />}
      <span className="ds-event-chip__title">{title}</span>
      {time && !allDay && <span className="ds-event-chip__time">{time}</span>}
    </Comp>
  );
}
