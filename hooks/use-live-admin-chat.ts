'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AdminAvailabilityStatus,
  LiveChatMessage,
  LiveChatSession,
  LiveChatUser,
  MeetingBooking,
  MeetingSlot,
} from '@/lib/live-chat/types';

export interface LiveChatNotification {
  id: string;
  type: 'booking_confirmed' | 'new_booking' | 'meeting_starting';
  title: string;
  message: string;
  meetUrl: string;
  date?: string;
  time?: string;
  timestamp: number;
}

interface UseLiveAdminChatProps {
  user: LiveChatUser;
  pagePath: string;
  pageTitle?: string;
  isAdmin?: boolean;
  enabled?: boolean;
}

export function useLiveAdminChat({
  user,
  pagePath,
  pageTitle,
  isAdmin = false,
  enabled = true,
}: UseLiveAdminChatProps) {
  const [session, setSession] = useState<LiveChatSession | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMeetStarting, setIsMeetStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Presence: real admin online/offline tracking
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [adminAvailability, setAdminAvailability] = useState<AdminAvailabilityStatus>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lms_admin_availability');
      if (saved === 'offline' || saved === 'busy' || saved === 'available') {
        return saved as AdminAvailabilityStatus;
      }
    }
    return 'available';
  });

  // Time Slots & Bookings
  const [availableSlots, setAvailableSlots] = useState<MeetingSlot[]>([]);
  const [defaultMeetUrl, setDefaultMeetUrlState] = useState<string>('');
  const [isBookingSlot, setIsBookingSlot] = useState(false);

  // Admin Queue state
  const [adminQueue, setAdminQueue] = useState<LiveChatSession[]>([]);
  const [activeAdminSessionId, setActiveAdminSessionId] = useState<string | null>(null);

  // Live Meeting Notifications & Reminders
  const [notification, setNotification] = useState<LiveChatNotification | null>(null);
  const dismissedNotificationIdsRef = useRef<Set<string>>(new Set());

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const presenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  // Keep ref synchronized
  const activeSessionId = isAdmin ? (activeAdminSessionId || session?.id || null) : (session?.id || null);
  currentSessionIdRef.current = activeSessionId;

  /**
   * Fetch presence status of admins
   */
  const fetchPresence = useCallback(async () => {
    try {
      const subInst = user.subInstituteId ? `?subInstituteId=${user.subInstituteId}` : '';
      const res = await fetch(`/api/live-chat/presence${subInst}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setIsAdminOnline(Boolean(data.isOnline));
      }
    } catch (err) {
      console.error('[LiveChat] Failed to sync presence:', err);
    }
  }, [user.subInstituteId]);

  /**
   * Send heartbeat if user is an admin
   */
  const sendAdminHeartbeat = useCallback(async (statusToReport?: AdminAvailabilityStatus) => {
    if (!isAdmin || !user.userId) return;
    try {
      await fetch('/api/live-chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: String(user.userId),
          adminName: user.userName || 'Admin',
          subInstituteId: user.subInstituteId ?? 1,
          status: statusToReport || adminAvailability,
        }),
      });
    } catch (err) {
      console.error('[LiveChat] Failed to send admin heartbeat:', err);
    }
  }, [adminAvailability, isAdmin, user.subInstituteId, user.userId, user.userName]);

  /**
   * Fetch messages for the currently active session
   */
  const fetchMessages = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/live-chat/messages?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;

      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
      if (data.sessionStatus) {
        setSession((prev) => (prev && prev.id === sessionId ? { ...prev, status: data.sessionStatus, meetUrl: data.meetUrl } : prev));
      }
    } catch (err) {
      console.error('[LiveChat] Failed to sync messages:', err);
    }
  }, []);

  /**
   * Fetch available slots for Google Meet booking
   */
  const fetchAvailableSlots = useCallback(
    async (dateStr?: string, options?: { includeBooked?: boolean }) => {
      try {
        const dateQuery = dateStr ? `&date=${encodeURIComponent(dateStr)}` : '';
        const bookedQuery = options?.includeBooked ? '&includeBooked=true' : '';
        const subInst = user.subInstituteId ? `subInstituteId=${user.subInstituteId}` : 'subInstituteId=1';
        const res = await fetch(`/api/live-chat/slots?${subInst}${dateQuery}${bookedQuery}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setAvailableSlots(data.slots || []);
          if (data.defaultMeetUrl) {
            setDefaultMeetUrlState((prev) => (prev === data.defaultMeetUrl ? prev : data.defaultMeetUrl));
          }
          return data.slots || [];
        }
        return [];
      } catch (err) {
        console.error('[LiveChat] Failed to fetch slots:', err);
        return [];
      }
    },
    [user.subInstituteId]
  );

  /**
   * Book a selected slot for a Google Meet session
   */
  const bookSlot = useCallback(
    async (slotId: string): Promise<{ success: boolean; booking?: MeetingBooking; error?: string }> => {
      const targetSessionId = currentSessionIdRef.current;
      if (!targetSessionId || isBookingSlot) {
        return { success: false, error: 'No active session or booking already in progress' };
      }

      setIsBookingSlot(true);
      setError(null);

      try {
        const res = await fetch('/api/live-chat/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'book',
            slotId,
            sessionId: targetSessionId,
            student: user,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to book slot');
        }

        // Refresh messages immediately to show confirmed card
        await fetchMessages(targetSessionId);
        await fetchAvailableSlots();
        return { success: true, booking: data.booking };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setIsBookingSlot(false);
      }
    },
    [fetchAvailableSlots, fetchMessages, isBookingSlot, user]
  );

  /**
   * Mark participant joined and open Google Meet
   */
  const joinMeeting = useCallback(
    async (bookingId: string, meetUrl: string) => {
      try {
        void fetch('/api/live-chat/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'join',
            bookingId,
            role: isAdmin ? 'admin' : 'student',
          }),
        });

        window.open(meetUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error('[LiveChat] Error joining meeting:', err);
        window.open(meetUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [isAdmin]
  );

  /**
   * Cancel an active meeting booking
   */
  const cancelMeeting = useCallback(
    async (bookingId: string) => {
      const targetSessionId = currentSessionIdRef.current;
      try {
        const res = await fetch('/api/live-chat/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel',
            bookingId,
            cancelledBy: {
              id: String(user.userId),
              name: user.userName || 'User',
              role: isAdmin ? 'admin' : 'student',
            },
          }),
        });

        if (res.ok && targetSessionId) {
          await fetchMessages(targetSessionId);
          await fetchAvailableSlots();
        }
      } catch (err) {
        console.error('[LiveChat] Failed to cancel booking:', err);
      }
    },
    [fetchAvailableSlots, fetchMessages, isAdmin, user.userId, user.userName]
  );

  /**
   * Admin configures new time slots
   */
  const configureSlots = useCallback(
    async (
      dateStr: string,
      slotsList: Array<{ startTime: string; endTime: string; durationMinutes?: number }>,
      overwrite = false,
      meetUrl?: string
    ) => {
      if (!isAdmin) return;
      try {
        const res = await fetch('/api/live-chat/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId: String(user.userId),
            adminName: user.userName || 'Admin',
            subInstituteId: user.subInstituteId ?? 1,
            date: dateStr,
            slots: slotsList,
            overwrite,
            defaultMeetUrl: meetUrl?.trim() || defaultMeetUrl || undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to configure slots');
        }
        const data = await res.json();
        if (data.defaultMeetUrl) {
          setDefaultMeetUrlState(data.defaultMeetUrl);
        }
        await fetchAvailableSlots(dateStr, { includeBooked: true });
      } catch (err) {
        console.error('[LiveChat] Failed to configure slots:', err);
        throw err;
      }
    },
    [defaultMeetUrl, fetchAvailableSlots, isAdmin, user.subInstituteId, user.userId, user.userName]
  );

  /**
   * Fetch admin queue if user is admin and synchronize active student session
   */
  const fetchAdminQueue = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const subInst = user.subInstituteId ? `&subInstituteId=${user.subInstituteId}` : '';
      const res = await fetch(`/api/live-chat/session?adminQueue=true${subInst}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const queue: LiveChatSession[] = data.sessions || [];
        setAdminQueue(queue);

        // Auto-select or maintain the active student session for the admin
        setActiveAdminSessionId((prevActive) => {
          let chosenId = prevActive;
          if (!chosenId || !queue.some((s) => s.id === chosenId)) {
            const target =
              queue.find((s) => s.status === 'active' && String(s.adminId) === String(user.userId)) ||
              queue.find((s) => s.status === 'active') ||
              queue.find((s) => s.status === 'waiting') ||
              queue[0];
            chosenId = target?.id || null;
          }

          if (chosenId) {
            const chosenSession = queue.find((s) => s.id === chosenId);
            if (chosenSession) {
              setSession(chosenSession);
              currentSessionIdRef.current = chosenId;
              if (!prevActive || prevActive !== chosenId) {
                void fetchMessages(chosenId);
              }
            }
          } else {
            setSession(null);
            currentSessionIdRef.current = null;
          }
          return chosenId;
        });
      }
    } catch (err) {
      console.error('[LiveChat] Failed to fetch admin queue:', err);
    }
  }, [fetchMessages, isAdmin, user.subInstituteId, user.userId]);

  /**
   * Start or resume user's live session
   */
  const startLiveSession = useCallback(
    async (initialMessage?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/live-chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_or_get',
            user,
            pagePath,
            pageTitle,
            initialMessage,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to initiate live admin session');
        }

        const data = await res.json();
        setSession(data.session);
        setMessages(data.messages || []);
        setIsAdminOnline(Boolean(data.adminOnline));
        currentSessionIdRef.current = data.session.id;

        // Mark as read for user
        void fetch('/api/live-chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_read',
            sessionId: data.session.id,
            role: 'user',
          }),
        });

        return data.session;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user, pagePath, pageTitle]
  );

  /**
   * Send a text message
   */
  const sendMessage = useCallback(
    async (text: string) => {
      const targetSessionId = currentSessionIdRef.current;
      if (!targetSessionId || !text.trim() || isSending) return;

      const trimmed = text.trim();
      const senderRole = isAdmin ? 'admin' : 'user';

      // Optimistic message update
      const tempId = `optimistic-${Date.now()}`;
      const optimisticMsg: LiveChatMessage = {
        id: tempId,
        sessionId: targetSessionId,
        senderId: String(user.userId),
        senderName: user.userName || (isAdmin ? 'Admin' : 'You'),
        senderRole,
        type: 'text',
        text: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setIsSending(true);

      try {
        const res = await fetch('/api/live-chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: targetSessionId,
            senderId: String(user.userId),
            senderName: user.userName || (isAdmin ? 'Admin' : 'User'),
            senderRole,
            text: trimmed,
            type: 'text',
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to send message');
        }

        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message : m))
        );

        // Fetch to see if meet suggestion was triggered
        setTimeout(() => {
          if (currentSessionIdRef.current) void fetchMessages(currentSessionIdRef.current);
        }, 600);
      } catch (err) {
        console.error('[LiveChat] Failed to send message:', err);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError('Failed to send message. Please retry.');
      } finally {
        setIsSending(false);
      }
    },
    [fetchMessages, isAdmin, isSending, user]
  );

  /**
   * Start instant Google Meet call
   */
  const startGoogleMeet = useCallback(
    async (customMeetUrl?: string) => {
      const targetSessionId = currentSessionIdRef.current;
      if (!targetSessionId || isMeetStarting) return null;

      const chosenMeetUrl = customMeetUrl?.trim() || defaultMeetUrl?.trim() || undefined;

      setIsMeetStarting(true);
      setError(null);

      try {
        const res = await fetch('/api/live-chat/meet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: targetSessionId,
            senderId: String(user.userId),
            senderName: user.userName || (isAdmin ? 'Admin' : 'User'),
            senderRole: isAdmin ? 'admin' : 'user',
            customMeetUrl: chosenMeetUrl,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to create Google Meet link');
        }

        const data = await res.json();
        if (data.session) {
          setSession(data.session);
        }
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }

        // Open meet in new tab directly for caller
        if (data.meetUrl) {
          window.open(data.meetUrl, '_blank', 'noopener,noreferrer');
        }

        return data.meetUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setIsMeetStarting(false);
      }
    },
    [isAdmin, isMeetStarting, user]
  );

  /**
   * Admin claims a session from queue
   */
  const claimSession = useCallback(
    async (targetSessionId: string) => {
      if (!isAdmin) return;
      try {
        const res = await fetch('/api/live-chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'assign_admin',
            sessionId: targetSessionId,
            adminId: String(user.userId),
            adminName: user.userName || 'Admin',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSession(data.session);
          setActiveAdminSessionId(targetSessionId);
          await fetchMessages(targetSessionId);
          await fetchAdminQueue();
        }
      } catch (err) {
        console.error('[LiveChat] Failed to claim session:', err);
      }
    },
    [fetchAdminQueue, fetchMessages, isAdmin, user]
  );

  /**
   * Close or resolve session
   */
  const closeCurrentSession = useCallback(async () => {
    const targetSessionId = currentSessionIdRef.current;
    if (!targetSessionId) return;

    try {
      const res = await fetch('/api/live-chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_session',
          sessionId: targetSessionId,
          closedBy: {
            id: String(user.userId),
            name: user.userName || 'Admin',
            role: isAdmin ? 'admin' : 'user',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        await fetchMessages(targetSessionId);
        if (isAdmin) {
          await fetchAdminQueue();
        }
      }
    } catch (err) {
      console.error('[LiveChat] Failed to close session:', err);
    }
  }, [fetchAdminQueue, fetchMessages, isAdmin, user]);

  /**
   * Admin updates their availability status
   */
  const updateAvailability = useCallback(
    async (status: AdminAvailabilityStatus) => {
      setAdminAvailability(status);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lms_admin_availability', status);
      }
      await sendAdminHeartbeat(status);
      await fetchPresence();
    },
    [fetchPresence, sendAdminHeartbeat]
  );

  /**
   * Check for existing user session on load
   */
  useEffect(() => {
    if (!enabled || !user.userId) return;

    let cancelled = false;

    async function checkExisting() {
      if (isAdmin) {
        await fetchAdminQueue();
        return;
      }

      try {
        const res = await fetch(`/api/live-chat/session?userId=${encodeURIComponent(user.userId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled && data.session) {
          setSession(data.session);
          currentSessionIdRef.current = data.session.id;
          void fetchMessages(data.session.id);
        }
        if (!cancelled && data.adminOnline !== undefined) {
          setIsAdminOnline(Boolean(data.adminOnline));
        }
      } catch {
        // Safe to ignore on initial load
      }
    }

    void checkExisting();
    void fetchPresence();
    void fetchAvailableSlots();

    if (isAdmin) {
      void fetchAdminQueue();
      void sendAdminHeartbeat(adminAvailability);
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchAdminQueue, fetchAvailableSlots, fetchMessages, fetchPresence, isAdmin, sendAdminHeartbeat, user.userId]);

  /**
   * Meeting Notifications & Reminder Watcher
   */
  useEffect(() => {
    if (!enabled) return;

    // 1. Check for booking confirmation cards in message stream
    const bookingMsgs = messages.filter((m) => m.type === 'booking_confirmation' && m.bookingDetails);
    const latestBookingMsg = bookingMsgs[bookingMsgs.length - 1];

    if (latestBookingMsg && latestBookingMsg.bookingDetails) {
      const b = latestBookingMsg.bookingDetails;
      const notifKey = `booking-${b.id || latestBookingMsg.id}`;
      if (!dismissedNotificationIdsRef.current.has(notifKey)) {
        if (isAdmin) {
          setNotification({
            id: notifKey,
            type: 'new_booking',
            title: 'New Meeting Booked',
            message: `${b.studentName || 'Student'} booked Google Meet for ${b.date} at ${b.startTime} (${b.durationMinutes || 15}m).`,
            meetUrl: b.meetUrl || latestBookingMsg.meetUrl || 'https://meet.google.com',
            date: b.date,
            time: b.startTime,
            timestamp: Date.now(),
          });
        } else {
          setNotification({
            id: notifKey,
            type: 'booking_confirmed',
            title: 'Meeting Booking Confirmed',
            message: `Google Meet confirmed with ${b.adminName || 'Admin'} for ${b.date} at ${b.startTime}.`,
            meetUrl: b.meetUrl || latestBookingMsg.meetUrl || 'https://meet.google.com',
            date: b.date,
            time: b.startTime,
            timestamp: Date.now(),
          });
        }
      }
    }

    // 2. Meeting Reminder: Check if meeting is starting now (within 5 mins before start time or during)
    for (const bm of bookingMsgs) {
      const b = bm.bookingDetails!;
      if (b.status === 'scheduled' && !b.studentJoined && b.date && b.startTime) {
        try {
          const scheduledMs = new Date(`${b.date}T${b.startTime}:00`).getTime();
          const nowMs = Date.now();
          const diffMinutes = (scheduledMs - nowMs) / (1000 * 60);

          if (diffMinutes <= 5 && diffMinutes >= -15) {
            const reminderKey = `reminder-${b.id}`;
            if (!dismissedNotificationIdsRef.current.has(reminderKey)) {
              setNotification({
                id: reminderKey,
                type: 'meeting_starting',
                title: '⏰ Meeting Starting Now!',
                message: `Your 1:1 Google Meet session scheduled at ${b.startTime} is starting now.`,
                meetUrl: b.meetUrl || bm.meetUrl || 'https://meet.google.com',
                date: b.date,
                time: b.startTime,
                timestamp: Date.now(),
              });
              break;
            }
          }
        } catch {
          // ignore date parse issues
        }
      }
    }
  }, [enabled, isAdmin, messages]);

  const dismissNotification = useCallback(() => {
    if (notification) {
      dismissedNotificationIdsRef.current.add(notification.id);
      setNotification(null);
    }
  }, [notification]);

  /**
   * Admin Heartbeat Interval (every 15 seconds)
   */
  useEffect(() => {
    if (!enabled || !isAdmin) return;

    const heartbeatInterval = setInterval(() => {
      void sendAdminHeartbeat();
    }, 15000);

    presenceTimerRef.current = heartbeatInterval;

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [enabled, isAdmin, sendAdminHeartbeat]);

  /**
   * Active Polling: Sync messages, presence & expiration check every 2 seconds
   */
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;

      const sid = currentSessionIdRef.current;
      if (sid) {
        void fetchMessages(sid);
      }

      void fetchPresence();

      // Check for expired bookings
      void fetch('/api/live-chat/bookings', { cache: 'no-store' });

      if (isAdmin) {
        void fetchAdminQueue();
      }
    }, 2000);

    pollTimerRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [enabled, fetchAdminQueue, fetchMessages, fetchPresence, isAdmin]);

  return {
    session,
    messages,
    isLoading,
    isSending,
    isMeetStarting,
    isAdminOnline,
    adminAvailability,
    availableSlots,
    defaultMeetUrl,
    setDefaultMeetUrl: setDefaultMeetUrlState,
    isBookingSlot,
    error,
    adminQueue,
    activeAdminSessionId,
    setActiveAdminSessionId: (id: string | null) => {
      setActiveAdminSessionId(id);
      if (id) void fetchMessages(id);
    },
    notification,
    dismissNotification,
    startLiveSession,
    sendMessage,
    startGoogleMeet,
    claimSession,
    closeCurrentSession,
    fetchAvailableSlots,
    bookSlot,
    joinMeeting,
    cancelMeeting,
    configureSlots,
    updateAvailability,
    refreshQueue: fetchAdminQueue,
    refreshMessages: () => {
      if (currentSessionIdRef.current) void fetchMessages(currentSessionIdRef.current);
    },
  };
}
