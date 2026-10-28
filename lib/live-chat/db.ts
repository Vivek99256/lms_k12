import { randomInt } from 'node:crypto';
import { createPool, type Pool } from 'mysql2/promise';
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
import { DEFAULT_TIMES, DEFAULT_MEETING_DURATION, INITIAL_ADMIN_GREETING } from './store';

declare global {
  // eslint-disable-next-line no-var
  var __liveChatDbPool: Pool | undefined;
}

export function getDbPool(): Pool {
  if (globalThis.__liveChatDbPool) {
    return globalThis.__liveChatDbPool;
  }

  const host = process.env.LIVE_CHAT_DB_HOST;
  const user = process.env.LIVE_CHAT_DB_USER || process.env.LIVE_CHAT_DB_USERNAME;
  const password = process.env.LIVE_CHAT_DB_PASSWORD;
  const database = process.env.LIVE_CHAT_DB_DATABASE || process.env.LIVE_CHAT_DB_NAME;
  const port = Number(process.env.LIVE_CHAT_DB_PORT || 3306);

  if (!host || !user || !password || !database) {
    throw new Error('Live chat database is not configured');
  }

  const pool = createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000,
  });

  globalThis.__liveChatDbPool = pool;
  return pool;
}

function generateMeetCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (len: number) =>
    Array.from({ length: len }, () => chars[randomInt(chars.length)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}

// ----------------------------------------------------
// 1. PRESENCE TRACKING
// ----------------------------------------------------

export async function dbUpdateAdminPresence(
  adminId: string,
  adminName: string,
  subInstituteId: string | number = '1',
  status: AdminAvailabilityStatus = 'available'
): Promise<AdminPresence> {
  const pool = getDbPool();
  const subInst = String(subInstituteId || '1');
  const now = new Date();

  await pool.query(
    `INSERT INTO ai_live_admin_presence (admin_id, admin_name, sub_institute_id, status, last_seen, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE admin_name = VALUES(admin_name), sub_institute_id = VALUES(sub_institute_id), status = VALUES(status), last_seen = NOW(), updated_at = NOW()`,
    [String(adminId), adminName || 'Admin Staff', subInst, status]
  );

  // If newly available, automatically assign waiting sessions
  if (status === 'available') {
    const [waitingRows] = (await pool.query(
      `SELECT * FROM ai_live_chat_sessions WHERE status = 'waiting' AND initial_greeting_sent = 0`
    )) as [Array<Record<string, unknown>>, unknown];

    for (const w of waitingRows) {
      await pool.query(
        `UPDATE ai_live_chat_sessions SET status = 'active', admin_id = ?, admin_name = ?, initial_greeting_sent = 1, last_message_text = ?, last_message_time = NOW(), unread_count_for_user = 1, updated_at = NOW() WHERE id = ?`,
        [String(adminId), adminName, INITIAL_ADMIN_GREETING, w.id]
      );

      await pool.query(
        `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'admin', 'text', ?, NOW(), NOW())`,
        [uuidv4(), w.id, String(adminId), adminName, INITIAL_ADMIN_GREETING]
      );
    }
  }

  return {
    adminId: String(adminId),
    adminName: adminName || 'Admin Staff',
    subInstituteId: subInst,
    status,
    lastSeen: now.toISOString(),
  };
}

export async function dbGetAdminPresence(subInstituteId?: string | number): Promise<{
  isOnline: boolean;
  activeAdmins: AdminPresence[];
  primaryAdmin?: AdminPresence;
}> {
  const pool = getDbPool();

  let sql = `SELECT * FROM ai_live_admin_presence WHERE status = 'available' AND last_seen >= DATE_SUB(NOW(), INTERVAL 120 SECOND)`;
  const params: unknown[] = [];

  const subInstStr = subInstituteId != null ? String(subInstituteId) : '';
  if (subInstStr && subInstStr !== '0' && subInstStr !== '1') {
    sql += ` AND (sub_institute_id = ? OR sub_institute_id = '1' OR sub_institute_id IS NULL OR sub_institute_id = '')`;
    params.push(subInstStr);
  }

  sql += ` ORDER BY last_seen DESC`;

  let [rows] = (await pool.query(sql, params)) as [Array<Record<string, unknown>>, unknown];

  // Fallback: If no admin found for this specific sub-institute, check if ANY admin is online anywhere
  if (rows.length === 0) {
    const [allAdmins] = (await pool.query(
      `SELECT * FROM ai_live_admin_presence WHERE status = 'available' AND last_seen >= DATE_SUB(NOW(), INTERVAL 120 SECOND) ORDER BY last_seen DESC`
    )) as [Array<Record<string, unknown>>, unknown];
    if (allAdmins.length > 0) {
      rows = allAdmins;
    }
  }

  const list: AdminPresence[] = rows.map((r) => ({
    adminId: String(r.admin_id),
    adminName: String(r.admin_name || 'Admin'),
    subInstituteId: String(r.sub_institute_id || '1'),
    status: (r.status as AdminAvailabilityStatus) || 'available',
    lastSeen: new Date(r.last_seen as string | Date).toISOString(),
  }));

  return {
    isOnline: list.length > 0,
    activeAdmins: list,
    primaryAdmin: list[0] || undefined,
  };
}

// ----------------------------------------------------
// 2. SESSIONS & MESSAGES
// ----------------------------------------------------

export async function dbGetOrCreateUserSession(
  user: LiveChatUser,
  pagePath = '/dashboard',
  pageTitle = 'Dashboard',
  initialMessage?: string
): Promise<{ session: LiveChatSession; messages: LiveChatMessage[]; adminOnline: boolean }> {
  const pool = getDbPool();
  const presence = await dbGetAdminPresence(user.subInstituteId);
  const userId = String(user.userId);
  const subInst = String(user.subInstituteId || '1');

  // Check existing waiting or active session
  const [existingRows] = (await pool.query(
    `SELECT * FROM ai_live_chat_sessions WHERE user_id = ? AND status IN ('waiting', 'active') ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  )) as [Array<Record<string, unknown>>, unknown];

  if (existingRows.length > 0) {
    const s = existingRows[0];
    const session = formatSessionRow(s);
    const messages = await dbGetMessages(session.id);
    return { session, messages, adminOnline: presence.isOnline };
  }

  // Create new session
  const sessionId = `chat-${uuidv4()}`;
  const userRole = user.userRole || 'Student';

  await pool.query(
    `INSERT INTO ai_live_chat_sessions 
     (id, sub_institute_id, client_id, user_id, user_name, user_role, status, page_path, page_title, initial_message, initial_greeting_sent, unread_count_for_admin, unread_count_for_user, messages_exchanged_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, 0, 0, 0, 0, NOW(), NOW())`,
    [
      sessionId,
      subInst,
      user.clientId || null,
      userId,
      user.userName || 'Student',
      userRole,
      pagePath,
      pageTitle,
      initialMessage || null,
    ]
  );

  // Welcome announcement message
  const statusNote = presence.isOnline
    ? 'Connected to Live Support. An administrator is currently online and will reply shortly.'
    : 'Administrator is currently offline. You can leave a message or book a Google Meet session for later.';

  await pool.query(
    `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, created_at, updated_at)
     VALUES (?, ?, 'system', 'System', 'system', 'system', ?, NOW(), NOW())`,
    [uuidv4(), sessionId, statusNote]
  );

  // Initial user message if sent
  if (initialMessage && initialMessage.trim()) {
    const trimmed = initialMessage.trim();
    await pool.query(
      `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'user', 'text', ?, NOW(), NOW())`,
      [uuidv4(), sessionId, userId, user.userName || 'Student', trimmed]
    );

    await pool.query(
      `UPDATE ai_live_chat_sessions SET last_message_text = ?, last_message_time = NOW(), messages_exchanged_count = 1, unread_count_for_admin = 1, updated_at = NOW() WHERE id = ?`,
      [trimmed, sessionId]
    );
  }

  // Automatic greeting if admin is online
  if (presence.isOnline && presence.primaryAdmin) {
    const admin = presence.primaryAdmin;
    await pool.query(
      `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', 'text', ?, NOW(), NOW())`,
      [uuidv4(), sessionId, admin.adminId, admin.adminName, INITIAL_ADMIN_GREETING]
    );

    await pool.query(
      `UPDATE ai_live_chat_sessions SET status = 'active', admin_id = ?, admin_name = ?, initial_greeting_sent = 1, last_message_text = ?, last_message_time = NOW(), unread_count_for_user = 1, updated_at = NOW() WHERE id = ?`,
      [admin.adminId, admin.adminName, INITIAL_ADMIN_GREETING, sessionId]
    );
  }

  const [freshRows] = (await pool.query(`SELECT * FROM ai_live_chat_sessions WHERE id = ?`, [sessionId])) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  const session = formatSessionRow(freshRows[0]);
  const messages = await dbGetMessages(sessionId);
  return { session, messages, adminOnline: presence.isOnline };
}

