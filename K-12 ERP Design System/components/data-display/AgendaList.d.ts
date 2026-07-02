import * as React from "react";

export interface AgendaGroup {
  day: React.ReactNode;
  weekday: React.ReactNode;
  events: { title: React.ReactNode; time?: React.ReactNode; tone?: string }[];
}

/** Chronological events grouped by day — the mobile calendar view. */
export interface AgendaListProps {
  groups: AgendaGroup[];
  onSelect?: (event: any) => void;
  className?: string;
}
export function AgendaList(props: AgendaListProps): JSX.Element;
