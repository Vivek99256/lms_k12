import * as React from "react";

export interface StepItem {
  label: React.ReactNode;
  description?: React.ReactNode;
}

/** Progress indicator for a sequential/branching task (wizards, admissions, payroll). */
export interface StepperProps {
  steps: StepItem[];
  /** Index of the active step; earlier steps render as completed. */
  current?: number;
  orientation?: "horizontal" | "vertical";
  className?: string;
}
export function Stepper(props: StepperProps): JSX.Element;
