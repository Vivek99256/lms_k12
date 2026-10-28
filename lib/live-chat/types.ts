export type LiveChatSessionStatus = 'waiting' | 'active' | 'closed';

export type LiveChatSenderRole = 'user' | 'admin' | 'system';

export type LiveChatMessageType =
  | 'text'
  | 'meet'
  | 'system'
  | 'meet_suggestion'
  | 'booking_confirmation'
  | 'booking_missed';

export type AdminAvailabilityStatus = 'available' | 'busy' | 'offline';

export type MeetingBookingStatus =
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'missed'
  | 'cancelled';

export interface LiveChatUser {
  userId: string;
  userName: string;
  userRole: string;
  userProfile?: string;
  subInstituteId?: string | number;
  clientId?: string;
  token?: string;
}

export interface AdminPresence {
  adminId: string;
  adminName: string;
  subInstituteId: string | number;
  status: AdminAvailabilityStatus;
  lastSeen: string;
}

export interface MeetingSlot {
  id: string;
  adminId: string;
  adminName: string;
  subInstituteId: string | number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number; // default 15
  isBooked: boolean;
  bookingId?: string;
  meetUrl?: string;
}

export interface MeetingBooking {
  id: string;
  slotId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  adminId: string;
  adminName: string;
  subInstituteId: string | number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number; // 10-15 mins (default 15)
  status: MeetingBookingStatus;
  meetUrl: string;
  studentJoined: boolean;
  adminJoined: boolean;
  studentJoinedAt?: string;
  adminJoinedAt?: string;
  gracePeriodMinutes: number; // default 2
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LiveChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: LiveChatSenderRole;
  type: LiveChatMessageType;
  text: string;
  meetUrl?: string;
  bookingDetails?: Partial<MeetingBooking>;
  createdAt: string;
}

export interface LiveChatSession {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  subInstituteId: string | number;
  pagePath: string;
  pageTitle?: string;
  status: LiveChatSessionStatus;
  adminId?: string;
  adminName?: string;
  meetUrl?: string;
  activeMeetUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageText?: string;
  lastMessageTime?: string;
  unreadCountForUser: number;
  unreadCountForAdmin: number;
  initialGreetingSent?: boolean;
  messagesExchangedCount?: number;
  meetSuggested?: boolean;
  activeBookingId?: string;
}

export interface CreateSessionRequest {
  user: LiveChatUser;
  pagePath?: string;
  pageTitle?: string;
  initialMessage?: string;
}

export interface SendMessageRequest {
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: LiveChatSenderRole;
  text: string;
  type?: LiveChatMessageType;
  meetUrl?: string;
  bookingDetails?: Partial<MeetingBooking>;
}

export interface CreateMeetRequest {
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: LiveChatSenderRole;
  customMeetUrl?: string;
}

export interface BookSlotRequest {
  slotId: string;
  sessionId: string;
  student: LiveChatUser;
}

export interface ConfigureSlotsRequest {
  adminId: string;
  adminName: string;
  subInstituteId: string | number;
  date: string; // YYYY-MM-DD
  slots: Array<{
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    durationMinutes?: number;
  }>;
  defaultMeetUrl?: string;
}
