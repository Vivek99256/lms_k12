import * as React from "react";

/** Edge-anchored panel for review-in-context, filters, notifications, quick edit. */
export interface DrawerProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  edge?: "inline-end" | "inline-start" | "bottom-sheet";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  className?: string;
}
export function Drawer(props: DrawerProps): JSX.Element | null;
