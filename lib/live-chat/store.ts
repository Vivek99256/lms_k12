import { randomInt } from 'node:crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  AdminAvailabilityStatus,
  AdminPresence,
  CreateMeetRequest,
  LiveChatMessage,
  LiveChatSession,
  LiveChatSessionStatus,
  LiveChatUser,
  MeetingBooking,
  MeetingSlot,
  SendMessageRequest,
} from './types';

export const INITIAL_ADMIN_GREETING = 'Hello! I can help you with that right now.';
export const MEET_SUGGESTION_THRESHOLD = 3; // Trigger suggestion after 3 messages exchanged
export const DEFAULT_MEETING_DURATION = 15; // 15 minutes
export const DEFAULT_GRACE_PERIOD = 2; // 2 minutes grace period for joining

interface LiveChatStoreData {
  sessions: Record<string, LiveChatSession>;
  messages: Record<string, LiveChatMessage[]>;
  adminPresence: Record<string, AdminPresence>;
  slots: Record<string, MeetingSlot>;
  bookings: Record<string, MeetingBooking>;
  defaultMeetUrl?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __liveChatStore: LiveChatStoreData | undefined;
}

const STORAGE_DIR = path.join(process.cwd(), '.next_cache_data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'live-chat-store.json');

export { formatLocalDate } from './date-utils';
import { formatLocalDate } from './date-utils';

export const DEFAULT_TIMES = [
  { start: '10:00', end: '10:15' },
  { start: '10:30', end: '10:45' },
  { start: '11:15', end: '11:30' },
  { start: '13:00', end: '13:15' },
  { start: '13:30', end: '13:45' },
  { start: '14:00', end: '14:15' },
  { start: '14:30', end: '14:45' },
  { start: '15:15', end: '15:30' },
  { start: '16:00', end: '16:15' },
  { start: '16:30', end: '16:45' },
  { start: '17:00', end: '17:15' },
];

export function ensureSlotsForDate(
  store: LiveChatStoreData,
  dateStr: string,
  subInstituteId: string | number = 1,
  adminName = 'Academic Administrator'
): MeetingSlot[] {
  const existingForDate = Object.values(store.slots).filter(
    (s) => s.date === dateStr
  );

  if (existingForDate.length > 0) {
    return existingForDate;
  }

  // Seed default slots for this date
  const created: MeetingSlot[] = [];
  DEFAULT_TIMES.forEach(({ start, end }) => {
    const slotKey = `slot-${dateStr}-${start}`;
    if (!store.slots[slotKey]) {
      const slot: MeetingSlot = {
        id: slotKey,
        adminId: 'admin-default',
        adminName,
        subInstituteId: subInstituteId ?? 1,
        date: dateStr,
        startTime: start,
        endTime: end,
        durationMinutes: DEFAULT_MEETING_DURATION,
        isBooked: false,
      };
      store.slots[slotKey] = slot;
      created.push(slot);
    }
  });

  if (created.length > 0) {
    persistData();
  }
  return Object.values(store.slots).filter((s) => s.date === dateStr);
}

function seedDefaultSlots(store: LiveChatStoreData) {
  const today = formatLocalDate(new Date());
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrow = formatLocalDate(tomorrowDate);
  const dayAfterDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const dayAfter = formatLocalDate(dayAfterDate);

  [today, tomorrow, dayAfter].forEach((dateStr) => {
    ensureSlotsForDate(store, dateStr, 1);
  });
}

function loadPersistedData(): LiveChatStoreData {
    if (globalThis.__liveChatStore) {
      if (!globalThis.__liveChatStore.sessions) globalThis.__liveChatStore.sessions = {};
      if (!globalThis.__liveChatStore.messages) globalThis.__liveChatStore.messages = {};
      if (!globalThis.__liveChatStore.adminPresence) globalThis.__liveChatStore.adminPresence = {};
      if (!globalThis.__liveChatStore.slots) globalThis.__liveChatStore.slots = {};
      if (!globalThis.__liveChatStore.bookings) globalThis.__liveChatStore.bookings = {};
      // Purge any accidental admin self-sessions so admin queue connects to genuine student sessions
      Object.keys(globalThis.__liveChatStore.sessions).forEach((sid) => {
        const s = globalThis.__liveChatStore!.sessions[sid];
        if (s && (s.userRole === 'Admin' || s.userRole === 'Administrator' || (s.adminId && String(s.userId) === String(s.adminId)))) {
          delete globalThis.__liveChatStore!.sessions[sid];
          delete globalThis.__liveChatStore!.messages[sid];
        }
      });
      seedDefaultSlots(globalThis.__liveChatStore);
      checkAndExpireMissedBookingsInternal(globalThis.__liveChatStore);
      return globalThis.__liveChatStore;
    }

    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as LiveChatStoreData;
        if (parsed.sessions && parsed.messages) {
          if (!parsed.adminPresence) parsed.adminPresence = {};
          if (!parsed.slots) parsed.slots = {};
          if (!parsed.bookings) parsed.bookings = {};
          if (parsed.defaultMeetUrl && typeof parsed.defaultMeetUrl === 'string') {
            parsed.defaultMeetUrl = parsed.defaultMeetUrl.trim();
          }
          Object.keys(parsed.sessions).forEach((sid) => {
            const s = parsed.sessions[sid];
            if (s && (s.userRole === 'Admin' || s.userRole === 'Administrator' || (s.adminId && String(s.userId) === String(s.adminId)))) {
              delete parsed.sessions[sid];
              delete parsed.messages[sid];
            }
          });
          seedDefaultSlots(parsed);
          checkAndExpireMissedBookingsInternal(parsed);
          globalThis.__liveChatStore = parsed;
          persistData();
          return parsed;
        }
      }
    } catch {
      // If reading disk fails, start fresh in memory
    }

  const initial: LiveChatStoreData = {
    sessions: {},
    messages: {},
    adminPresence: {},
    slots: {},
    bookings: {},
    defaultMeetUrl: undefined,
  };
  seedDefaultSlots(initial);
  globalThis.__liveChatStore = initial;
  persistData();
  return initial;
}

