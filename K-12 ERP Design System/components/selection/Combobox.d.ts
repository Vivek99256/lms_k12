import * as React from "react";

export interface ComboboxOption {
  value: string;
  label: string;
}

/**
 * Type-ahead search + select over large option sets. Single-select returns a
 * string; multi-select returns a string[] and renders removable chips.
 */
export interface ComboboxProps {
  label?: string;
  options: ComboboxOption[];
  /** string for single-select; string[] for multi. */
  value?: string | string[];
  onChange?: (value: any) => void;
  placeholder?: string;
  multi?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
  id?: string;
  className?: string;
}
export function Combobox(props: ComboboxProps): JSX.Element;
