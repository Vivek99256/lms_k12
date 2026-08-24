import * as React from "react";

/**
 * Focused blocking dialog with scrim, focus management, and escape/backdrop
 * dismiss. Use for create/edit-in-context, previews, and prompts.
 */
export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Footer action row (buttons). */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Allow escape/backdrop/close-button dismissal. */
  dismissible?: boolean;
  variant?: "standard" | "form";
  children?: React.ReactNode;
  className?: string;
}
export function Modal(props: ModalProps): JSX.Element | null;
