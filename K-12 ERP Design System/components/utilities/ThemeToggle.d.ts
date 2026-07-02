import * as React from "react";

/** Switch light / dark / high-contrast by setting [data-theme] on <html>. */
export interface ThemeToggleProps {
  value?: "light" | "dark" | "high-contrast-light" | "high-contrast-dark";
  onChange?: (theme: string) => void;
  className?: string;
}
export function ThemeToggle(props: ThemeToggleProps): JSX.Element;
