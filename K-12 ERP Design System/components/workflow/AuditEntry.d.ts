import * as React from "react";

/** One immutable audit-log record. Read-only; optionally expandable for detail. */
export interface AuditEntryProps {
  actor: React.ReactNode;
  action: React.ReactNode;
  actionType?: "create" | "update" | "delete" | "login" | "export";
  target?: React.ReactNode;
  timestamp: React.ReactNode;
  ip?: string;
  /** Extra key/value detail shown when expanded. */
  detail?: Record<string, React.ReactNode>;
  expandable?: boolean;
  className?: string;
}
export function AuditEntry(props: AuditEntryProps): JSX.Element;
