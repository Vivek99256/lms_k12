import * as React from "react";

/** 4-segment password strength indicator with a text label. Pair with a password TextField. */
export interface PasswordStrengthMeterProps {
  value?: string;
  className?: string;
}
export function PasswordStrengthMeter(props: PasswordStrengthMeterProps): JSX.Element;
