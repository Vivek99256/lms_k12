import * as React from "react";

/** A scheduled event within a calendar view. */
export interface EventChipProps {
  title: React.ReactNode;
  time?: React.ReactNode;
  tone?: "brand" | "success" | "warning" | "error" | "info";
  allDay?: boolean;
  onClick?: () => void;
  className?: string;
}
export function EventChip(props: EventChipProps): JSX.Element;
