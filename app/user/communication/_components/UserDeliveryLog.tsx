'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  History,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/result/toast';
import {
  fetchNotificationLog,
  type NotificationLogRow,
} from '@/lib/platform/client';
import { formatWhen, Pill } from '@/app/platform-services/_components/shell';
import {
  DISPATCH_UPDATED_EVENT,
  extractPhoneAndName,
  getStoredDispatches,
  type StoredDispatchRow,
} from '@/lib/communication/dispatch-store';

const PER_PAGE = 25;
const TONE = { queued: 'gray', sent: 'green', failed: 'red', skipped: 'amber' } as const;

// Sample fallback records for staff & user communications
const SAMPLE_STAFF_DELIVERY_ROWS: StoredDispatchRow[] = [
  {
    id: 301,
    module: 'user',
    event_key: 'user.icard.ready',
    channel: 'sms',
    recipient: '+91 98250 12345 (Dr. Rajesh Mehta - HOD Science)',
    recipient_name: 'Dr. Rajesh Mehta - HOD Science',
    mobile_number: '+91 98250 12345',
    subject: 'Staff Identity Card Ready',
    message_body: 'Dear Dr. Rajesh Mehta, your new staff identity card for academic session 2026-27 is ready. Please collect it from Admin Office.',
    status: 'sent',
    attempts: 1,
    sent_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    last_error: null,
    is_sample: 0,
  },
  {
    id: 302,
    module: 'user',
    event_key: 'user.meeting.circular',
    channel: 'whatsapp',
    recipient: '+91 98790 67890 (Priya Sharma - Mathematics)',
    recipient_name: 'Priya Sharma - Mathematics',
    mobile_number: '+91 98790 67890',
    subject: 'Staff Council Meeting Notice',
    message_body: 'Dear Faculty Member, an urgent staff council meeting is scheduled for 03:30 PM today in the Conference Hall.',
    status: 'sent',
    attempts: 1,
    sent_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    last_error: null,
    is_sample: 0,
  },
  {
    id: 303,
    module: 'user',
    event_key: 'user.profile.kyc_pending',
    channel: 'email',
    recipient: 'vikram.singh@school.edu.in (Vikram Singh - Sports)',
    recipient_name: 'Vikram Singh - Sports',
    mobile_number: '+91 97120 44556',
    subject: 'HR Advisory: Mandatory Document Submission Pending',
    message_body: 'Dear Vikram Singh, our HR database indicates that your updated address verification and degree certificates remain unverified. Kindly upload by Friday.',
    status: 'sent',
    attempts: 1,
    sent_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    last_error: null,
    is_sample: 0,
  },
  {
    id: 304,
    module: 'user',
    event_key: 'user.onboarding.welcome',
    channel: 'portal',
    recipient: 'New Faculty Joinees (All Departments)',
    recipient_name: 'New Faculty Joinees',
    mobile_number: null,
    subject: 'Welcome to Scholar Suite ERP Portal',
    message_body: 'Welcome aboard! Your employee portal and attendance register access credentials have been provisioned.',
    status: 'sent',
    attempts: 1,
    sent_at: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    last_error: null,
    is_sample: 0,
  },
  {
    id: 305,
    module: 'user',
    event_key: 'user.payroll.slip_issued',
    channel: 'sms',
    recipient: '+91 99099 77889 (Anjali Dave - Primary Section)',
    recipient_name: 'Anjali Dave - Primary Section',
    mobile_number: '+91 99099 77889',
    subject: 'Monthly Salary Credit Advisory',
    message_body: 'Your salary for Oct-2026 has been credited. Payslip is accessible in ERP self-service portal.',
    status: 'failed',
    attempts: 2,
    sent_at: null,
    created_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    last_error: 'SMS carrier queue congestion. Auto-retry pending.',
    is_sample: 0,
  },
];

