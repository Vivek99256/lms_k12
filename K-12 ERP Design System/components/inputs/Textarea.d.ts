import * as React from "react";

/** Multi-line free-text input (notes, remarks, descriptions, messages). */
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
  label?: string;
  helperText?: string;
  errorText?: string;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Show a character counter (auto-on when maxLength is set). */
  showCount?: boolean;
}
export function Textarea(props: TextareaProps): JSX.Element;
