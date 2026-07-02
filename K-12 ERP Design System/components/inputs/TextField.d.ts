import * as React from "react";

/**
 * Single-line text input with label, helper/error text, and optional icons.
 * Use everywhere structured entry happens. `type="password"` adds a reveal
 * toggle. Errors render with an icon + text (never color alone).
 *
 * @dsCard group="Components"
 */
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  type?: "text" | "email" | "number" | "tel" | "password" | "url";
  helperText?: string;
  /** Presence flips the field to the error state and is announced. */
  errorText?: string;
  size?: "sm" | "md" | "lg";
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Lucide icon name shown inside the field, leading edge. */
  iconStart?: string;
  /** Lucide icon name shown inside the field, trailing edge. */
  iconEnd?: string;
}

export function TextField(props: TextFieldProps): JSX.Element;