function persistData() {
  if (!globalThis.__liveChatStore) return;
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(globalThis.__liveChatStore, null, 2), 'utf-8');
  } catch {
    // Non-fatal write failure
  }
}

export function getDefaultMeetUrl(): string | undefined {
  const store = loadPersistedData();
  return store.defaultMeetUrl;
}

export function setDefaultMeetUrl(url?: string): void {
  const store = loadPersistedData();
  store.defaultMeetUrl = url?.trim() || undefined;
  persistData();
}

/**
 * Generate a valid Google Meet link format (https://meet.google.com/xxx-yyyy-zzz)
 */
export function generateGoogleMeetUrl(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[randomInt(chars.length)]).join('');
  return `https://meet.google.com/${segment(3)}-${segment(4)}-${segment(3)}`;
}

// ==========================================
// 1. ADMIN ONLINE/OFFLINE PRESENCE TRACKING
// ==========================================

export function updateAdminPresence(
  adminId: string,
  adminName: string,
  subInstituteId: string | number,
  status: AdminAvailabilityStatus = 'available'
): AdminPresence {
  const store = loadPersistedData();
  const now = new Date().toISOString();

  const presence: AdminPresence = {
    adminId: String(adminId),
    adminName: adminName || 'Admin',
    subInstituteId: String(subInstituteId ?? 1),
    status,
    lastSeen: now,
  };

  store.adminPresence[String(adminId)] = presence;
  persistData();

  // If admin just became available, check if there's an active waiting session to notify
  if (status === 'available') {
    Object.values(store.sessions).forEach((session) => {
      if (session.status === 'waiting' && !session.initialGreetingSent) {
        assignAdmin(session.id, { adminId, adminName });
      }
    });
  }

  return presence;
}

export function getAdminPresence(subInstituteId?: string | number): {
  isOnline: boolean;
  activeAdmins: AdminPresence[];
  primaryAdmin?: AdminPresence;
} {
  const store = loadPersistedData();
  const now = Date.now();
  const PRESENCE_TIMEOUT_MS = 60 * 1000; // 60 seconds heartbeat timeout

  const list = Object.values(store.adminPresence).filter((p) => {
    if (subInstituteId != null && String(subInstituteId) !== '' && String(subInstituteId) !== '0') {
      if (p.subInstituteId && String(p.subInstituteId) !== String(subInstituteId)) {
        return false;
      }
    }
    const age = now - new Date(p.lastSeen).getTime();
    return p.status === 'available' && age <= PRESENCE_TIMEOUT_MS;
  });

  const isOnline = list.length > 0;
  return {
    isOnline,
    activeAdmins: list,
    primaryAdmin: list[0] || undefined,
  };
}

