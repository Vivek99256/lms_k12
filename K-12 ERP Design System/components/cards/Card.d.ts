import * as React from "react";

/**
 * The base bounded surface for grouping content. Optional header (title/
 * subtitle/actions) and footer. The container for most composed content.
 *
 * @dsCard group="Components"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Header trailing slot (buttons, menu). */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "default" | "interactive" | "selectable" | "outline";
  selected?: boolean;
  /** Apply body padding (turn off for flush media/tables). */
  padded?: boolean;
  children?: React.ReactNode;
}
export function Card(props: CardProps): JSX.Element;
