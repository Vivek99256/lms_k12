'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Loader2,
  Mail,
  MessageSquareText,
  Paperclip,
  Search,
  Send,
  X,
} from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { asRecord, cellValue, getJson, records } from '@/app/easy_com/_lib/api';
import type { JsonRecord } from '@/app/easy_com/_lib/types';

/*
 * One accent (the app's indigo #5846EA), slate neutrals and the app's own card border
 * (#D9E3F1). SMS and email are told apart by icon and label, not by colour.
 */

type Channel = 'sms' | 'email';
type Range = 'all' | 'today' | '7d' | '30d';

type SentMessage = {
  key: string;
  channel: Channel;
  recipient: string;
  gr: string;
  contact: string;
  subject: string;
  body: string;
  attachment: string;
  sentBy: string;
  sentOn: string;
  sentTime: number;
};

const SIZES = [10, 25, 50];
const RANGES: Array<{ id: Range; label: string }> = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
];

function toTime(value: string) {
  const parsed = new Date(value.replace(' ', 'T')).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(time: number) {
  return time
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(time))
    : '-';
}

function formatClock(time: number) {
  return time ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(time)) : '';
}

function formatFull(time: number) {
  return time ? `${formatDate(time)}, ${formatClock(time)}` : '-';
}

function initials(name: string) {
  const parts = name.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '#';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** "SENT SMS PARENT" -> "Sent SMS Parent". */
function humanize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bSms\b/g, 'SMS')
    .trim();
}

function fromSms(row: JsonRecord): SentMessage {
  const sentOn = cellValue(row, 'sent_on');
  return {
    key: `sms-${cellValue(row, 'id')}`,
    channel: 'sms',
    recipient: cellValue(row, 'name') || cellValue(row, 'sms_no') || 'Unknown recipient',
    gr: cellValue(row, 'enrollment_no'),
    contact: cellValue(row, 'sms_no'),
    subject: '',
    body: cellValue(row, 'sms_text'),
    attachment: '',
    sentBy: humanize(cellValue(row, 'module_name')),
    sentOn,
    sentTime: toTime(sentOn),
  };
}

function fromEmail(row: JsonRecord): SentMessage {
  const sentOn = cellValue(row, 'sent_on');
  return {
    key: `email-${cellValue(row, 'id')}`,
    channel: 'email',
    recipient: cellValue(row, 'email') || 'Unknown recipient',
    gr: '',
    contact: cellValue(row, 'email'),
    subject: cellValue(row, 'subject'),
    body: cellValue(row, 'email_text'),
    attachment: cellValue(row, 'attachment_name'),
    sentBy: cellValue(row, 'user_name'),
    sentOn,
    sentTime: toTime(sentOn),
  };
}

/** Single line, for table snippets. */
function plain(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keeps paragraph breaks, for the drawer. */
function multiline(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function rangeStart(range: Range) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === 'today') return today;
  if (range === '7d') return today - 6 * 86_400_000;
  if (range === '30d') return today - 29 * 86_400_000;
  return 0;
}

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  return channel === 'email' ? <Mail className={className} /> : <MessageSquareText className={className} />;
}

