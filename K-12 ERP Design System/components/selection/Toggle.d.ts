import * as React from "react";

/** On/off switch for a setting with immediate effect (uses switch role). */
export interface ToggleProps {
  label?: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  id?: string;
  className?: string;
}
export function Toggle(props: ToggleProps): JSX.Element;
