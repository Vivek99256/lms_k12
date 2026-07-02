import * as React from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Choose one value from a closed list (class, section, status pickers). */
export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  errorText?: string;
  required?: boolean;
  id?: string;
  className?: string;
}
export function Select(props: SelectProps): JSX.Element;
