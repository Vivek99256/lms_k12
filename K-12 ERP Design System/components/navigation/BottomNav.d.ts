import * as React from "react";

export interface BottomNavItem {
  id: string;
  label: React.ReactNode;
  icon: string;
  badge?: React.ReactNode;
}

/** Mobile-only primary navigation for a role's frequent destinations. */
export interface BottomNavProps {
  items: BottomNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}
export function BottomNav(props: BottomNavProps): JSX.Element;
