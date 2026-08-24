import * as React from "react";

/**
 * Fills a region for no-data, error, success, and access states. Canonical
 * state view — replaces empty-state / error-state / success-state.
 *
 * @dsCard group="Components"
 */
export interface StatusViewProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "empty" | "error" | "success" | "no-results" | "no-access" | "offline";
  /** Override the preset Lucide icon. */
  icon?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Call-to-action buttons. */
  actions?: React.ReactNode;
  size?: "md" | "lg";
}
export function StatusView(props: StatusViewProps): JSX.Element;
