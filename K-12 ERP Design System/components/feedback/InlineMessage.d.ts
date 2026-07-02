import * as React from "react";

/** Field- or block-level validation/guidance message with a severity icon. */
export interface InlineMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: "info" | "success" | "warning" | "error";
  children?: React.ReactNode;
}
export function InlineMessage(props: InlineMessageProps): JSX.Element;