// ==========================================
// 2. SESSION & AUTOMATIC GREETING INITIATION
// ==========================================

export function getOrCreateUserSession(
  user: LiveChatUser,
  pagePath = '/dashboard',
  pageTitle = 'LMS Dashboard',
  initialMessage?: string
): { session: LiveChatSession; messages: LiveChatMessage[]; adminOnline: boolean } {
  const store = loadPersistedData();
  const presence = getAdminPresence(user.subInstituteId);

  // Find existing open/waiting session for this user
  const existingSession = Object.values(store.sessions).find(
    (s) =>
      String(s.userId) === String(user.userId) &&
      (s.status === 'waiting' || s.status === 'active')
  );

  if (existingSession) {
    // If admin is online and no greeting sent yet, trigger greeting
    if (presence.isOnline && !existingSession.initialGreetingSent && presence.primaryAdmin) {
      assignAdmin(existingSession.id, {
        adminId: presence.primaryAdmin.adminId,
        adminName: presence.primaryAdmin.adminName,
      });
    }

    return {
      session: existingSession,
      messages: store.messages[existingSession.id] || [],
      adminOnline: presence.isOnline,
    };
  }

  const sessionId = uuidv4();
  const now = new Date().toISOString();

  const newSession: LiveChatSession = {
    id: sessionId,
    userId: String(user.userId || 'guest'),
    userName: user.userName || 'User',
    userRole: user.userRole || user.userProfile || 'Student',
    subInstituteId: user.subInstituteId ?? 1,
    pagePath,
    pageTitle,
    status: presence.isOnline ? 'active' : 'waiting',
    adminId: presence.primaryAdmin?.adminId,
    adminName: presence.primaryAdmin?.adminName,
    createdAt: now,
    updatedAt: now,
    unreadCountForUser: 0,
    unreadCountForAdmin: 1,
    initialGreetingSent: false,
    messagesExchangedCount: 0,
    meetSuggested: false,
  };

  store.sessions[sessionId] = newSession;
  store.messages[sessionId] = [];

  // Initial system message
  const statusNote = presence.isOnline
    ? `Live support session started. Administrator ${presence.primaryAdmin?.adminName} is online.`
    : `Live support session started. Administrators are currently offline, but your message will be queued.`;

  const welcomeMessage: LiveChatMessage = {
    id: uuidv4(),
    sessionId,
    senderId: 'system',
    senderName: 'System',
    senderRole: 'system',
    type: 'system',
    text: statusNote,
    createdAt: now,
  };
  store.messages[sessionId].push(welcomeMessage);

  if (initialMessage && initialMessage.trim()) {
    const userMessage: LiveChatMessage = {
      id: uuidv4(),
      sessionId,
      senderId: String(user.userId),
      senderName: user.userName,
      senderRole: 'user',
      type: 'text',
      text: initialMessage.trim(),
      createdAt: new Date().toISOString(),
    };
    store.messages[sessionId].push(userMessage);
    newSession.lastMessageText = userMessage.text;
    newSession.lastMessageTime = userMessage.createdAt;
    newSession.messagesExchangedCount = 1;
  }

  // If Admin is currently online and available: automatically send the initial greeting!
  if (presence.isOnline && presence.primaryAdmin) {
    sendAutomaticGreeting(newSession, presence.primaryAdmin);
  }

  persistData();
  return {
    session: newSession,
    messages: store.messages[sessionId],
    adminOnline: presence.isOnline,
  };
}

function sendAutomaticGreeting(session: LiveChatSession, admin: { adminId: string; adminName: string }) {
  if (session.initialGreetingSent) return;

  const store = loadPersistedData();
  const greetingId = uuidv4();
  const now = new Date().toISOString();

  const greetingMessage: LiveChatMessage = {
    id: greetingId,
    sessionId: session.id,
    senderId: String(admin.adminId),
    senderName: admin.adminName || 'Admin',
    senderRole: 'admin',
    type: 'text',
    text: INITIAL_ADMIN_GREETING,
    createdAt: now,
  };

  if (!store.messages[session.id]) {
    store.messages[session.id] = [];
  }
  store.messages[session.id].push(greetingMessage);

  session.initialGreetingSent = true;
  session.status = 'active';
  session.adminId = admin.adminId;
  session.adminName = admin.adminName;
  session.updatedAt = now;
  session.lastMessageText = INITIAL_ADMIN_GREETING;
  session.lastMessageTime = now;
}

