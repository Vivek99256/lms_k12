'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, MessageCircle, MessageSquareText, RefreshCw, Search, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DISPATCH_UPDATED_EVENT,
  getStoredDispatches,
  type StoredDispatchRow,
} from '@/lib/communication/dispatch-store';

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function StatusBadge({ status }: { status: StoredDispatchRow['status'] }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
        <CheckCircle2 className="h-3 w-3" /> sent
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
        <XCircle className="h-3 w-3" /> failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
      <Clock className="h-3 w-3" /> {status}
    </span>
  );
}

export function ModuleDeliveryLog({ moduleKey }: { moduleKey: string }) {
  const [rows, setRows] = useState<StoredDispatchRow[]>([]);
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');

  const load = useCallback(() => setRows(getStoredDispatches(moduleKey)), [moduleKey]);

  useEffect(() => {
    load();
    window.addEventListener(DISPATCH_UPDATED_EVENT, load);
    return () => window.removeEventListener(DISPATCH_UPDATED_EVENT, load);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (channel !== 'all' && r.channel.toLowerCase() !== channel) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      return [r.mobile_number, r.recipient_name, r.subject, r.message_body].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [rows, query, channel, status]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      sent: rows.filter((r) => r.status === 'sent').length,
      queued: rows.filter((r) => r.status === 'queued').length,
      failed: rows.filter((r) => r.status === 'failed').length,
    }),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total', value: counts.total, tone: 'text-slate-900' },
          { label: 'Sent', value: counts.sent, tone: 'text-emerald-700' },
          { label: 'Queued', value: counts.queued, tone: 'text-slate-700' },
          { label: 'Failed', value: counts.failed, tone: 'text-rose-600' },
        ].map((c) => (
          <Card key={c.label} className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{c.label}</p>
              <p className={`mt-2 text-2xl font-bold ${c.tone}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by mobile number, name, subject or message..."
            className="pl-9 text-sm"
          />
        </div>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="all">All channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
        </select>
        <Button variant="outline" size="sm" onClick={load} className="flex items-center gap-1.5 text-xs text-slate-600">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Sent</th>
                <th className="px-4 py-3.5">Mobile</th>
                <th className="px-4 py-3.5">Recipient</th>
                <th className="px-4 py-3.5">Channel</th>
                <th className="px-4 py-3.5">Message</th>
                <th className="px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {rows.length === 0
                      ? 'No notices sent from this browser yet. Notices you send from the Send notice tab are listed here.'
                      : 'No notices match the current search or filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-700">{formatDateTime(r.sent_at || r.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono">{r.mobile_number || '—'}</td>
                    <td className="px-4 py-3.5">{r.recipient_name || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {r.channel.toLowerCase() === 'whatsapp' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                          <MessageSquareText className="h-3.5 w-3.5" /> SMS
                        </span>
                      )}
                    </td>
                    <td className="max-w-[320px] px-4 py-3.5">
                      <p className="truncate font-semibold text-slate-800">{r.subject || '—'}</p>
                      <p className="truncate text-[11px] text-slate-400" title={r.message_body ?? ''}>{r.message_body}</p>
                      {r.status === 'failed' && r.last_error && <p className="mt-0.5 text-[11px] text-rose-600">{r.last_error}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
