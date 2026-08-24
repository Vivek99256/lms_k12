import * as React from "react";

/**
 * The platform's atomic action primitive. Choose the variant by hierarchy:
 * one `primary` per view, `secondary`/`tertiary` for supporting actions,
 * `danger` for destructive intent, `ghost`/`link` for low-emphasis actions.
 *
 * @dsCard group="Components"
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: "primary" | "secondary" | "tertiary" | "danger" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  /** Lucide icon name rendered before the label. */
  iconStart?: string;
  /** Lucide icon name rendered after the label. */
  iconEnd?: string;
  /** Shows a spinner and sets aria-busy; also disables the button. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to fill container width (used in mobile action footers). */
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;
