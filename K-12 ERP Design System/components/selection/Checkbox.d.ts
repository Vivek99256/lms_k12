import * as React from "react";

/**
 * Boolean toggle or row/item selector. Supports an `indeterminate` visual for
 * partial group selection (e.g. "select all" header checkbox).
 *
 * @dsCard group="Components"
 */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  /** Secondary line under the label. */
  description?: string;
  indeterminate?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
}
export function Checkbox(props: CheckboxProps): JSX.Element;
