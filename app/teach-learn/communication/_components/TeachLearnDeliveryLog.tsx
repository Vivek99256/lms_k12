'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/result/toast';
import {
  DISPATCH_UPDATED_EVENT,
  extractPhoneAndName,
  getStoredDispatches,
  type StoredDispatchRow,
} from '@/lib/communication/dispatch-store';

const SEEDED_SAMPLE_DISPATCHES: StoredDispatchRow[] = [
  {
    id: 401,
    module: 'teach-learn',
    event_key: 'teach_learn.homework_alert',
    channel: 'whatsapp',
    recipient: '+91 98250 12345 (Rajesh Patel - F/O Aarav Patel, Gr 10-A)',
    recipient_name: 'Rajesh Patel',
    mobile_number: '+91 98250 12345',
    subject: 'Homework & Assignment Advisory - Mathematics',
    message_body: 'Dear Rajesh Patel, Mathematics homework (Chapter 5: Quadratic Equations, Ex 5.2) has been assigned to Aarav Patel (Grade 10-A) and is due tomorrow morning. Please ensure timely submission.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T06:45:00.000Z',
    created_at: '2026-10-31T06:44:00.000Z',
    is_sample: 1,
  },
  {
    id: 402,
    module: 'teach-learn',
    event_key: 'teach_learn.unit_test_alert',
    channel: 'sms',
    recipient: '+91 98251 12345 (Mr. Nitin Shah - F/O Diya Shah)',
    recipient_name: 'Mr. Nitin Shah',
    mobile_number: '+91 98251 12345',
    subject: 'Unit Test 2 Syllabus & Schedule',
    message_body: 'Dear Parent, Unit Test 2 for Science is scheduled on 08-Nov-2026 for Diya Shah. Chapters: Light, Electricity. Study materials uploaded on Scholar LMS.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T06:10:00.000Z',
    created_at: '2026-10-31T06:09:00.000Z',
    is_sample: 1,
  },
];

