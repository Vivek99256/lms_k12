import React from "react";
import { EventChip } from "./EventChip.jsx";

/**
 * AgendaList — chronological events grouped by day (mobile-friendly calendar
 * alternative). groups: [{ date, label, events:[{ title, time, tone }] }].
 */
export function AgendaList({ groups = [], onSelect, className = "" }) {
  return (
    <div className={["ds-agenda", className].filter(Boolean).join(" ")}>
      {groups.map((g, i) => (
        <div key={i} className="ds-agenda__group">
          <div className="ds-agenda__date">
            <span className="ds-agenda__day">{g.day}</span>
            <span className="ds-agenda__weekday">{g.weekday}</span>
          </div>
          <div className="ds-agenda__events">
            {g.events.map((ev, j) => (
              <div key={j} className="ds-agenda__event">
                <span className="ds-agenda__time">{ev.time || "All day"}</span>
                <EventChip title={ev.title} tone={ev.tone} onClick={onSelect ? () => onSelect(ev) : undefined} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
