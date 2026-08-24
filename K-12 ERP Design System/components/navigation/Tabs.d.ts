import * as React from "react";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: string;
  badge?: React.ReactNode;
}

/** Switch between peer sections of a page (detail, profile, settings). */
export interface TabsProps {
  tabs: TabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  variant?: "underline" | "enclosed";
  className?: string;
}
export function Tabs(props: TabsProps): JSX.Element;
