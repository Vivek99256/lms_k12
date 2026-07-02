import * as React from "react";

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
  onClick?: () => void;
  /** Optional leading Lucide icon (e.g. "house" on the root crumb). */
  icon?: string;
}

/** Location trail with a path back; collapses the middle to a menu past maxItems. */
export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Max crumbs before the middle collapses into an overflow menu. Default 4. */
  maxItems?: number;
  className?: string;
}
export function Breadcrumb(props: BreadcrumbProps): JSX.Element;
