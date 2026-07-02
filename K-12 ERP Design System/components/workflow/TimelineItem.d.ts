import * as React from "react";

/** A dated event in a chronological stream. Wrap items in <ol className="ds-timeline">. */
export interface TimelineItemProps {
  title: React.ReactNode;
  timestamp?: React.ReactNode;
  actor?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "error" | "info";
  /** Override the tone's default Lucide icon. */
  icon?: string;
  /** Set on the final item to hide the connector line. */
  last?: boolean;
  children?: React.ReactNode;
  className?: string;
}
export function TimelineItem(props: TimelineItemProps): JSX.Element;
