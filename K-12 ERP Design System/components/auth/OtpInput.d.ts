import * as React from "react";

/** Segmented one-time-code entry with paste + backspace handling. */
export interface OtpInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  /** Fired when all boxes are filled. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}
export function OtpInput(props: OtpInputProps): JSX.Element;