function Avatar({ name, size }: { name: string; size: 'sm' | 'lg' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#EEF0FF] font-semibold text-[#5846EA] ${
        size === 'lg' ? 'h-14 w-14 text-base' : 'h-9 w-9 text-[11px]'
      }`}
    >
      {initials(name)}
    </span>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#D9E3F1] bg-white px-5 py-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5846EA]">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold leading-none tracking-tight tabular-nums text-slate-950">{value}</p>
        <p className="mt-1.5 text-xs font-medium text-[#5F7087]">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px] text-[#8A98AD]">{hint}</p> : null}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-[#8A98AD]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function SentMessagesFeed() {
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [channel, setChannel] = useState<'all' | Channel>('all');
  const [range, setRange] = useState<Range>('all');
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [sms, email] = await Promise.allSettled([getJson('reports/sms'), getJson('reports/email')]);
      if (!active) return;

      const rows: SentMessage[] = [];
      const failed: string[] = [];

      if (sms.status === 'fulfilled') rows.push(...records(asRecord(sms.value).data).map(fromSms));
      else failed.push('SMS');

      if (email.status === 'fulfilled') rows.push(...records(asRecord(email.value).data).map(fromEmail));
      else failed.push('emails');

      setMessages(rows);
      setNotice(failed.length ? `Couldn't load sent ${failed.join(' and ')}. Showing the rest.` : '');
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const sms = messages.filter((message) => message.channel === 'sms').length;
    return { sms, email: messages.length - sms };
  }, [messages]);

  const latestTime = useMemo(() => messages.reduce((best, message) => Math.max(best, message.sentTime), 0), [messages]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const from = rangeStart(range);
    const filtered = messages.filter((message) => {
      if (channel !== 'all' && message.channel !== channel) return false;
      if (from && message.sentTime < from) return false;
      if (!needle) return true;
      return [message.recipient, message.gr, message.contact, message.subject, message.body, message.sentBy]
        .some((value) => plain(value).toLowerCase().includes(needle));
    });
    return filtered.sort((left, right) => (newestFirst ? right.sentTime - left.sentTime : left.sentTime - right.sentTime));
  }, [channel, messages, newestFirst, query, range]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const rows = visible.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const openIndex = openKey ? visible.findIndex((message) => message.key === openKey) : -1;
  const opened = openIndex >= 0 ? visible[openIndex] : null;

  useEffect(() => {
    if (!opened) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenKey(null);
      else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        const next = visible[openIndex + 1];
        if (next) setOpenKey(next.key);
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        const previous = visible[openIndex - 1];
        if (previous) setOpenKey(previous.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened, openIndex, visible]);

  function exportCsv() {
    const header = ['Channel', 'Recipient', 'GR no.', 'Contact', 'Subject', 'Message', 'Sent on', 'Source / sent by'];
    const lines = visible.map((message) =>
      [
        message.channel === 'email' ? 'Email' : 'SMS',
        message.recipient,
        message.gr,
        message.contact,
        message.subject,
        plain(message.body),
        formatFull(message.sentTime),
        message.sentBy,
      ]
        .map(csvCell)
        .join(',')
    );
    // BOM so Excel reads the UTF-8 text correctly.
    const blob = new Blob([`﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sent-messages-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[#D9E3F1] bg-white px-5 py-8 text-sm text-[#5F7087]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading sent messages…
      </div>
    );
  }

  const segment = (id: 'all' | Channel, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        setChannel(id);
        setPage(0);
      }}
      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
        channel === id ? 'bg-white text-slate-950 shadow-sm ring-1 ring-[#D9E3F1]' : 'text-[#5F7087] hover:text-slate-900'
      }`}
    >
      {label} <span className={channel === id ? 'text-[#5846EA]' : 'text-[#8A98AD]'}>{count}</span>
    </button>
  );

  const smsParts = opened && opened.channel === 'sms' ? Math.max(1, Math.ceil(plain(opened.body).length / 160)) : 0;

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{notice}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total sent" value={messages.length} icon={<Send className="h-5 w-5" />} />
        <Stat label="SMS" value={counts.sms} hint={`${messages.length ? Math.round((counts.sms / messages.length) * 100) : 0}% of messages`} icon={<MessageSquareText className="h-5 w-5" />} />
        <Stat label="Emails" value={counts.email} hint={`${messages.length ? Math.round((counts.email / messages.length) * 100) : 0}% of messages`} icon={<Mail className="h-5 w-5" />} />
        <Stat
          label="Last sent"
          value={<span className="text-lg">{latestTime ? formatDate(latestTime) : '—'}</span>}
          hint={latestTime ? formatClock(latestTime) : undefined}
          icon={<CalendarClock className="h-5 w-5" />}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D9E3F1] bg-white">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E6EDF7] p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A98AD]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search name, GR no., mobile, subject or message"
              className="h-10 w-full rounded-xl border border-[#D9E3F1] bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-[#8A98AD] focus:border-[#5846EA] focus:ring-2 focus:ring-[#5846EA]/15"
            />
          </div>

          <div className="inline-flex rounded-xl bg-[#F1F5FA] p-0.5">
            {segment('all', 'All', messages.length)}
            {segment('sms', 'SMS', counts.sms)}
            {segment('email', 'Email', counts.email)}
          </div>

          <select
            value={range}
            onChange={(event) => {
              setRange(event.target.value as Range);
              setPage(0);
            }}
            aria-label="Date range"
            className="h-10 rounded-xl border border-[#D9E3F1] bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#5846EA] focus:ring-2 focus:ring-[#5846EA]/15"
          >
            {RANGES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9E3F1] bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-[#F8FAFD] disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E6EDF7] bg-[#F8FAFD] text-[11px] font-semibold uppercase tracking-wider text-[#8A98AD]">
                <th className="px-5 py-3">Recipient</th>
                <th className="px-3 py-3">Channel</th>
                <th className="px-3 py-3">Message</th>
                <th className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setNewestFirst((value) => !value)}
                    className="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-slate-900"
                  >
                    Sent on
                    {newestFirst ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                  </button>
                </th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Inbox className="mx-auto h-9 w-9 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {messages.length === 0 ? 'No messages have been sent yet' : 'No messages match these filters'}
                    </p>
                    <p className="mt-1 text-sm text-[#5F7087]">
                      {messages.length === 0
                        ? 'SMS and emails sent to parents will appear here as soon as they go out.'
                        : 'Try a wider date range or another word.'}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((message) => (
                  <tr
                    key={message.key}
                    onClick={() => setOpenKey(message.key)}
                    className="group cursor-pointer border-b border-[#EEF2F8] transition last:border-0 hover:bg-[#F8FAFD]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={message.recipient} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{message.recipient}</p>
                          <p className="truncate text-xs text-[#8A98AD]">
                            {message.gr ? `GR ${message.gr}` : message.channel === 'email' ? 'Parent email' : ''}
                            {message.gr && message.contact ? ' · ' : ''}
                            {message.channel === 'sms' ? message.contact : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E3F1] px-2 py-1 text-xs font-medium text-slate-700">
                        <ChannelIcon channel={message.channel} className="h-3.5 w-3.5 text-[#5846EA]" />
                        {message.channel === 'email' ? 'Email' : 'SMS'}
                      </span>
                    </td>
                    <td className="max-w-[420px] px-3 py-3">
                      {message.subject ? <p className="truncate text-sm font-semibold text-slate-900">{message.subject}</p> : null}
                      <p className="truncate text-sm text-[#5F7087]">{plain(message.body) || 'No message text'}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <p className="text-sm font-medium text-slate-900">{formatDate(message.sentTime)}</p>
                      <p className="text-xs text-[#8A98AD]">{formatClock(message.sentTime)}</p>
                    </td>
                    <td className="px-3 py-3 text-[#C0CADB] transition group-hover:text-[#5846EA]">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {visible.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EDF7] px-5 py-3 text-xs text-[#5F7087]">
            <div className="flex items-center gap-3">
              <span>
                Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, visible.length)} of {visible.length}
              </span>
              <label className="flex items-center gap-1.5">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                  className="h-8 rounded-lg border border-[#D9E3F1] bg-white px-2 text-xs font-medium text-slate-700 outline-none"
                >
                  {SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E3F1] text-[#5F7087] transition hover:bg-[#F8FAFD] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[4.5rem] text-center font-medium tabular-nums text-slate-700">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                disabled={safePage >= totalPages - 1}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E3F1] text-[#5F7087] transition hover:bg-[#F8FAFD] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Drawer */}
      {opened ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Message details">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/30" onClick={() => setOpenKey(null)} />

          <aside className="relative flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#E6EDF7] px-6 py-4">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => visible[openIndex - 1] && setOpenKey(visible[openIndex - 1].key)}
                  disabled={openIndex === 0}
                  aria-label="Previous message"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E3F1] text-[#5F7087] transition hover:bg-[#F8FAFD] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => visible[openIndex + 1] && setOpenKey(visible[openIndex + 1].key)}
                  disabled={openIndex >= visible.length - 1}
                  aria-label="Next message"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9E3F1] text-[#5F7087] transition hover:bg-[#F8FAFD] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="ml-2 text-xs tabular-nums text-[#8A98AD]">
                  {openIndex + 1} of {visible.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenKey(null)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5F7087] transition hover:bg-[#F1F5FA] hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="flex items-center gap-4">
                <Avatar name={opened.recipient} size="lg" />
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold tracking-tight text-slate-950">{opened.recipient}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#5F7087]">
                    <span className="inline-flex items-center gap-1.5">
                      <ChannelIcon channel={opened.channel} className="h-3.5 w-3.5" />
                      {opened.channel === 'email' ? 'Email' : 'SMS'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Sent
                    </span>
                  </p>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[#E6EDF7] py-5">
                <Fact label="Sent on" value={formatFull(opened.sentTime)} />
                <Fact label={opened.channel === 'email' ? 'Email address' : 'Mobile'} value={opened.contact} />
                <Fact label="GR no." value={opened.gr} />
                <Fact label={opened.channel === 'email' ? 'Sent by' : 'Source'} value={opened.sentBy} />
              </dl>

              <div className="mt-6">
                {opened.channel === 'email' ? (
                  <>
                    <h4 className="text-base font-semibold text-slate-950">{opened.subject || '(no subject)'}</h4>
                    <p className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-slate-700">
                      {multiline(opened.body) || 'No message text'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="whitespace-pre-line break-words rounded-2xl bg-[#F1F5FA] px-5 py-4 text-sm leading-7 text-slate-800">
                      {multiline(opened.body) || 'No message text'}
                    </p>
                    <p className="mt-2 text-[11px] text-[#8A98AD]">
                      {plain(opened.body).length} characters · {smsParts} SMS {smsParts === 1 ? 'part' : 'parts'}
                    </p>
                  </>
                )}
              </div>

              {opened.attachment ? (
                <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#D9E3F1] px-3.5 py-2 text-sm font-medium text-slate-700">
                  <Paperclip className="h-4 w-4 text-[#8A98AD]" />
                  {opened.attachment}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export const STUDENT_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'sent-messages',
    label: 'Sent messages',
    icon: MessageSquareText,
    render: () => <SentMessagesFeed />,
  },
];