export async function dbGetSession(sessionId: string): Promise<LiveChatSession | null> {
  const pool = getDbPool();
  const [rows] = (await pool.query(`SELECT * FROM ai_live_chat_sessions WHERE id = ?`, [sessionId])) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  if (rows.length === 0) return null;
  return formatSessionRow(rows[0]);
}

export async function dbListSessions(filters?: {
  subInstituteId?: string | number;
  status?: LiveChatSessionStatus;
  excludeAdminRole?: boolean;
}): Promise<LiveChatSession[]> {
  const pool = getDbPool();
  let sql = `SELECT * FROM ai_live_chat_sessions WHERE 1=1`;
  const params: unknown[] = [];

  if (filters?.excludeAdminRole) {
    sql += ` AND user_role NOT IN ('Admin', 'Administrator')`;
  }

  if (filters?.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  } else {
    sql += ` AND status IN ('waiting', 'active')`;
  }

  const subInstStr = filters?.subInstituteId != null ? String(filters.subInstituteId) : '';
  if (subInstStr && subInstStr !== '0' && subInstStr !== '1') {
    sql += ` AND (sub_institute_id = ? OR sub_institute_id IS NULL OR sub_institute_id = '1')`;
    params.push(subInstStr);
  }

  sql += ` ORDER BY updated_at DESC`;

  let [rows] = (await pool.query(sql, params)) as [Array<Record<string, unknown>>, unknown];

  // Fallback: If no sessions returned for a specific sub-institute, check all waiting/active student sessions
  // so no student query is lost across multi-device testing with differing test logins
  if (rows.length === 0 && subInstStr && subInstStr !== '0' && subInstStr !== '1') {
    const fallbackSql = `SELECT * FROM ai_live_chat_sessions WHERE user_role NOT IN ('Admin', 'Administrator') AND status IN ('waiting', 'active') ORDER BY updated_at DESC`;
    const [allRows] = (await pool.query(fallbackSql)) as [Array<Record<string, unknown>>, unknown];
    if (allRows.length > 0) {
      rows = allRows;
    }
  }

  return rows.map((r) => formatSessionRow(r));
}

