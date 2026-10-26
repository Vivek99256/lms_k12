'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCheck,
  ExternalLink,
  Headphones,
  Loader2,
  Send,
  Settings,
  Shield,
  User,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { GoogleMeetCard } from './GoogleMeetCard';
import { BookingCard } from './BookingCard';
import { MeetSuggestionCard } from './MeetSuggestionCard';
import { SlotPickerModal } from './SlotPickerModal';
import { AdminAvailabilityToggle } from './AdminAvailabilityToggle';
import { AdminSlotConfigModal } from './AdminSlotConfigModal';
import type {
  AdminAvailabilityStatus,
  LiveChatMessage,
  LiveChatSession,
  MeetingBooking,
  MeetingSlot,
} from '@/lib/live-chat/types';
import type { LiveChatNotification } from '@/hooks/use-live-admin-chat';

interface LiveAdminChatViewProps {
  session: LiveChatSession | null;
  messages: LiveChatMessage[];
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  isAdminOnline: boolean;
  adminAvailability?: AdminAvailabilityStatus;
  defaultMeetUrl?: string;
  onUpdateAdminAvailability?: (status: AdminAvailabilityStatus) => void;
  onSendMessage: (text: string) => Promise<void>;
  onStartGoogleMeet: (customUrl?: string) => Promise<string | null>;
  onCloseSession: () => Promise<void>;
  onSwitchToAi: () => void;
  onBookSlot?: (slotId: string) => Promise<{ success: boolean; booking?: MeetingBooking; error?: string }>;
  onJoinMeeting?: (bookingId: string, meetUrl: string) => void;
  onCancelMeeting?: (bookingId: string) => void;
  fetchAvailableSlots?: (date?: string, options?: { includeBooked?: boolean }) => Promise<MeetingSlot[]>;
  onConfigureSlots?: (
    dateStr: string,
    slotsList: Array<{ startTime: string; endTime: string; durationMinutes?: number }>,
    overwrite?: boolean,
    meetUrl?: string
  ) => Promise<void>;
  isSending?: boolean;
  isMeetStarting?: boolean;
  adminQueue?: LiveChatSession[];
  onSelectSession?: (sessionId: string) => void;
  onSwitchToQueue?: () => void;
  notification?: LiveChatNotification | null;
  onDismissNotification?: () => void;
}