export function TeachLearnDeliveryLog() {
  const [dispatches, setDispatches] = useState<StoredDispatchRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRow, setSelectedRow] = useState<StoredDispatchRow | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadData = () => {
    const stored = getStoredDispatches('teach-learn');
    const combined = [...stored];
    const existingIds = new Set(stored.map((s) => s.id));
    for (const item of SEEDED_SAMPLE_DISPATCHES) {
      if (!existingIds.has(item.id)) {
        combined.push(item);
      }
    }
    setDispatches(combined);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener(DISPATCH_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DISPATCH_UPDATED_EVENT, handleUpdate);
  }, []);

  const handleCopyPhone = (text: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Mobile Number Copied', `${text} copied to clipboard.`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      const { phone, name } = extractPhoneAndName(d.recipient);
      const matchesSearch =
        !searchQuery ||
        (phone && phone.includes(searchQuery)) ||
        (d.mobile_number && d.mobile_number.includes(searchQuery)) ||
        (name && name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.recipient_name && d.recipient_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.subject && d.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.message_body && d.message_body.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesChannel =
        selectedChannel === 'all' || d.channel.toLowerCase() === selectedChannel.toLowerCase();
      const matchesStatus =
        selectedStatus === 'all' || d.status.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [dispatches, searchQuery, selectedChannel, selectedStatus]);

  const metrics = useMemo(() => {
    const total = dispatches.length;
    const delivered = dispatches.filter((d) => d.status === 'sent').length;
    const queued = dispatches.filter((d) => d.status === 'queued').length;
    const failed = dispatches.filter((d) => d.status === 'failed').length;
    return { total, delivered, queued, failed };
  }, [dispatches]);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Dispatches</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.total}</p>
            <p className="mt-1 text-xs text-slate-400">All academic notices sent</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-emerald-50/40 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Delivered</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{metrics.delivered}</p>
            <p className="mt-1 text-xs text-emerald-600">Successfully received</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Queued</p>
            <p className="mt-2 text-2xl font-bold text-slate-700">{metrics.queued}</p>
            <p className="mt-1 text-xs text-slate-400">Scheduled for delivery</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Delivery Issues</p>
            <p className="mt-2 text-2xl font-bold text-rose-600">{metrics.failed}</p>
            <p className="mt-1 text-xs text-rose-500">Gateway errors / retry</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Mobile number, Name, Subject, or Homework topic..."
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
          >
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS Gateway</option>
            <option value="email">Email</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
          >
            <option value="all">All Statuses</option>
            <option value="sent">Delivered (Sent)</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="flex items-center gap-1.5 text-xs text-slate-600"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Dispatched</th>
                <th className="px-4 py-3.5">Mobile Number</th>
                <th className="px-4 py-3.5">Recipient / Guardian</th>
                <th className="px-4 py-3.5">Channel</th>
                <th className="px-4 py-3.5">Event / Reason</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No matching academic dispatches found. Try adjusting filters or search query.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((row) => {
                  const { phone, name } = extractPhoneAndName(row.recipient);
                  const displayPhone = row.mobile_number || phone;
                  const displayName = row.recipient_name || name;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRow(row)}
                      className="cursor-pointer transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-700">
                        {formatDateTime(row.sent_at || row.created_at)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <Phone className="h-3 w-3 text-emerald-600" />
                          <span className="font-mono tracking-tight">{displayPhone}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyPhone(displayPhone || '', row.id, e)}
                            title="Copy mobile number"
                            className="ml-0.5 rounded p-0.5 text-emerald-600 transition hover:bg-emerald-200 hover:text-emerald-900"
                          >
                            {copiedId === row.id ? (
                              <Check className="h-3 w-3 text-emerald-700" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="max-w-[200px]">
                          <p className="truncate font-semibold text-slate-900">{displayName}</p>
                          <p className="truncate text-[11px] text-slate-400">{row.subject}</p>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        {row.channel === 'whatsapp' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-emerald-700">
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                          </span>
                        ) : row.channel === 'sms' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-indigo-700">
                            <MessageSquareText className="h-3.5 w-3.5" />
                            <span>SMS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-blue-700">
                            <Mail className="h-3.5 w-3.5" />
                            <span>Email</span>
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-500">
                        {row.event_key}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        {row.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>sent</span>
                          </span>
                        ) : row.status === 'failed' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
                              <XCircle className="h-3 w-3" />
                              <span>failed</span>
                            </span>
                            {row.last_error && (
                              <p className="mt-0.5 max-w-[150px] truncate text-[10px] text-rose-600">
                                {row.last_error}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            <Clock className="h-3 w-3" />
                            <span>queued</span>
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#5846EA] hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Teach/Learn Dispatch Details</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                  selectedRow.status === 'sent'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedRow.status === 'failed'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {selectedRow.status}
              </span>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Mobile Number
                    </p>
                    <p className="mt-0.5 font-mono text-base font-bold text-emerald-950">
                      {selectedRow.mobile_number || extractPhoneAndName(selectedRow.recipient).phone}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) =>
                      handleCopyPhone(
                        selectedRow.mobile_number || extractPhoneAndName(selectedRow.recipient).phone || '',
                        selectedRow.id,
                        e
                      )
                    }
                    className="flex items-center gap-1.5 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </Button>
                </div>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Recipient / Name:</span>
                <span className="font-semibold text-slate-800">
                  {selectedRow.recipient_name || extractPhoneAndName(selectedRow.recipient).name}
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Event Trigger:</span>
                <span className="font-mono text-slate-800">{selectedRow.event_key}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Channel:</span>
                <span className="font-bold uppercase text-slate-800">{selectedRow.channel}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Queued Time:</span>
                <span className="text-slate-800">{formatDateTime(selectedRow.created_at)}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Delivered Time:</span>
                <span className="font-semibold text-emerald-700">
                  {formatDateTime(selectedRow.sent_at || selectedRow.created_at)}
                </span>
              </div>

              <div>
                <span className="text-slate-500">Subject / Header:</span>
                <p className="mt-1 font-semibold text-slate-800">{selectedRow.subject}</p>
              </div>

              <div>
                <span className="text-slate-500">Message Content:</span>
                <div className="mt-1 rounded-xl bg-slate-50 p-3 text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100">
                  {selectedRow.message_body}
                </div>
              </div>

              {selectedRow.last_error && (
                <div>
                  <span className="font-bold text-rose-600">Gateway Error:</span>
                  <div className="mt-1 rounded-xl bg-rose-50 p-3 text-rose-700 font-mono text-[11px] border border-rose-200">
                    {selectedRow.last_error}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRow(null)}
                className="px-5 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

