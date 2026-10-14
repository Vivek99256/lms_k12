'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { alumniApi, AlumniApiError, type AlumniRow } from '../_lib/alumni-api';
import { Banner, EmptyState, LoadingBlock, PageFrame, formatDate, inputClass } from '../_components/alumni-ui';

export default function PendingVerificationPage() {
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    return alumniApi
      .list({ status: 'pending_verification', sort: 'created_at', dir: 'asc', per_page: 100 }, signal)
      .then((result) => {
        setRows(result.rows);
        setError('');
      })
      .catch((failure: unknown) => {
        if (failure instanceof DOMException && failure.name === 'AbortError') return;
        setError(failure instanceof Error ? failure.message : "Couldn't load registrations. Try again.");
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function decide(row: AlumniRow, decision: 'approve' | 'reject') {
    setBusy(row.id);
    setNotice('');
    setError('');
    try {
      await alumniApi.verify(row.id, decision, decision === 'reject' ? reason.trim() : undefined);
      setNotice(decision === 'approve' ? `${row.full_name} is now verified.` : `${row.full_name}'s registration was rejected.`);
      setRejecting(null);
      setReason('');
      await load();
    } catch (failure) {
      setError(failure instanceof AlumniApiError ? failure.fieldErrors.remarks?.[0] ?? failure.message : "Couldn't update the registration. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageFrame title="Pending verification" description="Review self-registered alumni and compare their details with the student record before approving.">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading && rows.length === 0 ? (
          <LoadingBlock label="Loading registrations…" />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing is waiting for review" hint="New self-registrations will appear here until you approve or reject them." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                <div>
                  <Link href={`/alumni/profile/${row.id}`} className="font-medium text-indigo-700 hover:underline">{row.full_name}</Link>
                  <p className="font-mono text-xs text-slate-500">{row.alumni_code}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {[row.batch ? `Batch ${row.batch}` : null, row.email, row.mobile].filter(Boolean).join(' · ') || 'No details given'}
                  </p>
                  <p className="text-xs text-slate-500">Registered {formatDate(row.created_at)}</p>
                  {rejecting === row.id ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        className={inputClass + ' max-w-sm'}
                        placeholder="Reason for rejecting"
                        aria-label={`Reason for rejecting ${row.full_name}`}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                      <Button variant="destructive" className="h-9" disabled={busy === row.id || reason.trim() === ''} onClick={() => decide(row, 'reject')}>
                        Reject registration
                      </Button>
                      <Button variant="ghost" className="h-9" onClick={() => { setRejecting(null); setReason(''); }}>Cancel</Button>
                    </div>
                  ) : null}
                </div>
                {rejecting === row.id ? null : (
                  <div className="flex gap-2">
                    <Button className="h-9" disabled={busy === row.id} onClick={() => decide(row, 'approve')}>
                      <Check className="size-4" aria-hidden /> Approve
                    </Button>
                    <Button variant="outline" className="h-9" disabled={busy === row.id} onClick={() => setRejecting(row.id)}>
                      <X className="size-4" aria-hidden /> Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageFrame>
  );
}
