import * as React from "react";

export interface MenuItem {
  label?: React.ReactNode;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  shortcut?: React.ReactNode;
}

/**
 * A transient overlay of actions/options anchored to a trigger. Canonical
 * dropdown — use for row actions, bulk actions, account/help menus.
 */
export interface MenuProps {
  /** Trigger node (usually an IconButton or Button). */
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
}
export function Menu(props: MenuProps): JSX.Element;
