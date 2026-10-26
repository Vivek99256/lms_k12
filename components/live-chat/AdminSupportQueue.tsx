'use client';

import { useCallback, useState } from 'react';
import { Calendar, Clock, MessageSquare, RefreshCw, ShieldCheck, UserCheck, Video } from 'lucide-react';
import { AdminAvailabilityToggle } from './AdminAvailabilityToggle';
import { AdminSlotConfigModal } from './AdminSlotConfigModal';
import type { AdminAvailabilityStatus, LiveChatSession, MeetingSlot } from '@/lib/live-chat/types';

interface AdminSupportQueueProps {
  queue: LiveChatSession[];
  activeSessionId: string | null;
  adminAvailability?: AdminAvailabilityStatus;
  onUpdateAdminAvailability?: (status: AdminAvailabilityStatus) => void;
  onSelectSession: (sessionId: string) => void;
  onClaimSession: (sessionId: string) => void;
  onRefresh: () => void;
  onConfigureSlots?: (
    dateStr: string,
    slotsList: Array<{ startTime: string; endTime: string; durationMinutes?: number }>,
    overwrite?: boolean,
    meetUrl?: string
  ) => Promise<void>;
  fetchAvailableSlots?: (date?: string, options?: { includeBooked?: boolean }) => Promise<MeetingSlot[]>;
  defaultMeetUrl?: string;
}

export function AdminSupportQueue({
  queue,
  activeSessionId,
  adminAvailability = 'available',
  defaultMeetUrl,
  onUpdateAdminAvailability,
  onSelectSession,
  onClaimSession,
  onRefresh,
  onConfigureSlots,
  fetchAvailableSlots,
}: AdminSupportQueueProps) {
  const [showSlotConfig, setShowSlotConfig] = useState(false);
  const waitingSessions = queue.filter((s) => s.status === 'waiting');
  const activeSessions = queue.filter((s) => s.status === 'active');

  const handleFetchSlotsForAdmin = useCallback(
    (d: string) => (fetchAvailableSlots ? fetchAvailableSlots(d, { includeBooked: true }) : Promise.resolve([])),
    [fetchAvailableSlots]
  );

  const formatWaitTime = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#0D6EFD]" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Admin Support Queue ({queue.length})
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          {onConfigureSlots ? (
            <button
              type="button"
              onClick={() => setShowSlotConfig(true)}
              className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              title="Configure time slots"
            >
              <Calendar className="size-3.5" />
              <span className="hidden sm:inline">Slots</span>
            </button>
          ) : null}

          {onUpdateAdminAvailability ? (
            <AdminAvailabilityToggle
              status={adminAvailability}
              onStatusChange={onUpdateAdminAvailability}
            />
          ) : null}

          <button
            type="button"
            onClick={onRefresh}
            className="flex size-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200/60 hover:text-gray-900"
            title="Refresh queue"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
            <UserCheck className="size-10 mb-2 opacity-50 text-emerald-500" />
            <p className="text-sm font-medium text-gray-600">All caught up!</p>
            <p className="text-xs text-gray-400 mt-0.5">No pending live chat requests from users.</p>
          </div>
        ) : (
          <>
            {waitingSessions.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Waiting for Response ({waitingSessions.length})</span>
                </div>
                {waitingSessions.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3 transition-all ${
                      activeSessionId === item.id
                        ? 'border-[#0D6EFD] bg-blue-50/40 shadow-sm'
                        : 'border-amber-200 bg-amber-50/30 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900">{item.userName}</span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            {item.userRole}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-600">
                          {item.lastMessageText || 'Requested live assistance'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                        <Clock className="size-3" />
                        <span>{formatWaitTime(item.createdAt)}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="truncate text-[10px] font-mono text-gray-400">
                        On: {item.pagePath}
                      </span>
                      <button
                        type="button"
                        onClick={() => onClaimSession(item.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#0D6EFD] to-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:brightness-105 active:scale-95"
                      >
                        <MessageSquare className="size-3" />
                        <span>Accept Chat</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeSessions.length > 0 ? (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>In Progress ({activeSessions.length})</span>
                </div>
                {activeSessions.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3 transition-all cursor-pointer ${
                      activeSessionId === item.id
                        ? 'border-[#0D6EFD] bg-blue-50/40 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => onSelectSession(item.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900">{item.userName}</span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                            {item.userRole}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                          {item.lastMessageText || 'Active conversation'}
                        </p>
                      </div>
                      {item.meetUrl ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          <Video className="size-3" /> Meet Live
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="text-[10px] text-gray-500">
                        Agent: <strong className="font-semibold text-gray-700">{item.adminName || 'Admin'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSession(item.id);
                        }}
                        className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Open Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      {showSlotConfig && onConfigureSlots ? (
        <AdminSlotConfigModal
          isOpen={showSlotConfig}
          onClose={() => setShowSlotConfig(false)}
          onSaveSlots={onConfigureSlots}
          fetchSlotsForAdmin={handleFetchSlotsForAdmin}
          initialMeetUrl={defaultMeetUrl}
        />
      ) : null}
    </div>
  );
}
