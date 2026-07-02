import * as React from "react";

export interface SidebarItem {
  id?: string;
  label?: string;
  /** Lucide icon name. */
  icon?: string;
  badge?: React.ReactNode;
  /** When set, renders a section divider/heading instead of a link. */
  section?: string;
}

/**
 * The persistent primary navigation rail (the app's spine). Role-scoped item
 * lists; `collapsed` gives an icon-only rail for tablet.
 *
 * @dsCard group="Components"
 */
export interface SidebarNavProps {
  items: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  collapsed?: boolean;
  /** Brand/logo slot at the top. */
  header?: React.ReactNode;
  /** Account/help slot at the bottom. */
  footer?: React.ReactNode;
  className?: string;
}
export function SidebarNav(props: SidebarNavProps): JSX.Element;