export function assignAdmin(
  sessionId: string,
  admin: { adminId: string; adminName: string }
): LiveChatSession | null {
  const store = loadPersistedData();
  const session = store.sessions[sessionId];
  if (!session) return null;

  session.status = 'active';
  session.adminId = admin.adminId;
  session.adminName = admin.adminName;
  session.updatedAt = new Date().toISOString();

  // Send the automated initial greeting if not sent yet
  if (!session.initialGreetingSent) {
    sendAutomaticGreeting(session, admin);
  } else {
    // Add system announcement if greeting already sent earlier
    const systemMsg: LiveChatMessage = {
      id: uuidv4(),
      sessionId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      type: 'system',
      text: `${admin.adminName} (Administrator) has joined the chat.`,
      createdAt: new Date().toISOString(),
    };
    if (!store.messages[sessionId]) store.messages[sessionId] = [];
    store.messages[sessionId].push(systemMsg);
  }

  persistData();
  return session;
}

// ==========================================
// 3. MESSAGING & MEET AUTO-SUGGESTION
// ==========================================

export function addMessage(req: SendMessageRequest): LiveChatMessage | null {
  const store = loadPersistedData();
  const session = store.sessions[req.sessionId];
  if (!session || session.status === 'closed') return null;

  const now = new Date().toISOString();
  const message: LiveChatMessage = {
    id: uuidv4(),
    sessionId: req.sessionId,
    senderId: req.senderId,
    senderName: req.senderName,
    senderRole: req.senderRole,
    type: req.type || 'text',
    text: req.text,
    meetUrl: req.meetUrl,
    bookingDetails: req.bookingDetails,
    createdAt: now,
  };

  if (!store.messages[req.sessionId]) {
    store.messages[req.sessionId] = [];
  }
  store.messages[req.sessionId].push(message);

  session.updatedAt = now;
  session.lastMessageText = req.text;
  session.lastMessageTime = now;

  if (req.senderRole === 'user') {
    session.unreadCountForAdmin = (session.unreadCountForAdmin || 0) + 1;
    session.messagesExchangedCount = (session.messagesExchangedCount || 0) + 1;
  } else if (req.senderRole === 'admin') {
    session.unreadCountForUser = (session.unreadCountForUser || 0) + 1;
    session.messagesExchangedCount = (session.messagesExchangedCount || 0) + 1;
    if (session.status === 'waiting') {
      session.status = 'active';
      session.adminId = req.senderId;
      session.adminName = req.senderName;
    }
  }

  // Check if we should automatically suggest Google Meet scheduling
  if (
    (session.messagesExchangedCount || 0) >= MEET_SUGGESTION_THRESHOLD &&
    !session.meetSuggested &&
    !session.activeBookingId
  ) {
    session.meetSuggested = true;
    const suggestionMessage: LiveChatMessage = {
      id: uuidv4(),
      sessionId: req.sessionId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      type: 'meet_suggestion',
      text: 'Would you like to schedule a 1:1 Google Meet session with the administrator to resolve this quickly?',
      createdAt: new Date(Date.now() + 500).toISOString(),
    };
    store.messages[req.sessionId].push(suggestionMessage);
  }

  persistData();
  return message;
}

export function getMessages(sessionId: string, afterTimestamp?: string): LiveChatMessage[] {
  const store = loadPersistedData();
  const all = store.messages[sessionId] || [];
  if (!afterTimestamp) return all;

  const afterTime = new Date(afterTimestamp).getTime();
  return all.filter((m) => new Date(m.createdAt).getTime() > afterTime);
}

export function getSession(sessionId: string): LiveChatSession | null {
  const store = loadPersistedData();
  return store.sessions[sessionId] || null;
}

