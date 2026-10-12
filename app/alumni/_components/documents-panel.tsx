'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { alumniApi, AlumniApiError, type AlumniDocument } from '../_lib/alumni-api';
import { Banner, EmptyState, FormField, LoadingBlock, Panel, formatDate, humanize, inputClass } from './alumni-ui';

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  verified: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-red-50 text-red-800 ring-red-200',
};

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsPanel({ alumniId, onChanged }: { alumniId: number; onChanged?: () => void }) {
  const [types, setTypes] = useState<string[]>([]);
  const [maxKb, setMaxKb] = useState(5120);
  const [rows, setRows] = useState<AlumniDocument[] | null>(null);
  const [docType, setDocType] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    (signal?: AbortSignal) =>
      alumniApi
        .documents(alumniId, signal)
        .then((result) => {
          setTypes(result.types);
          setMaxKb(result.max_kb);
          setRows(result.rows);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(reason instanceof Error ? reason.message : "Couldn't load documents. Try again.");
        }),
    [alumniId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(done);
      await load();
      onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    setErrors({});
    setError('');
    if (!file || !docType) {
      setErrors({ ...(file ? {} : { file: ['Choose a file to upload.'] }), ...(docType ? {} : { doc_type: ['Choose the document type.'] }) });
      return;
    }
    if (file.size > maxKb * 1024) {
      setErrors({ file: [`The file must be ${Math.round(maxKb / 1024)} MB or smaller.`] });
      return;
    }
    setBusy(true);
    try {
      await alumniApi.uploadDocument(alumniId, file, docType, remarks.trim() || undefined);
      setNotice('Document uploaded. It is waiting for verification.');
      setDocType('');
      setRemarks('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
      onChanged?.();
    } catch (reason) {
      if (reason instanceof AlumniApiError) {
        setErrors(reason.fieldErrors);
        setError(reason.message);
      } else {
        setError("Couldn't upload the file. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      <Panel title="Upload a document">
        <form onSubmit={upload} className="grid gap-4 md:grid-cols-4" noValidate>
          <FormField label="Document type" required error={errors.doc_type?.[0]}>
            <select className={inputClass} value={docType} onChange={(event) => setDocType(event.target.value)}>
              <option value="">Select</option>
              {types.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
            </select>
          </FormField>
          <FormField label="File" required error={errors.file?.[0]} hint={`PDF, JPG, PNG or Word. Up to ${Math.round(maxKb / 1024)} MB.`}>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className={inputClass + ' py-1.5'} />
          </FormField>
          <FormField label="Remarks" error={errors.remarks?.[0]}>
            <input className={inputClass} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" className="h-9" disabled={busy}><Upload className="size-4" aria-hidden /> Upload</Button>
          </div>
        </form>
      </Panel>

      <Panel title="Documents">
        {rows === null ? (
          <LoadingBlock label="Loading documents…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No documents uploaded" hint="Certificates, ID proof, employment proof and business documents appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{doc.original_name}</p>
                  <p className="text-sm text-slate-500">
                    {humanize(doc.doc_type)} · {size(doc.size_bytes)} · uploaded {formatDate(doc.created_at)}
                  </p>
                  {doc.remarks ? <p className="text-sm text-slate-600">Remarks: {doc.remarks}</p> : null}
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[doc.verification_status] ?? STATUS_TONE.pending}`}>
                    {humanize(doc.verification_status)}
                  </span>
                  {rejecting === doc.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input className={inputClass + ' max-w-xs'} placeholder="Reason for rejecting" aria-label={`Reason for rejecting ${doc.original_name}`} value={reason} onChange={(event) => setReason(event.target.value)} />
                      <Button variant="destructive" className="h-9" disabled={busy || !reason.trim()}
                        onClick={() => run(async () => { await alumniApi.verifyDocument(alumniId, doc.id, 'rejected', reason.trim()); setRejecting(null); setReason(''); }, 'Document rejected.')}>
                        Reject document
                      </Button>
                      <Button variant="ghost" className="h-9" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => alumniApi.downloadDocument(alumniId, doc.id), 'Download started.')}>
                    <Download className="size-3.5" aria-hidden /> Download
                  </Button>
                  {doc.verification_status !== 'verified' ? (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => alumniApi.verifyDocument(alumniId, doc.id, 'verified'), 'Document verified.')}>Verify</Button>
                  ) : null}
                  {doc.verification_status !== 'rejected' && rejecting !== doc.id ? (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => setRejecting(doc.id)}>Reject</Button>
                  ) : null}
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${doc.original_name}`} disabled={busy}
                    onClick={() => { if (window.confirm(`Remove “${doc.original_name}”? This can't be undone.`)) void run(() => alumniApi.deleteDocument(alumniId, doc.id), 'Document removed.'); }}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
