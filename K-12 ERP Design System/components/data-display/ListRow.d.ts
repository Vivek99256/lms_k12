import * as React from "react";

/**
 * A selectable, actionable row for any non-tabular collection (lists, master
 * panes, notifications, search results). Slot-based; renders as a link,
 * button, or static div depending on props.
 */
export interface ListRowProps extends React.HTMLAttributes<HTMLElement> {
  /** Leading slot — usually an Avatar or Icon. */
  leading?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Trailing metadata (timestamp, amount, badge). */
  meta?: React.ReactNode;
  /** Trailing actions (IconButton, Menu). */
  trailing?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  href?: string;
  children?: React.ReactNode;
}
export function ListRow(props: ListRowProps): JSX.Element;
