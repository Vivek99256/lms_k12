import * as React from "react";

export interface CalendarEvent {
  title: React.ReactNode;
  time?: React.ReactNode;
  tone?: "brand" | "success" | "warning" | "error" | "info";
  allDay?: boolean;
}

/** Month grid rendering events per day (timetables, PTM slots, transport schedules). */
export interface CalendarGridProps {
  /** Any Date within the month to display. */
  month?: Date;
  /** Map of "YYYY-MM-DD" -> events. */
  events?: Record<string, CalendarEvent[]>;
  onSelectDay?: (date: Date) => void;
  className?: string;
}
export function CalendarGrid(props: CalendarGridProps): JSX.Element;