export async function dbAssignAdmin(
  sessionId: string,
  admin: { adminId: string; adminName: string }
): Promise<LiveChatSession | null> {
  const pool = getDbPool();
  const [rows] = (await pool.query(`SELECT * FROM ai_live_chat_sessions WHERE id = ?`, [sessionId])) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  if (rows.length === 0) return null;
  const s = rows[0];

  if (!s.initial_greeting_sent) {
    await pool.query(
      `UPDATE ai_live_chat_sessions SET status = 'active', admin_id = ?, admin_name = ?, initial_greeting_sent = 1, last_message_text = ?, last_message_time = NOW(), unread_count_for_user = 1, updated_at = NOW() WHERE id = ?`,
      [admin.adminId, admin.adminName, INITIAL_ADMIN_GREETING, sessionId]
    );

    await pool.query(
      `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', 'text', ?, NOW(), NOW())`,
      [uuidv4(), sessionId, admin.adminId, admin.adminName, INITIAL_ADMIN_GREETING]
    );
  } else {
    await pool.query(
      `UPDATE ai_live_chat_sessions SET status = 'active', admin_id = ?, admin_name = ?, updated_at = NOW() WHERE id = ?`,
      [admin.adminId, admin.adminName, sessionId]
    );

    await pool.query(
      `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, created_at, updated_at)
       VALUES (?, ?, 'system', 'System', 'system', 'system', ?, NOW(), NOW())`,
      [uuidv4(), sessionId, `${admin.adminName} (Administrator) has joined the chat.`]
    );
  }

  return dbGetSession(sessionId);
}

