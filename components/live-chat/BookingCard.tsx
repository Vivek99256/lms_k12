'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Video,
  X,
} from 'lucide-react';
import type { MeetingBooking } from '@/lib/live-chat/types';

interface BookingCardProps {
  booking?: Partial<MeetingBooking>;
  isMissed?: boolean;
  isCurrentUserStudent: boolean;
  onJoinMeeting: (bookingId: string, meetUrl: string) => void;
  onCancelMeeting?: (bookingId: string) => void;
  onReschedule?: () => void;
}

export function BookingCard({
  booking,
  isMissed = false,
  isCurrentUserStudent,
  onJoinMeeting,
  onCancelMeeting,
  onReschedule,
}: BookingCardProps) {
  const [cancelling, setCancelling] = useState(false);

  if (isMissed) {
    return (
      <div className="my-2 max-w-[340px] overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 via-orange-50/50 to-white p-4 shadow-xs">
        <div className="flex items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <AlertTriangle className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-red-900">Meeting Expired</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-red-700">
              This session was not joined within the 2-minute grace period and has been marked as missed.
            </p>
          </div>
        </div>

        {onReschedule ? (
          <div className="mt-3 border-t border-red-100 pt-2.5">
            <button
              type="button"
              onClick={onReschedule}
              className="w-full rounded-xl bg-red-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-xs transition-all hover:bg-red-700 active:scale-98"
            >
              Book Another Available Slot
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!booking) return null;

  const isConfirmed = booking.status === 'scheduled' || booking.status === 'active';
  const duration = booking.durationMinutes || 15;

  return (
    <div className="my-2 max-w-[340px] overflow-hidden rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-white p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xs shadow-emerald-500/20">
            <Video className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-gray-900">1:1 Google Meet Call</h4>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 uppercase">
                {booking.status}
              </span>
            </div>
            <p className="text-[11px] text-gray-600">
              With <strong>{booking.adminName || 'Admin'}</strong>
            </p>
          </div>
        </div>
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
      </div>

      <div className="mt-3 space-y-1.5 rounded-xl border border-emerald-200/60 bg-white/80 p-2.5 text-xs text-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 text-emerald-700 shrink-0" />
          <span className="font-medium text-gray-900">{booking.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-emerald-700 shrink-0" />
          <span>
            {booking.startTime} - {booking.endTime || `${booking.startTime} (+${duration}m)`}
          </span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
            {duration} mins
          </span>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-gray-500 italic">
        *Grace period: please join within 2 minutes of scheduled time.
      </p>

      <div className="mt-3 flex items-center gap-2">
        {booking.meetUrl && isConfirmed ? (
          <button
            type="button"
            onClick={() => onJoinMeeting(booking.id || '', booking.meetUrl || '')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:brightness-105 active:scale-98"
          >
            <Video className="size-3.5" />
            <span>Join Google Meet</span>
            <ExternalLink className="size-3 opacity-80" />
          </button>
        ) : null}

        {onCancelMeeting && booking.id && isConfirmed ? (
          <button
            type="button"
            onClick={() => {
              if (confirm('Are you sure you want to cancel this meeting?')) {
                setCancelling(true);
                onCancelMeeting(booking.id || '');
              }
            }}
            disabled={cancelling}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Cancel booking"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
