import * as React from "react";

/** Contextual content anchored to a trigger (quick views, filters, inline help). */
export interface PopoverProps {
  /** Trigger node or render fn ({open}) => node. */
  trigger: React.ReactNode | ((state: { open: boolean }) => React.ReactNode);
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  /** Panel content, or render fn ({close}) => node. */
  children?: React.ReactNode | ((api: { close: () => void }) => React.ReactNode);
  className?: string;
}
export function Popover(props: PopoverProps): JSX.Element;
