import * as React from "react";

/**
 * Date field with a month-calendar popover. Value is a JS Date. Use for due
 * dates, timetables, admissions, and leave. Text field is read-only; selection
 * happens in the calendar (keyboard/click), which closes on pick or Escape.
 */
export interface DatePickerProps {
  label?: string;
  /** Controlled selected date. */
  value?: Date | null;
  onChange?: (date: Date) => void;
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  errorText?: string;
  required?: boolean;
  id?: string;
  className?: string;
}
export function DatePicker(props: DatePickerProps): JSX.Element;
