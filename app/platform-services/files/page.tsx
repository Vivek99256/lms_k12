'use client';

import { useState } from 'react';

import { AttachmentsPanel } from '../_components/AttachmentsPanel';
import { PlainShell } from '../_components/shell';

/**
 * Platform services -> File storage.
 *
 * The shared attachment store. Any record in any module attaches files through
 * the same panel; this screen lets an administrator look at one record's files
 * by its type and id.
 */
export default function FilesPage() {
  const [entityType, setEntityType] = useState('sample_tc_request');
  const [entityId, setEntityId] = useState('S-001');

  return (
    <PlainShell title="File storage" description="Files attached to records, with versions. Choose a record by its type and id.">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-slate-700">
          Record type
          <input
            value={entityType}
            onChange={(event) => setEntityType(event.target.value.trim())}
            className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm text-slate-700">
          Record id
          <input
            value={entityId}
            onChange={(event) => setEntityId(event.target.value.trim())}
            className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      {entityType && entityId && <AttachmentsPanel key={`${entityType}:${entityId}`} entityType={entityType} entityId={entityId} />}
    </PlainShell>
  );
}