export function UserDeliveryLog() {
  const [remoteRows, setRemoteRows] = useState<NotificationLogRow[] | null>(null);
  const [liveDispatches, setLiveDispatches] = useState<StoredDispatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRow, setSelectedRow] = useState<StoredDispatchRow | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const refreshLiveDispatches = useCallback(() => {
    const listUser = getStoredDispatches('user');
    const listHr = getStoredDispatches('hr');
    const combined = [...listUser, ...listHr];
    setLiveDispatches(combined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    refreshLiveDispatches();
    try {
      const result = await fetchNotificationLog({
        event_prefix: 'hr.',
        per_page: PER_PAGE,
      });
      if (result && result.rows && result.rows.length > 0) {
        setRemoteRows(result.rows);
      } else {
        setRemoteRows(null);
      }
    } catch {
      setRemoteRows(null);
    } finally {
      setLoading(false);
    }
  }, [refreshLiveDispatches]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handleSync = () => {
      refreshLiveDispatches();
    };
    window.addEventListener(DISPATCH_UPDATED_EVENT, handleSync);
    return () => {
      window.removeEventListener(DISPATCH_UPDATED_EVENT, handleSync);
    };
  }, [refreshLiveDispatches]);

  const allRows: StoredDispatchRow[] = useMemo(() => {
    const baseRows: StoredDispatchRow[] =
      remoteRows && remoteRows.length > 0
        ? remoteRows.map((r) => {
            const parsed = extractPhoneAndName(r.recipient);
            return {
              id: r.id,
              module: 'user',
              event_key: r.event_key,
              channel: r.channel,
              recipient: r.recipient,
              recipient_name: parsed.name,
              mobile_number: parsed.phone,
              subject: r.subject,
              message_body: null,
              status: r.status,
              attempts: r.attempts,
              last_error: r.last_error,
              sent_at: r.sent_at,
              created_at: r.created_at,
              is_sample: r.is_sample,
            };
          })
        : SAMPLE_STAFF_DELIVERY_ROWS;

    const liveIds = new Set(liveDispatches.map((d) => d.id));
    const dedupedBase = baseRows.filter((r) => !liveIds.has(r.id));
    return [...liveDispatches, ...dedupedBase];
  }, [liveDispatches, remoteRows]);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (channelFilter && r.channel !== channelFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const phoneMatch = r.mobile_number?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ?? false;
        return (
          phoneMatch ||
          r.recipient.toLowerCase().includes(q) ||
          r.recipient_name.toLowerCase().includes(q) ||
          (r.mobile_number && r.mobile_number.toLowerCase().includes(q)) ||
          r.event_key.toLowerCase().includes(q) ||
          (r.subject && r.subject.toLowerCase().includes(q)) ||
          (r.message_body && r.message_body.toLowerCase().includes(q))
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

  const copyPhoneNumber = (phone: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    toast.success('Mobile number copied', phone);
    setTimeout(() => {
      setCopiedPhone(null);
    }, 2000);
  };

  return (
    <div className="space-y-4">
      {/* Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-[#D9E3F1] shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Dispatches
            </span>
            <p className="mt-1 text-2xl font-black text-slate-800">{metrics.total}</p>
            <p className="mt-1 text-[10px] text-slate-400">All staff & user notices</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Delivered
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-700">{metrics.sent}</p>
            <p className="mt-1 text-[10px] text-emerald-600 font-medium">Delivered to staff members</p>
          </CardContent>
        </Card>

        <Card className="border-[#D9E3F1] shadow-sm">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Queued
            </span>
            <p className="mt-1 text-2xl font-black text-slate-800">{metrics.queued}</p>
            <p className="mt-1 text-[10px] text-slate-400">Scheduled for delivery</p>
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
              placeholder="Search by Mobile number, Staff, or Event..."
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
            <option value="portal">Staff Portal</option>
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-9 gap-1.5 border-[#D9E3F1] text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#5846EA]' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden border border-[#D9E3F1] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Dispatched</th>
                <th className="px-4 py-3">Mobile Number</th>
                <th className="px-4 py-3">Staff Member / Recipient</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Notification Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                    No staff communication records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const phone = row.mobile_number || extractPhoneAndName(row.recipient).phone;
                  const isCopied = copiedPhone === phone;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRow(row)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 font-mono">
                        {formatWhen(row.created_at)}
                      </td>

                      {/* Mobile Number Column */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {phone ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-900 shadow-2xs">
                            <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span>{phone}</span>
                            <button
                              type="button"
                              onClick={(e) => copyPhoneNumber(phone, e)}
                              title="Copy mobile number"
                              className="ml-1 text-emerald-600 hover:text-emerald-800 p-0.5 rounded transition"
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-700" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No mobile</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-semibold text-xs text-slate-800 block">
                          {row.recipient_name || extractPhoneAndName(row.recipient).name}
                        </span>
                        {row.subject && (
                          <p className="mt-0.5 text-[11px] text-slate-500 truncate max-w-xs">{row.subject}</p>
                        )}
                      </td>

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

                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-slate-700 block truncate max-w-[180px]">
                          {row.event_key}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <Pill tone={TONE[row.status]}>{row.status}</Pill>
                        {row.last_error && (
                          <p className="mt-1 max-w-xs truncate text-[11px] text-rose-500" title={row.last_error}>
                            {row.last_error}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRow(row);
                          }}
                          className="h-8 gap-1 text-xs text-slate-600 hover:text-[#5846EA]"
                        >
                          <Eye className="h-3.5 w-3.5" />
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
              <h3 className="text-base font-bold text-slate-900">Staff Dispatch Details</h3>
              <Pill tone={TONE[selectedRow.status]}>{selectedRow.status}</Pill>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              {/* Mobile Number Box */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Mobile Number
                  </span>
                  <p className="mt-1 text-sm font-mono font-bold text-emerald-950">
                    {selectedRow.mobile_number || extractPhoneAndName(selectedRow.recipient).phone || 'Not available'}
                  </p>
                </div>
                {(selectedRow.mobile_number || extractPhoneAndName(selectedRow.recipient).phone) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
                <span className="font-semibold text-slate-500">Recipient / Staff Member:</span>
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
                className="h-8 text-xs font-semibold"
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
