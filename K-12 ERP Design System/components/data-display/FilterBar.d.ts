import * as React from "react";

export interface ActiveFilter {
  id?: string;
  label: string;
  [key: string]: any;
}

/**
 * Toolbar region that hosts filter controls (SearchInput, Select, Combobox…)
 * as children and summarizes applied filters as removable chips with clear-all
 * and a result count.
 */
export interface FilterBarProps {
  /** Filter controls to render inline. */
  children?: React.ReactNode;
  activeFilters?: ActiveFilter[];
  onClearAll?: () => void;
  onRemoveFilter?: (f: ActiveFilter) => void;
  /** e.g. "128 results". */
  resultCount?: React.ReactNode;
  /** Right-aligned actions (density toggle, column config). */
  trailing?: React.ReactNode;
  className?: string;
}
export function FilterBar(props: FilterBarProps): JSX.Element;
