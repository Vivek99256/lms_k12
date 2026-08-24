import * as React from "react";

/** Hairline separator; optional centered label for horizontal dividers. */
export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  label?: React.ReactNode;
}
export function Divider(props: DividerProps): JSX.Element;
