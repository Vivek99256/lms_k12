import * as React from "react";

/** A single notification with unread state (weight + dot, not color) and actions. */
export interface NotificationItemProps {
  title: React.ReactNode;
  body?: React.ReactNode;
  timestamp: React.ReactNode;
  type?: "fee" | "admission" | "consent" | "transport" | "system" | "message";
  unread?: boolean;
  onOpen?: () => void;
  onDismiss?: () => void;
  className?: string;
}
export function NotificationItem(props: NotificationItemProps): JSX.Element;
