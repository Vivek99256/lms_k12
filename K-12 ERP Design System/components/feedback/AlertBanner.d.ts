import * as React from "react";

/** Persistent page/section message (outages, deadlines, policy notices). */
export interface AlertBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
  title?: React.ReactNode;
  /** Trailing action (Button). */
  action?: React.ReactNode;
  /** Show a dismiss (×) control. */
  onDismiss?: () => void;
  children?: React.ReactNode;
}
export function AlertBanner(props: AlertBannerProps): JSX.Element;
