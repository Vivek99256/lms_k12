'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

import {
  fetchMyNotifications,
  fetchNotificationInbox,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from '@/lib/platform/client';
import { safeInternalPath } from '@/lib/question-papers/view';

const SEEN_KEY = 'notification-bell-seen-at';
const POLL_MS = 60_000;

interface BellItem {
  key: string;
  subject: string;
  body: string;
  createdAt: number;
  /** true/false where the source tracks it; null means the bell's own last-seen time decides. */
  read: boolean | null;
  /** Set for notices the server tracks per person (`user:<id>`), which can be marked read. */
  userNoticeId?: number;
  link?: string | null;
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
          const userNoticeId = row.source === 'user' ? Number(row.key.split(':')[1]) || undefined : undefined;
          merged.push({
            key: row.key,
            subject: row.subject,
            body: row.body,
            createdAt: toTime(row.created_at),
            read: row.read,
            userNoticeId,
            link: row.link,
          });
        }
      }
      merged.sort((a, b) => b.createdAt - a.createdAt);
      // The same notice can arrive from both feeds; keep one per key.
      const seenKeys = new Set<string>();
      const unique = merged.filter((item) => (seenKeys.has(item.key) ? false : (seenKeys.add(item.key), true)));
      setItems(unique.slice(0, 30));
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
  // Server-tracked notices are unread until the server says otherwise; merely opening the bell is not a read.
  const isUnread = (item: BellItem) =>
    item.userNoticeId !== undefined ? item.read !== true : item.read !== true && item.createdAt > seen;
  const unread = items.filter(isUnread).length;

  const openNotice = (item: BellItem) => {
    const target = safeInternalPath(item.link);
    const done = () => {
      if (target) window.location.assign(target);
    };
    if (item.userNoticeId !== undefined && item.read !== true) {
      setItems((prev) => prev.map((x) => (x.key === item.key ? { ...x, read: true } : x)));
      markUserNotificationRead(item.userNoticeId).then(done, () => {
        // Not recorded: show it as unread again rather than pretend it was saved.
        setItems((prev) => prev.map((x) => (x.key === item.key ? { ...x, read: false } : x)));
        done();
      });
    } else {
      done();
    }
  };

  const readAll = () => {
    setItems((prev) => prev.map((x) => (x.userNoticeId !== undefined ? { ...x, read: true } : x)));
    markAllUserNotificationsRead().catch(load);
  };

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
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {items.some((item) => item.userNoticeId !== undefined && item.read !== true) && (
              <button type="button" onClick={readAll} className="text-xs font-medium text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Nothing new.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.key} className={isUnread(item) ? 'bg-indigo-50/50' : ''}>
                  {safeInternalPath(item.link) || item.userNoticeId !== undefined ? (
                    <button
                      type="button"
                      onClick={() => openNotice(item)}
                      className="block w-full px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40"
                    >
                      <p className="text-sm font-medium text-slate-900">{item.subject}</p>
                      <p className="text-xs text-slate-600">{item.body}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</p>
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-slate-900">{item.subject}</p>
                      <p className="text-xs text-slate-600">{item.body}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
