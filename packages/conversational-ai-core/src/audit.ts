export type AuditEventType =
  | "conversation.request"
  | "conversation.response"
  | "conversation.confirmation_required"
  // The plan required data the tools reported they do not hold, so the answer was
  // refused rather than approximated. Worth auditing separately from a normal
  // response: a rise here means questions are outrunning the data, not that the
  // assistant is failing.
  | "conversation.refused_no_data"
  | "tool.execution"
  | "voice.playback"
  | "voice.transcript";

export interface AuditEventRecord {
  id: string;
  type: AuditEventType;
  timestamp: string;
  userId?: string;
  organizationId?: string;
  detail: Record<string, unknown>;
}

const auditLogStore: AuditEventRecord[] = [];
const MAX_AUDIT_LOGS = 500;

export function recordAuditEvent(
  type: AuditEventType,
  detail: Record<string, unknown>,
  context?: {
    userId?: string;
    organizationId?: string;
  }
) {
  const record: AuditEventRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    userId: context?.userId,
    organizationId: context?.organizationId,
    detail,
  };

  auditLogStore.unshift(record);
  if (auditLogStore.length > MAX_AUDIT_LOGS) {
    auditLogStore.length = MAX_AUDIT_LOGS;
  }

  console.log("[conversation.audit]", {
    type: record.type,
    userId: record.userId,
    organizationId: record.organizationId,
    detail,
  });

  return record;
}
