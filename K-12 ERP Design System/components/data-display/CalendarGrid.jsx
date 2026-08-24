import React from "react";
import { EventChip } from "./EventChip.jsx";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * CalendarGrid — a month grid rendering events per day. `month` is a Date in
 * the target month; `events` is a map of "YYYY-MM-DD" -> [{ title, tone, time }].
 */
export function CalendarGrid({ month = new Date(), events = {}, onSelectDay, className = "" }) {
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isToday = (d) => d && d.toDateString() === today.toDateString();

  return (
    <div className={["ds-calendar-grid", className].filter(Boolean).join(" ")}>
      <div className="ds-calendar-grid__dow">
        {DOW.map((d) => <span key={d} className="ds-calendar-grid__dowcell">{d}</span>)}
      </div>
      <div className="ds-calendar-grid__body">
        {cells.map((d, i) => (
          <div
            key={i}
            className={["ds-calendar-grid__cell", !d ? "is-empty" : "", isToday(d) ? "is-today" : ""].filter(Boolean).join(" ")}
            onClick={d && onSelectDay ? () => onSelectDay(d) : undefined}
          >
            {d && (
              <>
                <span className="ds-calendar-grid__date">{d.getDate()}</span>
                <div className="ds-calendar-grid__events">
                  {(events[key(d)] || []).slice(0, 3).map((ev, j) => (
                    <EventChip key={j} title={ev.title} time={ev.time} tone={ev.tone} allDay={ev.allDay} />
                  ))}
                  {(events[key(d)] || []).length > 3 && (
                    <span className="ds-calendar-grid__more">+{events[key(d)].length - 3} more</span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
