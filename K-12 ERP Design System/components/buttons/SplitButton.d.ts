import * as React from "react";

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `attached` = seamless segmented row; `spaced` = inline gap between buttons. */
  variant?: "attached" | "spaced";
  /** Accessible group name. */
  label?: string;
  children?: React.ReactNode;
}
export function ButtonGroup(props: ButtonGroupProps): JSX.Element;

export interface SplitButtonItem {
  label: string;
  icon?: string;
  onClick?: () => void;
}

/** A primary action paired with a dropdown of related secondary actions. */
export interface SplitButtonProps {
  children?: React.ReactNode;
  /** Primary action handler. */
  onClick?: () => void;
  /** Secondary actions listed in the menu. */
  items?: SplitButtonItem[];
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  menuLabel?: string;
  className?: string;
}
export function SplitButton(props: SplitButtonProps): JSX.Element;
