import * as React from "react";

export interface DescriptionItem {
  term: React.ReactNode;
  value: React.ReactNode;
}

/**
 * Read-only labeled field values for a record summary or receipt. This is the
 * canonical key/value display — do NOT create a separate `key-value-list`.
 */
export interface DescriptionListProps {
  items: DescriptionItem[];
  /** `two-column` = term/value side by side; `inline`; `stacked`. */
  variant?: "two-column" | "inline" | "stacked";
  /** Number of columns to flow rows into (desktop). */
  columns?: number;
  className?: string;
}
export function DescriptionList(props: DescriptionListProps): JSX.Element;
