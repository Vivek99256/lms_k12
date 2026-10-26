'use client';

import { Calendar, Sparkles, Video } from 'lucide-react';

interface MeetSuggestionCardProps {
  onOpenBooking: () => void;
  onDismiss?: () => void;
}

export function MeetSuggestionCard({ onOpenBooking, onDismiss }: MeetSuggestionCardProps) {
  return (
    <div className="my-2.5 max-w-[340px] overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-white p-3.5 shadow-xs">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
          <Sparkles className="size-3.5" />
        </div>
        <h4 className="text-xs font-bold text-gray-900">Suggesting Live Call</h4>
      </div>

      <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
        It looks like your query might be faster to resolve over a 10–15 min Google Meet call with the admin.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenBooking}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0D6EFD] to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-xs shadow-blue-500/20 transition-all hover:brightness-105 active:scale-98"
        >
          <Calendar className="size-3.5" />
          <span>Book a Google Meet Session</span>
        </button>

        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl border border-gray-200 px-2.5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100"
          >
            Later
          </button>
        ) : null}
      </div>
    </div>
  );
}
