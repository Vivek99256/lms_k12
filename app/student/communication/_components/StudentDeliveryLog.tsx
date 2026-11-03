'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  X,
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
  normalizePhoneNumber,
  type StoredDispatchRow,
} from '@/lib/communication/dispatch-store';

const SEEDED_SAMPLE_DISPATCHES: StoredDispatchRow[] = [
  {
    id: 101,
    module: 'student',
    event_key: 'student.ptm_reminder',
    channel: 'whatsapp',
    recipient: '+91 98250 12345 (Rajesh Patel - F/O Aarav Patel, Gr 10-A)',
    recipient_name: 'Rajesh Patel',
    mobile_number: '+91 98250 12345',
    subject: 'Parent-Teacher Meeting Invitation',
    message_body: 'Dear Rajesh Patel, you are cordially invited to attend the Parent-Teacher Meeting for Aarav Patel (Grade 10-A) on 05-Nov-2026.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T06:50:00.000Z',
    created_at: '2026-10-31T06:49:00.000Z',
    is_sample: 1,
  },
  {
    id: 102,
    module: 'student',
    event_key: 'student.report_card',
    channel: 'sms',
    recipient: '+91 98251 11223 (Mr. Manoj Sharma - F/O Rohan Sharma, Gr 10-A)',
    recipient_name: 'Mr. Manoj Sharma',
    mobile_number: '+91 98251 11223',
    subject: 'Term Examination Report Card Published',
    message_body: 'Dear Parent, Term Progress Report for Rohan Sharma (Grade 10-A, Roll 08) is now published on the Parent Portal.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T06:15:00.000Z',
    created_at: '2026-10-31T06:14:00.000Z',
    is_sample: 1,
  },
  {
    id: 103,
    module: 'student',
    event_key: 'student.discipline_advisory',
    channel: 'sms',
    recipient: '+91 97123 44556 (Mrs. Hema Joshi - M/O Tanvi Joshi, Gr 8-B)',
    recipient_name: 'Mrs. Hema Joshi',
    mobile_number: '+91 97123 44556',
    subject: 'Student Uniform & Conduct Advisory',
    message_body: 'Dear Guardian, Tanvi Joshi was observed without proper school uniform today. Kindly ensure proper attire.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T05:30:00.000Z',
    created_at: '2026-10-31T05:29:00.000Z',
    is_sample: 1,
  },
];