export function listSessions(filters?: {
  subInstituteId?: string | number;
  status?: LiveChatSessionStatus;
  excludeAdminRole?: boolean;
}): LiveChatSession[] {
  const store = loadPersistedData();
  let list = Object.values(store.sessions);

  if (filters?.excludeAdminRole) {
    list = list.filter(
      (s) =>
        s.userRole !== 'Admin' &&
        s.userRole !== 'Administrator' &&
        (!s.adminId || String(s.userId) !== String(s.adminId))
    );
  }

  if (filters?.subInstituteId != null) {
    list = list.filter(
      (s) => String(s.subInstituteId) === String(filters.subInstituteId)
    );
  }

  if (filters?.status) {
    list = list.filter((s) => s.status === filters.status);
  } else {
    list = list.filter((s) => s.status === 'waiting' || s.status === 'active');
  }

  return list.sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
  );
}

export function markAsRead(sessionId: string, role: 'user' | 'admin') {
  const store = loadPersistedData();
  const session = store.sessions[sessionId];
  if (!session) return;

  if (role === 'user') {
    session.unreadCountForUser = 0;
  } else {
    session.unreadCountForAdmin = 0;
  }
  persistData();
}

// ==========================================
// 4. ADMIN SLOTS CONFIGURATION & QUERY
// ==========================================

export function configureAdminSlots(
  adminId: string,
  adminName: string,
  subInstituteId: string | number,
  dateStr: string,
  slotsList: Array<{ startTime: string; endTime: string; durationMinutes?: number }>,
  options?: { overwrite?: boolean; defaultMeetUrl?: string }
): MeetingSlot[] {
  const store = loadPersistedData();
  const created: MeetingSlot[] = [];

  const configuredMeetUrl = options?.defaultMeetUrl?.trim() || store.defaultMeetUrl;
  if (options?.defaultMeetUrl?.trim()) {
    store.defaultMeetUrl = options.defaultMeetUrl.trim();
  }

  if (options?.overwrite) {
    // If overwrite is requested, clear unbooked slots for this date
    Object.keys(store.slots).forEach((key) => {
      const slot = store.slots[key];
      if (slot.date === dateStr && !slot.isBooked) {
        delete store.slots[key];
      }
    });
  }

  slotsList.forEach(({ startTime, endTime, durationMinutes }) => {
    const slotKey = `slot-${dateStr}-${startTime}`;
    // If overwriting, clear booking if it was somehow marked booked without an active booking, or recreate
    if (options?.overwrite) {
      const slot: MeetingSlot = {
        id: slotKey,
        adminId: String(adminId),
        adminName: adminName || 'Admin',
        subInstituteId: subInstituteId ?? 1,
        date: dateStr,
        startTime,
        endTime,
        durationMinutes: durationMinutes || DEFAULT_MEETING_DURATION,
        isBooked: false,
        meetUrl: configuredMeetUrl,
      };
      store.slots[slotKey] = slot;
      created.push(slot);
    } else if (!store.slots[slotKey] || !store.slots[slotKey].isBooked) {
      const slot: MeetingSlot = {
        id: slotKey,
        adminId: String(adminId),
        adminName: adminName || 'Admin',
        subInstituteId: subInstituteId ?? 1,
        date: dateStr,
        startTime,
        endTime,
        durationMinutes: durationMinutes || DEFAULT_MEETING_DURATION,
        isBooked: false,
        meetUrl: configuredMeetUrl,
      };
      store.slots[slotKey] = slot;
      created.push(slot);
    }
  });

  persistData();
  return created;
}

export function deleteSlot(slotId: string): boolean {
  const store = loadPersistedData();
  const slot = store.slots[slotId];
  if (!slot || slot.isBooked) {
    return false;
  }
  delete store.slots[slotId];
  persistData();
  return true;
}

export function resetLiveChatStore(): void {
  const store = loadPersistedData();
  store.slots = {};
  store.bookings = {};
  store.adminPresence = {};
  seedDefaultSlots(store);
  persistData();
}

export function getAvailableSlots(
  subInstituteId?: string | number,
  date?: string,
  options?: { includeBooked?: boolean; includePast?: boolean }
): MeetingSlot[] {
  const store = loadPersistedData();
  const todayStr = formatLocalDate(new Date());
  const targetDate = date || todayStr;

  // Ensure default slots are available for requested date if none exist
  ensureSlotsForDate(store, targetDate, subInstituteId || 1);

  let list = Object.values(store.slots);

  if (!options?.includeBooked) {
    list = list.filter((s) => !s.isBooked);
  }

  if (subInstituteId != null && String(subInstituteId) !== '' && String(subInstituteId) !== '0') {
    list = list.filter((s) => {
      if (!s.subInstituteId) return true;
      if (String(s.subInstituteId) === '1' || String(subInstituteId) === '1') return true;
      return String(s.subInstituteId) === String(subInstituteId);
    });
  }

  if (date) {
    list = list.filter((s) => s.date === date);
  }

  return list.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}

