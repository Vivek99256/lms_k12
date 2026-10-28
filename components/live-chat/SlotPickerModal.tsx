'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Loader2,
  Settings,
  Video,
  X,
} from 'lucide-react';
import { formatLocalDate } from '@/lib/live-chat/date-utils';
import type { MeetingBooking, MeetingSlot } from '@/lib/live-chat/types';

interface SlotPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookSlot: (slotId: string) => Promise<{ success: boolean; booking?: MeetingBooking; error?: string }>;
  fetchSlots: (date?: string, options?: { includeBooked?: boolean }) => Promise<MeetingSlot[]>;
  isAdmin?: boolean;
  onOpenSlotConfig?: () => void;
}

export function SlotPickerModal({
  isOpen,
  onClose,
  onBookSlot,
  fetchSlots,
  isAdmin = false,
  onOpenSlotConfig,
}: SlotPickerModalProps) {
  const todayStr = formatLocalDate(new Date());
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = formatLocalDate(tomorrowDate);
  const dayAfterDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const dayAfterStr = formatLocalDate(dayAfterDate);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [slots, setSlots] = useState<MeetingSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSlotsRef = useRef(fetchSlots);
  fetchSlotsRef.current = fetchSlots;

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function load() {
      setLoading(true);
      setErrorMessage(null);
      const data = await fetchSlotsRef.current(selectedDate, { includeBooked: true });
      if (active) {
        setSlots(data || []);
        setSelectedSlotId(null);
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [isOpen, selectedDate]);

  // Periodic background sync while modal is open so slots booked by other users immediately show as Booked
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const latest = await fetchSlotsRef.current(selectedDate, { includeBooked: true });
      if (latest) {
        setSlots(latest);
        setSelectedSlotId((current) => {
          if (current) {
            const found = latest.find((s) => s.id === current);
            if (!found || found.isBooked) {
              setErrorMessage('The selected slot was just booked by another user. Please choose another slot.');
              return null;
            }
          }
          return current;
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedSlotId || bookingLoading) return;
    setBookingLoading(true);
    setErrorMessage(null);

    const result = await onBookSlot(selectedSlotId);
    setBookingLoading(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || 'This slot is no longer available. Please select another slot.');
      // Refresh slots
      const refreshed = await fetchSlots(selectedDate, { includeBooked: true });
      setSlots(refreshed || []);
      setSelectedSlotId(null);
    }
  };

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <Video className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Book Google Meet Session</h3>
              <p className="text-[11px] text-gray-500">10–15 mins 1:1 administrator session</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200/60 hover:text-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5">
          {/* Date Selector Tabs */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700">Select Date:</label>
              {isAdmin && onOpenSlotConfig ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSlotConfig();
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#0D6EFD] hover:underline"
                >
                  <Settings className="size-3" />
                  <span>Configure Slots</span>
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-all ${
                  selectedDate === todayStr
                    ? 'border-[#0D6EFD] bg-blue-50/80 text-[#0D6EFD] shadow-2xs font-bold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CalendarIcon className="size-3.5" />
                <span>Today</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(tomorrowStr)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-all ${
                  selectedDate === tomorrowStr
                    ? 'border-[#0D6EFD] bg-blue-50/80 text-[#0D6EFD] shadow-2xs font-bold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CalendarIcon className="size-3.5" />
                <span>Tomorrow</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(dayAfterStr)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-all ${
                  selectedDate === dayAfterStr
                    ? 'border-[#0D6EFD] bg-blue-50/80 text-[#0D6EFD] shadow-2xs font-bold'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CalendarIcon className="size-3.5" />
                <span>Day After</span>
              </button>
            </div>

            {/* Custom Date Input for Any Future Date */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 font-medium shrink-0">Other date:</span>
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-2xs outline-none focus:border-[#0D6EFD]"
              />
            </div>
          </div>

          {/* Time Slots Grid */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700">Time Slots ({selectedDate}):</label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 font-medium">
                  {slots.filter((s) => !s.isBooked).length} available
                </span>
                {slots.some((s) => s.isBooked) ? (
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                    {slots.filter((s) => s.isBooked).length} booked
                  </span>
                ) : null}
              </div>
            </div>

            {loading ? (
              <div className="flex h-36 items-center justify-center text-xs text-gray-400">
                <Loader2 className="size-4 animate-spin mr-1.5" /> Loading slots...
              </div>
            ) : slots.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 p-4 text-center">
                <Clock className="size-6 text-gray-300 mb-1" />
                <p className="text-xs font-semibold text-gray-600">No slots configured for this date</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Please select another date above or request live chat.</p>
                {isAdmin && onOpenSlotConfig ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSlotConfig();
                    }}
                    className="mt-2 text-xs font-bold text-[#0D6EFD] underline"
                  >
                    Configure slots for {selectedDate}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1">
                {slots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  const isBooked = Boolean(slot.isBooked);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={isBooked}
                      onClick={() => !isBooked && setSelectedSlotId(slot.id)}
                      className={`flex flex-col items-center justify-center rounded-xl border py-2.5 px-1.5 text-center transition-all ${
                        isBooked
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-80'
                          : isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30 shadow-xs font-bold'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/70 active:scale-95'
                      }`}
                      title={isBooked ? 'This slot has already been booked' : `Select ${slot.startTime} – ${slot.endTime}`}
                    >
                      <span className="font-mono text-xs font-bold">{slot.startTime}</span>
                      <span className="text-[10px] mt-0.5 font-medium">
                        {isBooked ? (
                          <span className="inline-flex items-center gap-0.5 font-bold text-amber-700">
                            🔒 Booked
                          </span>
                        ) : (
                          <span className="text-gray-400">{slot.endTime}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedSlot ? (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-900">
              <div className="font-bold flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-600" />
                <span>Selected: {selectedDate} at {selectedSlot.startTime} – {selectedSlot.endTime}</span>
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Google Meet link will be generated automatically upon booking.
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mb-3 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              <AlertCircle className="size-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedSlotId || bookingLoading}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bookingLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              <span>Confirm Booking</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