export async function dbCloseSession(
  sessionId: string,
  closedBy?: { id: string; name: string; role: string }
): Promise<LiveChatSession | null> {
  const pool = getDbPool();
  await pool.query(`UPDATE ai_live_chat_sessions SET status = 'closed', updated_at = NOW() WHERE id = ?`, [sessionId]);

  const closerName = closedBy?.name || 'Administrator';
  await pool.query(
    `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, created_at, updated_at)
     VALUES (?, ?, 'system', 'System', 'system', 'system', ?, NOW(), NOW())`,
    [uuidv4(), sessionId, `Live chat ended by ${closerName}.`]
  );

  return dbGetSession(sessionId);
}

export async function dbMarkAsRead(sessionId: string, role: 'user' | 'admin'): Promise<void> {
  const pool = getDbPool();
  const field = role === 'user' ? 'unread_count_for_user' : 'unread_count_for_admin';
  await pool.query(`UPDATE ai_live_chat_sessions SET ${field} = 0, updated_at = NOW() WHERE id = ?`, [sessionId]);
}

export async function dbAddMessage(req: SendMessageRequest): Promise<LiveChatMessage | null> {
  const pool = getDbPool();
  const messageId = uuidv4();
  const now = new Date();
  const bookingJson = req.bookingDetails ? JSON.stringify(req.bookingDetails) : null;

  await pool.query(
    `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, meet_url, booking_details, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      messageId,
      req.sessionId,
      req.senderId,
      req.senderName,
      req.senderRole,
      req.type || 'text',
      req.text,
      req.meetUrl || null,
      bookingJson,
    ]
  );

  // Update session
  let updateSql = `UPDATE ai_live_chat_sessions SET updated_at = NOW(), last_message_text = ?, last_message_time = NOW()`;
  const updateParams: unknown[] = [req.text];

  if (req.senderRole === 'user') {
    updateSql += `, unread_count_for_admin = unread_count_for_admin + 1, messages_exchanged_count = messages_exchanged_count + 1`;
  } else if (req.senderRole === 'admin') {
    updateSql += `, unread_count_for_user = unread_count_for_user + 1`;
  }

  updateSql += ` WHERE id = ?`;
  updateParams.push(req.sessionId);
  await pool.query(updateSql, updateParams);

  // Trigger meet suggestion on 3 user messages
  if (req.senderRole === 'user') {
    const [sRows] = (await pool.query(`SELECT * FROM ai_live_chat_sessions WHERE id = ?`, [req.sessionId])) as [
      Array<Record<string, unknown>>,
      unknown
    ];
    if (sRows.length > 0 && Number(sRows[0].messages_exchanged_count) >= 3 && !sRows[0].meet_suggested) {
      await pool.query(
        `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, created_at, updated_at)
         VALUES (?, ?, 'system', 'System', 'system', 'meet_suggestion', ?, NOW(), NOW())`,
        [
          uuidv4(),
          req.sessionId,
          'Would you like to schedule a 1:1 Google Meet session with the administrator to resolve this quickly?',
        ]
      );
      await pool.query(`UPDATE ai_live_chat_sessions SET meet_suggested = 1 WHERE id = ?`, [req.sessionId]);
    }
  }

  return {
    id: messageId,
    sessionId: req.sessionId,
    senderId: req.senderId,
    senderName: req.senderName,
    senderRole: req.senderRole,
    type: req.type || 'text',
    text: req.text,
    meetUrl: req.meetUrl,
    bookingDetails: req.bookingDetails,
    createdAt: now.toISOString(),
  };
}

export async function dbGetMessages(sessionId: string, afterTimestamp?: string): Promise<LiveChatMessage[]> {
  const pool = getDbPool();
  let sql = `SELECT * FROM ai_live_chat_messages WHERE session_id = ?`;
  const params: unknown[] = [sessionId];

  if (afterTimestamp) {
    sql += ` AND created_at > ?`;
    params.push(new Date(afterTimestamp));
  }

  sql += ` ORDER BY created_at ASC`;

  const [rows] = (await pool.query(sql, params)) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => formatMessageRow(r));
}

// ----------------------------------------------------
// 3. SLOTS & BOOKINGS
// ----------------------------------------------------

export async function dbEnsureSlotsForDate(dateStr: string, subInstituteId: string | number = '1'): Promise<MeetingSlot[]> {
  const pool = getDbPool();
  const subInst = String(subInstituteId || '1');
  const [existing] = (await pool.query(
    `SELECT * FROM ai_live_meeting_slots WHERE date = ? AND sub_institute_id = ? ORDER BY start_time ASC`,
    [dateStr, subInst]
  )) as [Array<Record<string, unknown>>, unknown];

  if (existing.length > 0) {
    return existing.map((r) => formatSlotRow(r));
  }

  const now = new Date();
  for (const t of DEFAULT_TIMES) {
    const slotId = `slot-${dateStr}-${t.start}`;
    await pool.query(
      `INSERT IGNORE INTO ai_live_meeting_slots (id, admin_id, admin_name, sub_institute_id, date, start_time, end_time, duration_minutes, is_booked, created_at, updated_at)
       VALUES (?, 'admin-default', 'Academic Administrator', ?, ?, ?, ?, 15, 0, ?, ?)`,
      [slotId, subInst, dateStr, t.start, t.end, now, now]
    );
  }

  const [created] = (await pool.query(
    `SELECT * FROM ai_live_meeting_slots WHERE date = ? AND sub_institute_id = ? ORDER BY start_time ASC`,
    [dateStr, subInst]
  )) as [Array<Record<string, unknown>>, unknown];

  return created.map((r) => formatSlotRow(r));
}

export async function dbGetAvailableSlots(
  dateStr?: string,
  subInstituteId: string | number = '1',
  includeBooked = false
): Promise<MeetingSlot[]> {
  const pool = getDbPool();
  const subInst = String(subInstituteId || '1');
  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  await dbEnsureSlotsForDate(targetDate, subInst);

  let sql = `SELECT * FROM ai_live_meeting_slots WHERE date = ? AND sub_institute_id = ?`;
  if (!includeBooked) {
    sql += ` AND is_booked = 0`;
  }
  sql += ` ORDER BY start_time ASC`;

  const [rows] = (await pool.query(sql, [targetDate, subInst])) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => formatSlotRow(r));
}

export async function dbConfigureAdminSlots(
  adminId: string,
  adminName: string,
  subInstituteId: string | number,
  dateStr: string,
  slotsList: Array<{ startTime: string; endTime: string; durationMinutes?: number }>,
  options?: { overwrite?: boolean; defaultMeetUrl?: string }
): Promise<MeetingSlot[]> {
  const pool = getDbPool();
  const subInst = String(subInstituteId || '1');
  const now = new Date();

  if (options?.defaultMeetUrl?.trim()) {
    await pool.query(
      `INSERT INTO ai_live_chat_settings (setting_key, setting_value, updated_at)
       VALUES ('default_meet_url', ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)`,
      [options.defaultMeetUrl.trim(), now]
    );
  }

  if (options?.overwrite) {
    await pool.query(
      `DELETE FROM ai_live_meeting_slots WHERE date = ? AND sub_institute_id = ? AND is_booked = 0`,
      [dateStr, subInst]
    );
  }

  for (const s of slotsList) {
    if (!s.startTime) continue;
    const slotId = `slot-${dateStr}-${s.startTime}`;
    await pool.query(
      `INSERT INTO ai_live_meeting_slots (id, admin_id, admin_name, sub_institute_id, date, start_time, end_time, duration_minutes, is_booked, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE admin_id = VALUES(admin_id), admin_name = VALUES(admin_name), end_time = VALUES(end_time), updated_at = VALUES(updated_at)`,
      [
        slotId,
        String(adminId),
        adminName || 'Admin Staff',
        subInst,
        dateStr,
        s.startTime,
        s.endTime || s.startTime,
        s.durationMinutes || 15,
        now,
      ]
    );
  }

  return dbGetAvailableSlots(dateStr, subInst, true);
}

export async function dbBookMeetingSlot(slotId: string, sessionId: string, student: LiveChatUser): Promise<MeetingBooking | null> {
  const pool = getDbPool();
  const [slotRows] = (await pool.query(`SELECT * FROM ai_live_meeting_slots WHERE id = ?`, [slotId])) as [
    Array<Record<string, unknown>>,
    unknown
  ];

  if (slotRows.length === 0 || slotRows[0].is_booked) {
    return null;
  }
  const slot = slotRows[0];

  const [sessionRows] = (await pool.query(`SELECT * FROM ai_live_chat_sessions WHERE id = ?`, [sessionId])) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  const session = sessionRows[0] || {};
  const adminId = String(session.admin_id || slot.admin_id || 'admin-1');
  const adminName = String(session.admin_name || slot.admin_name || 'Academic Administrator');

  // Fetch default meet url
  const [settingRows] = (await pool.query(`SELECT setting_value FROM ai_live_chat_settings WHERE setting_key = 'default_meet_url'`)) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  const meetUrl = (settingRows[0]?.setting_value as string) || `https://meet.google.com/${generateMeetCode()}`;

  const bookingId = `book-${uuidv4()}`;
  const now = new Date();

  const booking: MeetingBooking = {
    id: bookingId,
    slotId,
    sessionId,
    studentId: String(student.userId),
    studentName: student.userName || 'Student',
    adminId,
    adminName,
    subInstituteId: String(slot.sub_institute_id || '1'),
    date: String(slot.date),
    startTime: String(slot.start_time),
    endTime: String(slot.end_time),
    durationMinutes: Number(slot.duration_minutes || 15),
    status: 'scheduled',
    meetUrl,
    studentJoined: false,
    adminJoined: false,
    gracePeriodMinutes: 2,
    reminderSent: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await pool.query(
    `INSERT INTO ai_live_meeting_bookings (id, slot_id, session_id, student_id, student_name, admin_id, admin_name, sub_institute_id, date, start_time, end_time, duration_minutes, status, meet_url, student_joined, admin_joined, grace_period_minutes, reminder_sent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, 0, 0, 2, 0, ?, ?)`,
    [
      bookingId,
      slotId,
      sessionId,
      booking.studentId,
      booking.studentName,
      booking.adminId,
      booking.adminName,
      booking.subInstituteId,
      booking.date,
      booking.startTime,
      booking.endTime,
      booking.durationMinutes,
      booking.meetUrl,
      now,
      now,
    ]
  );

  await pool.query(
    `UPDATE ai_live_meeting_slots SET is_booked = 1, booking_id = ?, meet_url = ?, updated_at = ? WHERE id = ?`,
    [bookingId, meetUrl, now, slotId]
  );

  // Add booking card to message stream
  await pool.query(
    `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, meet_url, booking_details, created_at, updated_at)
     VALUES (?, ?, 'system', 'System', 'system', 'booking_confirmation', ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      sessionId,
      `Google Meet scheduled for ${booking.date} at ${booking.startTime} (${booking.durationMinutes} mins).`,
      meetUrl,
      JSON.stringify(booking),
      now,
      now,
    ]
  );

  await pool.query(
    `UPDATE ai_live_chat_sessions SET active_booking_id = ?, active_meet_url = ?, last_message_text = ?, last_message_time = ?, updated_at = ? WHERE id = ?`,
    [bookingId, meetUrl, `1:1 Google Meet booked for ${booking.date} at ${booking.startTime}.`, now, now, sessionId]
  );

  return booking;
}

export async function dbAttachGoogleMeet(req: CreateMeetRequest): Promise<{ session: LiveChatSession; message: LiveChatMessage; meetUrl: string } | null> {
  const pool = getDbPool();
  const [sRows] = (await pool.query(`SELECT * FROM ai_live_chat_sessions WHERE id = ?`, [req.sessionId])) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  if (sRows.length === 0) return null;

  const [settingRows] = (await pool.query(`SELECT setting_value FROM ai_live_chat_settings WHERE setting_key = 'default_meet_url'`)) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  const meetUrl = req.customMeetUrl?.trim() || (settingRows[0]?.setting_value as string) || `https://meet.google.com/${generateMeetCode()}`;
  const now = new Date();
  const messageId = uuidv4();

  await pool.query(
    `UPDATE ai_live_chat_sessions SET active_meet_url = ?, last_message_text = 'Join 1:1 Google Meet session', last_message_time = ?, unread_count_for_user = unread_count_for_user + 1, updated_at = ? WHERE id = ?`,
    [meetUrl, now, now, req.sessionId]
  );

  const text = 'Administrator has started a live Google Meet session. Click Join Meeting to connect directly.';
  await pool.query(
    `INSERT INTO ai_live_chat_messages (id, session_id, sender_id, sender_name, sender_role, type, text, meet_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'meet', ?, ?, ?, ?)`,
    [messageId, req.sessionId, req.senderId, req.senderName, req.senderRole, text, meetUrl, now, now]
  );

  const updatedSession = await dbGetSession(req.sessionId);
  const msg: LiveChatMessage = {
    id: messageId,
    sessionId: req.sessionId,
    senderId: req.senderId,
    senderName: req.senderName,
    senderRole: req.senderRole,
    type: 'meet',
    text,
    meetUrl,
    createdAt: now.toISOString(),
  };

  return { session: updatedSession!, message: msg, meetUrl };
}

export async function dbDeleteSlot(slotId: string): Promise<boolean> {
  const pool = getDbPool();
  await pool.query(`DELETE FROM ai_live_meeting_slots WHERE id = ?`, [slotId]);
  return true;
}

export async function dbRecordParticipantJoin(
  bookingId: string,
  role: 'student' | 'admin'
): Promise<MeetingBooking | null> {
  const pool = getDbPool();
  const field = role === 'student' ? 'student_joined' : 'admin_joined';
  const now = new Date();
  await pool.query(`UPDATE ai_live_meeting_bookings SET ${field} = 1, updated_at = ? WHERE id = ?`, [now, bookingId]);
  const [rows] = (await pool.query(`SELECT * FROM ai_live_meeting_bookings WHERE id = ?`, [bookingId])) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  if (rows.length === 0) return null;
  return formatBookingRow(rows[0]);
}

export async function dbCancelBooking(
  bookingId: string,
  cancelledBy: { id: string; name: string; role: string }
): Promise<MeetingBooking | null> {
  const pool = getDbPool();
  const now = new Date();
  await pool.query(`UPDATE ai_live_meeting_bookings SET status = 'cancelled', updated_at = ? WHERE id = ?`, [now, bookingId]);
  const [bRows] = (await pool.query(`SELECT * FROM ai_live_meeting_bookings WHERE id = ?`, [bookingId])) as [
    Array<Record<string, unknown>>,
    unknown
  ];
  if (bRows.length === 0) return null;
  const b = bRows[0];
  if (b.slot_id) {
    await pool.query(
      `UPDATE ai_live_meeting_slots SET is_booked = 0, booking_id = NULL, meet_url = NULL, updated_at = ? WHERE id = ?`,
      [now, b.slot_id]
    );
  }
  return formatBookingRow(b);
}

export async function dbCheckAndExpireMissedBookings(): Promise<MeetingBooking[]> {
  const pool = getDbPool();
  const now = new Date();
  const [rows] = (await pool.query(
    `SELECT * FROM ai_live_meeting_bookings WHERE status = 'scheduled' AND student_joined = 0`
  )) as [Array<Record<string, unknown>>, unknown];

  const expired: MeetingBooking[] = [];
  for (const r of rows) {
    try {
      const scheduledMs = new Date(`${r.date}T${r.start_time}:00`).getTime();
      const graceMs = (Number(r.grace_period_minutes || 2) + Number(r.duration_minutes || 15)) * 60 * 1000;
      if (Date.now() > scheduledMs + graceMs) {
        await pool.query(`UPDATE ai_live_meeting_bookings SET status = 'missed', updated_at = ? WHERE id = ?`, [now, r.id]);
        if (r.slot_id) {
          await pool.query(
            `UPDATE ai_live_meeting_slots SET is_booked = 0, booking_id = NULL, meet_url = NULL, updated_at = ? WHERE id = ?`,
            [now, r.slot_id]
          );
        }
        expired.push(formatBookingRow({ ...r, status: 'missed' }));
      }
    } catch {
      // ignore date parse issues
    }
  }
  return expired;
}

export async function dbGetDefaultMeetUrl(): Promise<string | undefined> {
  const pool = getDbPool();
  const [rows] = (await pool.query(
    `SELECT setting_value FROM ai_live_chat_settings WHERE setting_key = 'default_meet_url'`
  )) as [Array<Record<string, unknown>>, unknown];
  return rows[0]?.setting_value ? String(rows[0].setting_value) : undefined;
}

// ----------------------------------------------------
// ROW FORMATTERS
// ----------------------------------------------------

function formatSessionRow(r: Record<string, unknown>): LiveChatSession {
  return {
    id: String(r.id),
    subInstituteId: String(r.sub_institute_id || '1'),
    userId: String(r.user_id),
    userName: String(r.user_name || 'Student'),
    userRole: String(r.user_role || 'Student'),
    status: (r.status as LiveChatSessionStatus) || 'waiting',
    adminId: r.admin_id ? String(r.admin_id) : undefined,
    adminName: r.admin_name ? String(r.admin_name) : undefined,
    pagePath: String(r.page_path || '/dashboard'),
    pageTitle: r.page_title ? String(r.page_title) : undefined,
    initialGreetingSent: Boolean(r.initial_greeting_sent),
    unreadCountForAdmin: Number(r.unread_count_for_admin || 0),
    unreadCountForUser: Number(r.unread_count_for_user || 0),
    messagesExchangedCount: Number(r.messages_exchanged_count || 0),
    meetSuggested: Boolean(r.meet_suggested),
    lastMessageText: r.last_message_text ? String(r.last_message_text) : undefined,
    lastMessageTime: r.last_message_time ? new Date(r.last_message_time as string | Date).toISOString() : undefined,
    meetUrl: r.active_meet_url ? String(r.active_meet_url) : undefined,
    activeMeetUrl: r.active_meet_url ? String(r.active_meet_url) : undefined,
    activeBookingId: r.active_booking_id ? String(r.active_booking_id) : undefined,
    createdAt: new Date(r.created_at as string | Date).toISOString(),
    updatedAt: new Date(r.updated_at as string | Date).toISOString(),
  };
}

function formatMessageRow(r: Record<string, unknown>): LiveChatMessage {
  let bookingDetails: Partial<MeetingBooking> | undefined = undefined;
  if (r.booking_details) {
    try {
      bookingDetails = typeof r.booking_details === 'string' ? JSON.parse(r.booking_details) : r.booking_details;
    } catch {
      // ignore parse error
    }
  }

  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    senderId: String(r.sender_id),
    senderName: String(r.sender_name),
    senderRole: (r.sender_role as LiveChatMessage['senderRole']) || 'user',
    type: (r.type as LiveChatMessage['type']) || 'text',
    text: String(r.text || ''),
    meetUrl: r.meet_url ? String(r.meet_url) : undefined,
    bookingDetails,
    createdAt: new Date(r.created_at as string | Date).toISOString(),
  };
}

function formatSlotRow(r: Record<string, unknown>): MeetingSlot {
  return {
    id: String(r.id),
    adminId: String(r.admin_id),
    adminName: String(r.admin_name || 'Admin Staff'),
    subInstituteId: String(r.sub_institute_id || '1'),
    date: String(r.date),
    startTime: String(r.start_time),
    endTime: String(r.end_time),
    durationMinutes: Number(r.duration_minutes || 15),
    isBooked: Boolean(r.is_booked),
    bookingId: r.booking_id ? String(r.booking_id) : undefined,
    meetUrl: r.meet_url ? String(r.meet_url) : undefined,
  };
}

function formatBookingRow(r: Record<string, unknown>): MeetingBooking {
  return {
    id: String(r.id),
    slotId: String(r.slot_id),
    sessionId: String(r.session_id),
    studentId: String(r.student_id),
    studentName: String(r.student_name || 'Student'),
    adminId: String(r.admin_id),
    adminName: String(r.admin_name || 'Academic Administrator'),
    subInstituteId: String(r.sub_institute_id || '1'),
    date: String(r.date),
    startTime: String(r.start_time),
    endTime: String(r.end_time),
    durationMinutes: Number(r.duration_minutes || 15),
    status: (r.status as MeetingBooking['status']) || 'scheduled',
    meetUrl: String(r.meet_url),
    studentJoined: Boolean(r.student_joined),
    adminJoined: Boolean(r.admin_joined),
    gracePeriodMinutes: Number(r.grace_period_minutes || 2),
    reminderSent: Boolean(r.reminder_sent),
    createdAt: new Date(r.created_at as string | Date).toISOString(),
    updatedAt: new Date(r.updated_at as string | Date).toISOString(),
  };
}
