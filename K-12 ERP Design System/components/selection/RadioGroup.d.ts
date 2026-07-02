import * as React from "react";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Choose exactly one from a small set. `card` variant makes each a selectable card. */
export interface RadioGroupProps {
  name?: string;
  /** Accessible group name. */
  label?: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  orientation?: "vertical" | "horizontal";
  variant?: "default" | "card";
  disabled?: boolean;
  className?: string;
}
export function RadioGroup(props: RadioGroupProps): JSX.Element;