// ==========================================
// 5. BOOKING, REVALIDATION & GOOGLE MEET
// ==========================================

export function bookMeetingSlot(
  slotId: string,
  sessionId: string,
  studentUser: LiveChatUser
): { success: boolean; booking?: MeetingBooking; error?: string } {
  const store = loadPersistedData();
  const slot = store.slots[slotId];
  const session = store.sessions[sessionId];

  if (!session) {
    return { success: false, error: 'Chat session not found' };
  }

  // CRITICAL: Revalidate slot availability on backend to prevent double-booking
  if (!slot || slot.isBooked) {
    return {
      success: false,
      error: 'This time slot is no longer available. Please select another slot.',
    };
  }

  const bookingId = uuidv4();
  const now = new Date().toISOString();
  const meetUrl = slot.meetUrl?.trim() || store.defaultMeetUrl?.trim() || generateGoogleMeetUrl();

  const booking: MeetingBooking = {
    id: bookingId,
    slotId: slot.id,
    sessionId,
    studentId: String(studentUser.userId),
    studentName: studentUser.userName || 'Student',
    adminId: slot.adminId,
    adminName: slot.adminName,
    subInstituteId: session.subInstituteId,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMinutes: slot.durationMinutes || DEFAULT_MEETING_DURATION,
    status: 'scheduled',
    meetUrl,
    studentJoined: false,
    adminJoined: false,
    gracePeriodMinutes: DEFAULT_GRACE_PERIOD,
    reminderSent: false,
    createdAt: now,
    updatedAt: now,
  };

  // Lock slot
  slot.isBooked = true;
  slot.bookingId = bookingId;

  store.bookings[bookingId] = booking;
  session.activeBookingId = bookingId;
  session.meetUrl = meetUrl;

  // Insert confirmation card into the chat
  const confirmMessage: LiveChatMessage = {
    id: uuidv4(),
    sessionId,
    senderId: 'system',
    senderName: 'System',
    senderRole: 'system',
    type: 'booking_confirmation',
    text: `Google Meet Session Confirmed with ${slot.adminName} for ${slot.date} at ${slot.startTime} (${booking.durationMinutes} mins).`,
    meetUrl,
    bookingDetails: booking,
    createdAt: now,
  };

  if (!store.messages[sessionId]) store.messages[sessionId] = [];
  store.messages[sessionId].push(confirmMessage);

  session.lastMessageText = `Google Meet booked: ${slot.date} ${slot.startTime}`;
  session.lastMessageTime = now;

  persistData();
  return { success: true, booking };
}

// ==========================================
// 6. EXPIRATION OF MISSED MEETINGS
// ==========================================

function checkAndExpireMissedBookingsInternal(store: LiveChatStoreData) {
  const now = Date.now();

  Object.values(store.bookings).forEach((booking) => {
    if (booking.status === 'scheduled') {
      // Calculate scheduled start time timestamp
      const scheduledDateTime = new Date(`${booking.date}T${booking.startTime}:00`).getTime();
      const expirationThreshold = scheduledDateTime + (booking.gracePeriodMinutes || DEFAULT_GRACE_PERIOD) * 60 * 1000;

      // If scheduled time + grace period has passed and student hasn't joined:
      if (now > expirationThreshold && !booking.studentJoined) {
        booking.status = 'missed';
        booking.updatedAt = new Date().toISOString();

        // Release slot so it can be reclaimed if appropriate, or mark expired
        if (store.slots[booking.slotId]) {
          store.slots[booking.slotId].isBooked = true; // Kept booked for historical audit
        }

        const session = store.sessions[booking.sessionId];
        if (session && session.activeBookingId === booking.id) {
          session.activeBookingId = undefined;

          // Add notice message to chat
          const missedNotice: LiveChatMessage = {
            id: uuidv4(),
            sessionId: booking.sessionId,
            senderId: 'system',
            senderName: 'System',
            senderRole: 'system',
            type: 'booking_missed',
            text: `The scheduled Google Meet session was missed because it was not joined within the ${booking.gracePeriodMinutes}-minute grace period. You may select and book another available slot below.`,
            bookingDetails: booking,
            createdAt: new Date().toISOString(),
          };

          if (!store.messages[booking.sessionId]) store.messages[booking.sessionId] = [];
          store.messages[booking.sessionId].push(missedNotice);
        }
      }
    }
  });
}

