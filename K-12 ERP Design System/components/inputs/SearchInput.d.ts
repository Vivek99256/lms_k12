import * as React from "react";

/** Search/filter query field with search icon, clear button, and loading state. */
export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called when the clear (×) button is pressed. */
  onClear?: () => void;
  size?: "sm" | "md";
  loading?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}
export function SearchInput(props: SearchInputProps): JSX.Element;
