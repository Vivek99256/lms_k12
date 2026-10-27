'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

import { fetchMyNotifications, fetchNotificationInbox } from '@/lib/platform/client';

const SEEN_KEY = 'notification-bell-seen-at';
const POLL_MS = 60_000;

interface BellItem {
  key: string;
  subject: string;
  body: string;
  createdAt: number;
  /** true/false where the source tracks it; null means the bell's own last-seen time decides. */
  read: boolean | null;
}

function toTime(value: string): number {
  const time = new Date(value.replace(' ', 'T')).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function readSeen(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Header bell. Merges the platform's admin feed (only for users allowed to read it) with the
 * notices addressed to the signed-in person: student app notices, PAL badges, Enterprise Brain
 * notices. Hidden only when neither feed can be read.
 */
export default function NotificationBell() {
  const [items, setItems] = useState<BellItem[]>([]);
  const [allowed, setAllowed] = useState(true);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    Promise.allSettled([fetchNotificationInbox(), fetchMyNotifications()]).then(([platform, mine]) => {
      if (platform.status === 'rejected' && mine.status === 'rejected') {
        setAllowed(false);
        return;
      }
      const merged: BellItem[] = [];
      if (platform.status === 'fulfilled') {
        for (const row of platform.value) {
          merged.push({
            key: `platform:${row.id}`,
            subject: row.subject ?? '',
            body: row.body ?? '',
            createdAt: toTime(row.created_at),
            read: null,
          });
        }
      }
      if (mine.status === 'fulfilled') {
        for (const row of mine.value) {
          merged.push({ key: row.key, subject: row.subject, body: row.body, createdAt: toTime(row.created_at), read: row.read });
        }
      }
      merged.sort((a, b) => b.createdAt - a.createdAt);
      setItems(merged.slice(0, 30));
    });
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

  // The server cannot record a read yet, so what this browser has already opened (seen) decides
  // too: a notice stays unread only if its source has not marked it read AND it is newer than that.
  const isUnread = (item: BellItem) => item.read !== true && item.createdAt > seen;
  const unread = items.filter(isUnread).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next && items.length) {
      const newest = Math.max(...items.map((item) => item.createdAt));
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
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Nothing new.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.key} className={`px-3 py-2 ${isUnread(item) ? 'bg-indigo-50/50' : ''}`}>
                  <p className="text-sm font-medium text-slate-900">{item.subject}</p>
                  <p className="text-xs text-slate-600">{item.body}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