export function LiveAdminChatView({
  session,
  messages,
  currentUserId,
  currentUserName,
  isAdmin,
  isAdminOnline,
  adminAvailability = 'available',
  defaultMeetUrl,
  onUpdateAdminAvailability,
  onSendMessage,
  onStartGoogleMeet,
  onCloseSession,
  onSwitchToAi,
  onBookSlot,
  onJoinMeeting,
  onCancelMeeting,
  fetchAvailableSlots,
  onConfigureSlots,
  isSending = false,
  isMeetStarting = false,
  adminQueue = [],
  onSelectSession,
  onSwitchToQueue,
  notification,
  onDismissNotification,
}: LiveAdminChatViewProps) {
  const [inputText, setInputText] = useState('');
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [showAdminSlotConfig, setShowAdminSlotConfig] = useState(false);
  const [showInstantMeetModal, setShowInstantMeetModal] = useState(false);
  const [instantMeetUrl, setInstantMeetUrl] = useState(defaultMeetUrl || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultMeetUrl && !instantMeetUrl) {
      setInstantMeetUrl(defaultMeetUrl);
    }
  }, [defaultMeetUrl, instantMeetUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFetchSlotsForAdmin = useCallback(
    (d: string) => (fetchAvailableSlots ? fetchAvailableSlots(d, { includeBooked: true }) : Promise.resolve([])),
    [fetchAvailableSlots]
  );

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    const text = inputText;
    setInputText('');
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isConnected = session?.status === 'active';
  const isClosed = session?.status === 'closed';

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Live Chat Sub-Header */}
      <div className="flex items-center justify-between border-b border-gray-200/80 bg-white/95 px-4 py-3 shadow-2xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSwitchToAi}
            className="flex size-8 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            title="Return to AI Assistant"
          >
            <ArrowLeft className="size-4" />
          </button>

          <div className="relative">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0D6EFD] to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Headphones className="size-4" />
            </div>
            {/* Dynamic Status Indicator */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white ${
                isAdmin
                  ? adminAvailability === 'available'
                    ? 'bg-emerald-500'
                    : 'bg-red-500'
                  : isAdminOnline
                    ? 'bg-emerald-500'
                    : 'bg-red-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                {isAdmin
                  ? session ? `Chat with ${session.userName}` : 'Live Support Console'
                  : `Chat with Admin`}
              </h3>

              {/* Student switcher for Admin when multiple chats exist in queue */}
              {isAdmin && adminQueue && adminQueue.length > 1 ? (
                <select
                  value={session?.id || ''}
                  onChange={(e) => onSelectSession?.(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700 outline-none hover:bg-gray-100 cursor-pointer"
                  title="Switch student conversation"
                >
                  {adminQueue.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.userName} ({s.status})
                    </option>
                  ))}
                </select>
              ) : null}

              {/* Dynamic Online / Offline status badge or Admin toggle */}
              {isAdmin ? (
                onUpdateAdminAvailability ? (
                  <AdminAvailabilityToggle
                    status={adminAvailability}
                    onStatusChange={onUpdateAdminAvailability}
                  />
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      adminAvailability === 'available'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        adminAvailability === 'available' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    />
                    {adminAvailability === 'available' ? 'Online' : 'Offline'}
                  </span>
                )
              ) : isAdminOnline ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  Offline
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-gray-500">
              {isAdmin
                ? session
                  ? `Role: ${session.userRole || 'Student'} • Institute #${session.subInstituteId || '1'}`
                  : `Administrator: ${currentUserName} • Manage student queries & meetings`
                : isAdminOnline
                  ? 'Connected with an institute administrator'
                  : 'Administrator is currently offline. Messages will be queued.'}
            </p>
          </div>
        </div>

        {/* Quick Actions in Header */}
        <div className="flex items-center gap-1.5">
          {/* Admin Slot Configuration Modal trigger */}
          {isAdmin && onConfigureSlots ? (
            <button
              type="button"
              onClick={() => setShowAdminSlotConfig(true)}
              className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-100 active:scale-95"
              title="Configure available dates & 15m meeting slots"
            >
              <Settings className="size-3.5" />
              <span className="hidden sm:inline">Configure Slots</span>
            </button>
          ) : null}

          {/* Book Google Meet Session button */}
          {fetchAvailableSlots && onBookSlot && !isClosed ? (
            <button
              type="button"
              onClick={() => setShowSlotPicker(true)}
              className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#0D6EFD] transition-all hover:bg-blue-100 active:scale-95"
              title="Schedule a 10-15 min Google Meet Session"
            >
              <Calendar className="size-3.5" />
              <span className="hidden sm:inline">Book Meet</span>
            </button>
          ) : null}

          {/* Instant Google Meet Call button */}
          {session && !isClosed ? (
            <button
              type="button"
              onClick={() => {
                if (isAdmin) {
                  setShowInstantMeetModal(true);
                } else {
                  void onStartGoogleMeet();
                }
              }}
              disabled={isMeetStarting}
              className="flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
              title="Start or Join Instant Google Meet Call"
            >
              {isMeetStarting ? (
                <Loader2 className="size-3.5 animate-spin text-emerald-700" />
              ) : (
                <Video className="size-3.5 text-emerald-600" />
              )}
              <span className="hidden sm:inline">Google Meet</span>
            </button>
          ) : null}

          {session && !isClosed ? (
            <button
              type="button"
              onClick={() => void onCloseSession()}
              className="flex size-8 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Close support session"
            >
              <XCircle className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Live Meeting Notifications & Starting Reminders (Requirement 4) */}
      {notification ? (
        <div
          className={`flex items-center justify-between border-b px-4 py-2.5 text-xs transition-all ${
            notification.type === 'meeting_starting'
              ? 'border-amber-300 bg-amber-50 text-amber-950 animate-pulse'
              : notification.type === 'new_booking'
                ? 'border-blue-200 bg-blue-50/90 text-blue-950'
                : 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <div
              className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-white ${
                notification.type === 'meeting_starting'
                  ? 'bg-amber-600'
                  : notification.type === 'new_booking'
                    ? 'bg-[#0D6EFD]'
                    : 'bg-emerald-600'
              }`}
            >
              {notification.type === 'meeting_starting' ? (
                <Video className="size-3.5" />
              ) : notification.type === 'new_booking' ? (
                <Calendar className="size-3.5" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="font-bold mr-1">{notification.title}:</span>
              <span className="text-[11px] opacity-90">{notification.message}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {notification.meetUrl ? (
              <a
                href={notification.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition-all hover:brightness-105 active:scale-95 ${
                  notification.type === 'meeting_starting'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Video className="size-3" />
                <span>Join Google Meet ↗</span>
              </a>
            ) : null}
            {onDismissNotification ? (
              <button
                type="button"
                onClick={onDismissNotification}
                className="rounded-lg p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700"
                title="Dismiss notification"
              >
                <XCircle className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Offline Notice Banner if Admin is offline */}
      {!isAdminOnline && !isAdmin ? (
        <div className="flex items-center justify-between border-b border-red-200/80 bg-red-50/70 px-4 py-2 text-xs text-red-900">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500" />
            <span>Administrator is currently <strong>Offline</strong>. Leave your message or book a time slot.</span>
          </div>
          {fetchAvailableSlots && onBookSlot ? (
            <button
              type="button"
              onClick={() => setShowSlotPicker(true)}
              className="font-bold text-red-700 underline hover:text-red-900"
            >
              Book slot
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Messages Scroll Area or Admin Console Empty State */}
      {isAdmin && !session ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="size-14 rounded-3xl bg-blue-50 text-[#0D6EFD] flex items-center justify-center mb-3 shadow-inner">
            <Headphones className="size-7" />
          </div>
          <h4 className="text-sm font-bold text-gray-900">Admin Support Console</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">
            Admin status is currently <strong className={adminAvailability === 'available' ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>{adminAvailability === 'available' ? 'Online' : 'Offline'}</strong>.
            When a student opens chat or sends a message, it will automatically connect here in real time.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {onConfigureSlots ? (
              <button
                type="button"
                onClick={() => setShowAdminSlotConfig(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <Settings className="size-3.5" />
                <span>Configure Available Slots</span>
              </button>
            ) : null}
            {onSwitchToQueue ? (
              <button
                type="button"
                onClick={onSwitchToQueue}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Shield className="size-3.5 text-gray-500" />
                <span>View Queue ({adminQueue?.length || 0})</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="rounded-full border border-gray-200/70 bg-gray-50/90 px-3.5 py-1 text-[11px] font-medium text-gray-500 shadow-2xs">
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.type === 'meet') {
            return (
              <div
                key={msg.id}
                className={`flex ${
                  String(msg.senderId) === String(currentUserId) ? 'justify-end' : 'justify-start'
                }`}
              >
                <GoogleMeetCard
                  meetUrl={msg.meetUrl || session?.meetUrl || 'https://meet.google.com'}
                  senderName={msg.senderName}
                  createdAt={msg.createdAt}
                  isCurrentUser={String(msg.senderId) === String(currentUserId)}
                />
              </div>
            );
          }

          if (msg.type === 'meet_suggestion') {
            return (
              <div key={msg.id} className="flex justify-center">
                <MeetSuggestionCard onOpenBooking={() => setShowSlotPicker(true)} />
              </div>
            );
          }

          if (msg.type === 'booking_confirmation') {
            return (
              <div key={msg.id} className="flex justify-start">
                <BookingCard
                  booking={msg.bookingDetails}
                  isCurrentUserStudent={!isAdmin}
                  onJoinMeeting={(id, url) => onJoinMeeting?.(id, url)}
                  onCancelMeeting={onCancelMeeting}
                  onReschedule={() => setShowSlotPicker(true)}
                />
              </div>
            );
          }

          if (msg.type === 'booking_missed') {
            return (
              <div key={msg.id} className="flex justify-center">
                <BookingCard
                  isMissed={true}
                  isCurrentUserStudent={!isAdmin}
                  onJoinMeeting={() => {}}
                  onReschedule={() => setShowSlotPicker(true)}
                />
              </div>
            );
          }

          const isUser = String(msg.senderId) === String(currentUserId);
          const isMsgFromAdmin = msg.senderRole === 'admin';

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser ? (
                <div
                  className={`mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-white shadow-xs ${
                    isMsgFromAdmin
                      ? 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                      : 'bg-gradient-to-tr from-[#0D6EFD] to-blue-500'
                  }`}
                >
                  {isMsgFromAdmin ? <Shield className="size-3.5" /> : <User className="size-3.5" />}
                </div>
              ) : null}

              <div
                className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs leading-5 shadow-xs ${
                  isUser
                    ? 'bg-[#0D6EFD] text-white rounded-br-xs shadow-blue-500/10'
                    : 'border border-gray-200/90 bg-white text-gray-800 rounded-bl-xs'
                }`}
              >
                {!isUser ? (
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900">{msg.senderName}</span>
                    {isMsgFromAdmin ? (
                      <span className="rounded bg-indigo-50 px-1 py-0.2 text-[9px] font-bold text-indigo-700 uppercase">
                        Admin
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                <div
                  className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                    isUser ? 'text-blue-100' : 'text-gray-400'
                  }`}
                >
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isUser ? <CheckCheck className="size-3 text-blue-200" /> : null}
                </div>
              </div>

              {isUser ? (
                <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-[#0D6EFD]">
                  <User className="size-3.5" />
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts if session has few messages */}
      {messages.length <= 3 && !isAdmin ? (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2">
          <p className="mb-1.5 text-[10px] font-medium text-gray-500">Quick options:</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setShowSlotPicker(true)}
              className="flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D6EFD] transition-colors hover:bg-blue-50"
            >
              <Calendar className="size-3" />
              <span>Book a Google Meet Session</span>
            </button>
            {[
              'I need help reviewing my fees status.',
              'Where can I find today’s timetable?',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void onSendMessage(prompt)}
                disabled={isSending}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-[#0D6EFD]/30 hover:bg-blue-50 hover:text-[#0D6EFD]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Bottom Message Input Bar */}
      <div className="border-t border-gray-200/80 bg-white/90 p-3 backdrop-blur-md">
        {isClosed ? (
          <div className="flex items-center justify-between rounded-xl bg-gray-100 px-4 py-2.5 text-xs text-gray-600">
            <span>This live session has ended.</span>
            <button
              type="button"
              onClick={onSwitchToAi}
              className="font-semibold text-[#0D6EFD] hover:underline"
            >
              Return to AI Chat
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Quick Action: Book Slot */}
            <button
              type="button"
              onClick={() => setShowSlotPicker(true)}
              title="Schedule a 10-15m Google Meet Session"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-blue-50 text-[#0D6EFD] transition-colors hover:bg-blue-100 hover:text-blue-800"
            >
              <Calendar className="size-4" />
            </button>

            {/* Quick Action: Instant Google Meet Call */}
            <button
              type="button"
              onClick={() => void onStartGoogleMeet()}
              disabled={isMeetStarting}
              title="Start Instant Google Meet Call"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-50"
            >
              {isMeetStarting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Video className="size-4" />
              )}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isAdmin
                  ? 'Reply to user...'
                  : isConnected
                    ? 'Type message to admin...'
                    : 'Type your message (admin will see it immediately)...'
              }
              disabled={isSending}
              className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 shadow-2xs placeholder:text-gray-400 outline-none transition-all focus-visible:border-[#0D6EFD]/40 focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/15"
            />

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!inputText.trim() || isSending}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#0D6EFD] to-indigo-600 text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              title="Send message"
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
        )}
      </div>
      </>
      )}

      {/* Student/Admin Slot Picker Modal */}
      {fetchAvailableSlots && onBookSlot ? (
        <SlotPickerModal
          isOpen={showSlotPicker}
          onClose={() => setShowSlotPicker(false)}
          onBookSlot={onBookSlot}
          fetchSlots={fetchAvailableSlots}
          isAdmin={isAdmin}
          onOpenSlotConfig={() => setShowAdminSlotConfig(true)}
        />
      ) : null}

      {/* Admin Slot Configuration Modal */}
      {isAdmin && onConfigureSlots ? (
        <AdminSlotConfigModal
          isOpen={showAdminSlotConfig}
          onClose={() => setShowAdminSlotConfig(false)}
          onSaveSlots={onConfigureSlots}
          fetchSlotsForAdmin={handleFetchSlotsForAdmin}
          initialMeetUrl={defaultMeetUrl}
        />
      ) : null}

      {/* Instant Google Meet Launch Modal */}
      {showInstantMeetModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                  <Video className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Start Google Meet Call</h3>
                  <p className="text-[11px] text-gray-500">Initiate an active video session with the student</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstantMeetModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-950">Active Google Meet Link:</span>
                  <button
                    type="button"
                    onClick={() => window.open('https://meet.google.com/new', '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    <ExternalLink className="size-3" />
                    <span>Get Real Code (meet.google.com/new)</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Enter or verify your Google Meet link. When started, both you and the student will connect to this exact room:
                </p>
                <input
                  type="url"
                  value={instantMeetUrl}
                  onChange={(e) => setInstantMeetUrl(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-800 shadow-2xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowInstantMeetModal(false)}
                className="rounded-xl border border-gray-200 px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMeetStarting}
                onClick={async () => {
                  const url = instantMeetUrl.trim() || undefined;
                  setShowInstantMeetModal(false);
                  await onStartGoogleMeet(url);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-95 disabled:opacity-50"
              >
                {isMeetStarting ? <Loader2 className="size-3.5 animate-spin" /> : <Video className="size-3.5" />}
                <span>Start Video Call</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
