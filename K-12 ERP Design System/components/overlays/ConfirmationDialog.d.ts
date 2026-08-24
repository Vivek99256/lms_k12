import * as React from "react";

/**
 * Deliberate confirmation before a consequential/irreversible action.
 * `destructive` distinguishes deletes/publishes with a danger confirm button.
 */
export interface ConfirmationDialogProps {
  open: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}
export function ConfirmationDialog(props: ConfirmationDialogProps): JSX.Element | null;
