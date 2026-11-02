'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
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
  Smartphone,
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
    id: 801,
    module: 'timetable',
    event_key: 'timetable.schedule_published',
    channel: 'whatsapp',
    recipient: '+91 98250 12345 (Ramesh Sharma - Faculty / Mathematics)',
    recipient_name: 'Ramesh Sharma',
    mobile_number: '+91 98250 12345',
    subject: 'New Class Timetable Published & Active',
    message_body: 'Dear Ramesh Sharma, the updated weekly timetable for Class 10-A has been published and is now active. Please check the timetable portal for period timings and room assignments.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T06:30:00.000Z',
    created_at: '2026-10-31T06:29:00.000Z',
    is_sample: 1,
  },
  {
    id: 802,
    module: 'timetable',
    event_key: 'timetable.proxy_duty_assigned',
    channel: 'sms',
    recipient: '+91 98251 12345 (Sunita Verma - Faculty / Science)',
    recipient_name: 'Sunita Verma',
    mobile_number: '+91 98251 12345',
    subject: 'Proxy Class Duty Assignment Alert',
    message_body: 'Dear Sunita Verma, you have been assigned proxy teaching duty for Class 9-B during Period 3 today in Room 204. Please report on time.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T07:15:00.000Z',
    created_at: '2026-10-31T07:14:00.000Z',
    is_sample: 1,
  },
  {
    id: 803,
    module: 'timetable',
    event_key: 'timetable.bell_timings_revised',
    channel: 'whatsapp',
    recipient: '+91 98795 67890 (Kavita Dave - Class Teacher / Grade 10-A)',
    recipient_name: 'Kavita Dave',
    mobile_number: '+91 98795 67890',
    subject: 'Revised School Bell Timings Notice',
    message_body: 'Dear Faculty & Parents, please note that school timetable period timings have been revised effective tomorrow. Morning assembly begins at 07:45 AM followed by Period 1 at 08:15 AM.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T08:00:00.000Z',
    created_at: '2026-10-31T07:58:00.000Z',
    is_sample: 1,
  },
  {
    id: 804,
    module: 'timetable',
    event_key: 'timetable.remedial_classes',
    channel: 'sms',
    recipient: '+91 97243 54321 (Anil Joshi - Faculty / English)',
    recipient_name: 'Anil Joshi',
    mobile_number: '+91 97243 54321',
    subject: 'Remedial / Extra Class Timetable Scheduled',
    message_body: 'Dear Anil Joshi, special remedial coaching classes for Grade 10 have been scheduled on Saturday from 08:30 AM to 11:30 AM. Attendance is mandatory.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-10-31T08:45:00.000Z',
    created_at: '2026-10-31T08:43:00.000Z',
    is_sample: 1,
  },
];

export function TimetableDeliveryLog() {
  const [dispatches, setDispatches] = useState<StoredDispatchRow[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalItem, setActiveModalItem] = useState<StoredDispatchRow | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadData = () => {
    const stored = getStoredDispatches().filter((d) => d.module === 'timetable');
    const existingIds = new Set(stored.map((s) => s.id));
    const merged = [...stored, ...SEEDED_SAMPLE_DISPATCHES.filter((s) => !existingIds.has(s.id))];
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setDispatches(merged);
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

  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      if (selectedChannel !== 'all' && d.channel.toLowerCase() !== selectedChannel.toLowerCase()) {
        return false;
      }
      if (selectedStatus !== 'all' && d.status.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.recipient_name?.toLowerCase().includes(q);
        const matchesRec = d.recipient?.toLowerCase().includes(q);
        const matchesPhone = d.mobile_number?.toLowerCase().includes(q);
        const matchesSubj = d.subject?.toLowerCase().includes(q);
        const matchesBody = d.message_body?.toLowerCase().includes(q);
        if (!matchesName && !matchesRec && !matchesPhone && !matchesSubj && !matchesBody) {
          return false;
        }
      }
      return true;
    });
  }, [dispatches, selectedChannel, selectedStatus, searchQuery]);

  const handleCopy = (text: string, id: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied', `${text} copied to clipboard.`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getChannelBadge = (ch: string) => {
    switch (ch.toLowerCase()) {
      case 'whatsapp':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </span>
        );
      case 'sms':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
            <MessageSquareText className="h-3 w-3" />
            SMS
          </span>
        );
      case 'email':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <Mail className="h-3 w-3" />
            Email
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {ch}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3 w-3" />
            Sent
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            <Clock className="h-3 w-3" />
            Queued
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by faculty, phone, or notice subject..."
            className="pl-9 bg-white text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel Filter */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS Gateway</option>
            <option value="email">Email</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            className="h-9 border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Dispatches Table Card */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Recipient & Mobile</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Subject & Notice</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No timetable communication dispatches match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredDispatches.map((item) => {
                    const parsed = extractPhoneAndName(item.recipient);
                    const displayPhone = item.mobile_number || parsed.phone || '—';
                    const displayName = item.recipient_name || parsed.name || 'Recipient';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{displayName}</div>
                          <div className="flex items-center gap-1.5 text-slate-500 mt-0.5 font-mono">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{displayPhone}</span>
                            {displayPhone !== '—' && (
                              <button
                                type="button"
                                onClick={() => handleCopy(displayPhone, item.id)}
                                className="text-slate-400 hover:text-indigo-600 transition"
                                title="Copy mobile number"
                              >
                                {copiedId === item.id ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">{getChannelBadge(item.channel)}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium text-slate-800 truncate">
                            {item.subject || 'Timetable Schedule Notice'}
                          </div>
                          <div className="text-slate-500 truncate mt-0.5">
                            {item.message_body || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {item.sent_at
                            ? new Date(item.sent_at).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setActiveModalItem(item)}
                            className="h-7 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal Dialog */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Timetable Dispatch Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit record #{activeModalItem.id}
                </p>
              </div>
              <div>{getStatusBadge(activeModalItem.status)}</div>
            </div>

            {/* Recipient Phone Banner */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Mobile Number
                </span>
                <p className="text-base font-bold font-mono text-emerald-950 mt-0.5">
                  {activeModalItem.mobile_number ||
                    extractPhoneAndName(activeModalItem.recipient).phone ||
                    '—'}
                </p>
              </div>
              {activeModalItem.mobile_number && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleCopy(activeModalItem.mobile_number!, activeModalItem.id)
                  }
                  className="h-8 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              )}
            </div>

            {/* Metadata Rows */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Recipient / Name:</span>
                <span className="font-semibold text-slate-800">
                  {activeModalItem.recipient_name ||
                    extractPhoneAndName(activeModalItem.recipient).name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Event Trigger:</span>
                <span className="font-mono text-slate-700">
                  {activeModalItem.event_key}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Channel:</span>
                <span className="font-semibold text-slate-800 uppercase">
                  {activeModalItem.channel}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Queued Time:</span>
                <span className="text-slate-700">
                  {new Date(activeModalItem.created_at).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Delivered Time:</span>
                <span className="font-semibold text-emerald-700">
                  {activeModalItem.sent_at
                    ? new Date(activeModalItem.sent_at).toLocaleString('en-IN')
                    : 'Pending'}
                </span>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Subject / Header:
              </span>
              <p className="text-xs font-semibold text-slate-800">
                {activeModalItem.subject || '(No Subject)'}
              </p>

              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mt-3 mb-1">
                Message Content:
              </span>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap">
                {activeModalItem.message_body || '(Empty)'}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveModalItem(null)}
                className="h-8"
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
