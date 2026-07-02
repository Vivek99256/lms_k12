import * as React from "react";

/** A brief, non-blocking confirmation/notice. Render inside a ToastViewport. */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
  title?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  children?: React.ReactNode;
}
export function Toast(props: ToastProps): JSX.Element;

/** Fixed-position stack container for toasts. */
export interface ToastViewportProps {
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
  children?: React.ReactNode;
  className?: string;
}
export function ToastViewport(props: ToastViewportProps): JSX.Element;