export function StudentDeliveryLog() {
  const [liveDispatches, setLiveDispatches] = useState<StoredDispatchRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedRow, setSelectedRow] = useState<StoredDispatchRow | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const loadData = () => {
    const stored = getStoredDispatches('student');
    setLiveDispatches(stored);
  };

  useEffect(() => {
    loadData();

    const handleSync = () => {
      loadData();
    };

    window.addEventListener(DISPATCH_UPDATED_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(DISPATCH_UPDATED_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const allRows = useMemo(() => {
    const combined = [...liveDispatches, ...SEEDED_SAMPLE_DISPATCHES];
    const seen = new Set<string>();
    return combined.filter((row) => {
      const key = `${row.module}-${row.channel}-${row.recipient}-${row.created_at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [liveDispatches]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (channelFilter && row.channel.toLowerCase() !== channelFilter.toLowerCase()) return false;
      if (statusFilter && row.status.toLowerCase() !== statusFilter.toLowerCase()) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const extracted = extractPhoneAndName(row.recipient);
        const phone = (row.mobile_number || extracted.phone || '').toLowerCase();
        const recipient = (row.recipient || '').toLowerCase();
        const name = (row.recipient_name || extracted.name || '').toLowerCase();
        const event = (row.event_key || '').toLowerCase();
        const body = (row.message_body || '').toLowerCase();

        return (
          phone.includes(q) ||
          recipient.includes(q) ||
          name.includes(q) ||
          event.includes(q) ||
          body.includes(q)
        );
      }

      return true;
    });
  }, [allRows, channelFilter, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    const total = allRows.length;
    const sent = allRows.filter((r) => r.status === 'sent').length;
    const queued = allRows.filter((r) => r.status === 'queued').length;
    const failed = allRows.filter((r) => r.status === 'failed').length;
    return { total, sent, queued, failed };
  }, [allRows]);

  const copyPhoneNumber = (phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    toast.success('Mobile number copied', phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const formatWhen = (iso: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-[#D9E3F1] shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Dispatches
            </span>
            <p className="mt-1 text-2xl font-black text-slate-800">{metrics.total}</p>
            <p className="mt-1 text-[10px] text-slate-400">All student notices recorded</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Delivered
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-700">{metrics.sent}</p>
            <p className="mt-1 text-[10px] text-emerald-600 font-medium">Delivered to devices</p>
          </CardContent>
        </Card>

        <Card className="border-[#D9E3F1] shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Queued
            </span>
            <p className="mt-1 text-2xl font-black text-slate-800">{metrics.queued}</p>
            <p className="mt-1 text-[10px] text-slate-400">Scheduled for gateway</p>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/30 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-800">
              Delivery Issues
            </span>
            <p className="mt-1 text-2xl font-black text-rose-700">{metrics.failed}</p>
            <p className="mt-1 text-[10px] text-rose-600 font-medium">Gateway errors / retry</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#D9E3F1] bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by Mobile number, Name, or Event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs border-[#D9E3F1]"
            />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="h-9 rounded-xl border border-[#D9E3F1] bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#5846EA]"
          >
            <option value="">All Channels</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="portal">Student Portal</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-[#D9E3F1] bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#5846EA]"
          >
            <option value="">All Statuses</option>
            <option value="sent">Sent / Delivered</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="h-9 gap-1.5 text-xs border-[#D9E3F1] text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          Refresh
        </Button>
      </div>

      {/* Dispatches Table */}
      <Card className="border-[#D9E3F1] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-[#F8FAFC] border-b border-[#D9E3F1] text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Dispatched</th>
                <th className="px-4 py-3">Mobile Number</th>
                <th className="px-4 py-3">Recipient / Guardian</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Event / Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No dispatches found matching your search.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const parsed = extractPhoneAndName(row.recipient);
                  const displayPhone = row.mobile_number || parsed.phone;
                  const displayName = row.recipient_name || parsed.name;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition">
                      {/* 1. Time */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatWhen(row.created_at)}
                      </td>

                      {/* 2. Mobile Number (Dedicated Column) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {displayPhone ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 font-mono text-xs font-bold text-emerald-800">
                            <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                            <span>{displayPhone}</span>
                            <button
                              type="button"
                              onClick={() => copyPhoneNumber(displayPhone)}
                              className="ml-1 text-emerald-600 hover:text-emerald-950"
                              title="Copy phone number"
                            >
                              {copiedPhone === displayPhone ? (
                                <Check className="h-3 w-3 text-emerald-700" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-60 hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* 3. Recipient */}
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{displayName}</p>
                        {row.subject && (
                          <p className="text-[11px] text-slate-500 truncate max-w-xs">{row.subject}</p>
                        )}
                      </td>

                      {/* 4. Channel */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {row.channel === 'sms' ? (
                            <MessageSquareText className="h-3 w-3 text-blue-600" />
                          ) : row.channel === 'whatsapp' ? (
                            <MessageCircle className="h-3 w-3 text-emerald-600" />
                          ) : row.channel === 'email' ? (
                            <Mail className="h-3 w-3 text-indigo-600" />
                          ) : (
                            <Calendar className="h-3 w-3 text-purple-600" />
                          )}
                          {row.channel.toUpperCase()}
                        </span>
                      </td>

                      {/* 5. Event */}
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                        {row.event_key}
                      </td>

                      {/* 6. Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            sent
                          </span>
                        ) : row.status === 'failed' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                              <XCircle className="h-3 w-3 text-rose-600" />
                              failed
                            </span>
                            {row.last_error && (
                              <p className="text-[10px] text-rose-600 font-mono mt-0.5 truncate max-w-[140px]" title={row.last_error}>
                                {row.last_error}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                            <Clock className="h-3 w-3 text-blue-600" />
                            queued
                          </span>
                        )}
                      </td>

                      {/* 7. Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRow(row)}
                          className="h-7 text-xs text-slate-600 hover:text-slate-900"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-[#D9E3F1] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Student Dispatch Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">Reference ID: #{selectedRow.id}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRow(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              {/* Highlighted Mobile Number Banner */}
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                      Target Mobile Number
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {selectedRow.mobile_number || extractPhoneAndName(selectedRow.recipient).phone || 'N/A'}
                    </span>
                  </div>
                </div>
                {(selectedRow.mobile_number || extractPhoneAndName(selectedRow.recipient).phone) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyPhoneNumber(
                        selectedRow.mobile_number || extractPhoneAndName(selectedRow.recipient).phone || '',
                      )
                    }
                    className="h-8 gap-1.5 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                )}
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Recipient / Name:</span>
                <span className="font-medium text-slate-900 text-right">
                  {selectedRow.recipient_name || extractPhoneAndName(selectedRow.recipient).name}
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Event Trigger:</span>
                <span className="font-mono text-slate-800">{selectedRow.event_key}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Channel:</span>
                <span className="uppercase font-semibold text-slate-700">{selectedRow.channel}</span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Queued Time:</span>
                <span className="text-slate-700">{formatWhen(selectedRow.created_at)}</span>
              </div>

              {selectedRow.sent_at && (
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-semibold text-slate-500">Delivered Time:</span>
                  <span className="text-emerald-700 font-medium">{formatWhen(selectedRow.sent_at)}</span>
                </div>
              )}

              {selectedRow.subject && (
                <div className="border-b border-slate-100 pb-2">
                  <span className="font-semibold text-slate-500">Subject / Header:</span>
                  <p className="mt-1 font-medium text-slate-800">{selectedRow.subject}</p>
                </div>
              )}

              {selectedRow.message_body && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="font-bold text-slate-700 block mb-1">Message Content:</span>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedRow.message_body}</p>
                </div>
              )}

              {selectedRow.last_error && (
                <div className="rounded-xl bg-rose-50 p-2.5 text-rose-800">
                  <span className="font-bold">Error Report:</span>
                  <p className="mt-0.5 text-[11px] font-mono">{selectedRow.last_error}</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRow(null)}
                className="h-8 text-xs"
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