export function checkAndExpireMissedBookings(): MeetingBooking[] {
  const store = loadPersistedData();
  checkAndExpireMissedBookingsInternal(store);
  persistData();
  return Object.values(store.bookings);
}

export function recordParticipantJoin(
  bookingId: string,
  role: 'student' | 'admin'
): MeetingBooking | null {
  const store = loadPersistedData();
  const booking = store.bookings[bookingId];
  if (!booking) return null;

  const now = new Date().toISOString();
  if (role === 'student') {
    booking.studentJoined = true;
    booking.studentJoinedAt = now;
  } else {
    booking.adminJoined = true;
    booking.adminJoinedAt = now;
  }

  if (booking.status === 'scheduled') {
    booking.status = 'active';
  }
  booking.updatedAt = now;

  persistData();
  return booking;
}

export function cancelBooking(
  bookingId: string,
  cancelledBy: { id: string; name: string; role: string }
): MeetingBooking | null {
  const store = loadPersistedData();
  const booking = store.bookings[bookingId];
  if (!booking) return null;

  booking.status = 'cancelled';
  booking.updatedAt = new Date().toISOString();

  // Free the slot
  if (store.slots[booking.slotId]) {
    store.slots[booking.slotId].isBooked = false;
    store.slots[booking.slotId].bookingId = undefined;
  }

  const session = store.sessions[booking.sessionId];
  if (session && session.activeBookingId === booking.id) {
    session.activeBookingId = undefined;
  }

  const cancelMessage: LiveChatMessage = {
    id: uuidv4(),
    sessionId: booking.sessionId,
    senderId: 'system',
    senderName: 'System',
    senderRole: 'system',
    type: 'system',
    text: `The scheduled meeting for ${booking.date} at ${booking.startTime} was cancelled by ${cancelledBy.name}.`,
    createdAt: new Date().toISOString(),
  };

  if (!store.messages[booking.sessionId]) store.messages[booking.sessionId] = [];
  store.messages[booking.sessionId].push(cancelMessage);

  persistData();
  return booking;
}

export function attachGoogleMeet(
  req: CreateMeetRequest
): { session: LiveChatSession; message: LiveChatMessage } | null {
  const store = loadPersistedData();
  const session = store.sessions[req.sessionId];
  if (!session) return null;

  const meetUrl = req.customMeetUrl?.trim() || store.defaultMeetUrl?.trim() || generateGoogleMeetUrl();
  if (req.customMeetUrl?.trim()) {
    store.defaultMeetUrl = req.customMeetUrl.trim();
  }
  const now = new Date().toISOString();

  session.meetUrl = meetUrl;
  session.updatedAt = now;

  const meetMessage: LiveChatMessage = {
    id: uuidv4(),
    sessionId: req.sessionId,
    senderId: req.senderId,
    senderName: req.senderName,
    senderRole: req.senderRole,
    type: 'meet',
    text: `${req.senderName} started a Google Meet video session. Click below to join.`,
    meetUrl,
    createdAt: now,
  };

  if (!store.messages[req.sessionId]) store.messages[req.sessionId] = [];
  store.messages[req.sessionId].push(meetMessage);

  session.lastMessageText = `Google Meet call started`;
  session.lastMessageTime = now;

  if (req.senderRole === 'admin') {
    session.unreadCountForUser = (session.unreadCountForUser || 0) + 1;
  } else {
    session.unreadCountForAdmin = (session.unreadCountForAdmin || 0) + 1;
  }

  persistData();
  return { session, message: meetMessage };
}

export function closeSession(sessionId: string): LiveChatSession | null {
  const store = loadPersistedData();
  const session = store.sessions[sessionId];
  if (!session) return null;

  const now = new Date().toISOString();
  session.status = 'closed';
  session.updatedAt = now;
  session.lastMessageText = undefined;
  session.lastMessageTime = undefined;
  session.unreadCountForAdmin = 0;
  session.unreadCountForUser = 0;
  session.messagesExchangedCount = 0;
  delete store.messages[sessionId];

  persistData();
  return session;
}
