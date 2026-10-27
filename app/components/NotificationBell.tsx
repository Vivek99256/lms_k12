'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

import { fetchNotificationInbox, type NotificationInboxRow } from '@/lib/platform/client';

const SEEN_KEY = 'notification-bell-last-seen-id';
const POLL_MS = 60_000;

function readSeen(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Header bell: the in-app notifications the platform really delivered. Hidden for users who cannot read the feed. */
export default function NotificationBell() {
  const [rows, setRows] = useState<NotificationInboxRow[]>([]);
  const [allowed, setAllowed] = useState(true);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchNotificationInbox()
      .then(setRows)
      .catch(() => setAllowed(false));
  }, []);

  useEffect(() => {
    setSeen(readSeen());
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!allowed) {
    return (
      <span className="hidden p-1 text-slate-500 lg:block" aria-hidden>
        <Bell size={20} />
      </span>
    );
  }

  const unread = rows.filter((row) => row.id > seen).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next && rows.length) {
      const newest = Math.max(...rows.map((row) => row.id));
      setSeen(newest);
      try {
        window.localStorage.setItem(SEEN_KEY, String(newest));
      } catch {
        /* storage unavailable: the count simply comes back next load */
      }
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-xl p-1 text-slate-500 hover:bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40"
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" role="menu">
          <p className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">Notifications</p>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Nothing new.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {rows.map((row) => (
                <li key={row.id} className={`px-3 py-2 ${row.id > seen ? 'bg-indigo-50/50' : ''}`}>
                  <p className="text-sm font-medium text-slate-900">{row.subject}</p>
                  <p className="text-xs text-slate-600">{row.body}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{new Date(row.created_at.replace(' ', 'T')).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
