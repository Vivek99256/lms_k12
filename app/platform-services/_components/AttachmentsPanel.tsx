'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteFile, downloadFile, fetchFiles, PlatformApiError, uploadFile, type AttachedFile } from '@/lib/platform/client';

import { Card, ErrorState, formatWhen, LoadingState, Note, Pill, SampleBadge } from './shell';

/**
 * Files attached to one record. Drop it on any screen with the record's type and id:
 *
 *   <AttachmentsPanel entityType="student" entityId={String(student.id)} />
 *
 * Uploading the same file name again adds a new version and keeps the old one.
 * Removing a file hides it from this list; the stored copy and history remain.
 */
export function AttachmentsPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [files, setFiles] = useState<AttachedFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setFiles(await fetchFiles(entityType, entityId));
    } catch (reason) {
      setError(reason instanceof PlatformApiError ? reason.message : 'Files could not be loaded.');
    }
  }, [entityType, entityId]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const saved = await uploadFile(entityType, entityId, file);
      setNote({ tone: 'ok', text: `${saved.name} attached as version ${saved.version}.` });
      await load();
    } catch (reason) {
      setNote({ tone: 'error', text: reason instanceof PlatformApiError ? reason.message : 'The upload failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(file: AttachedFile) {
    setBusy(true);
    try {
      await deleteFile(file.id);
      await load();
    } catch (reason) {
      setNote({ tone: 'error', text: reason instanceof PlatformApiError ? reason.message : 'The file could not be removed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Attachments</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Attach file
        </button>
        <input ref={input} type="file" className="hidden" onChange={onPick} aria-label="Choose a file to attach" />
      </div>

      <div className="mt-3 space-y-2">
        {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : files === null ? (
          <LoadingState label="Loading files" />
        ) : files.length === 0 ? (
          <p className="text-sm text-slate-600">No files attached.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-900">{file.name}</span>
                  <Pill>v{file.version}</Pill>
                  <SampleBadge show={file.is_sample} />
                  <span className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB · {file.uploaded_by_name ?? 'Unknown'} · {formatWhen(file.created_at)}
                  </span>
                </div>
                <div className="flex gap-3 text-sm">
                  <button type="button" className="text-indigo-700 hover:underline" onClick={() => void downloadFile(file)}>
                    Download
                  </button>
                  <button type="button" className="text-slate-600 hover:underline" disabled={busy} onClick={() => void remove(file)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
