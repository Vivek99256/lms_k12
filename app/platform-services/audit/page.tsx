'use client';

import { AuditConsole } from './_components/AuditConsole';

/**
 * Platform services -> Audit.
 *
 * The shared audit trail, read only. Other modules write to it; nothing here can
 * change an entry.
 */
export default function AuditPage() {
  return <AuditConsole />;
}
