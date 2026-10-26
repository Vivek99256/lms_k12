'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { formatLocalDate } from '@/lib/live-chat/date-utils';
import type { MeetingSlot } from '@/lib/live-chat/types';

interface AdminSlotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSlots: (
    dateStr: string,
    slotsList: Array<{ startTime: string; endTime: string; durationMinutes?: number }>,
    overwrite?: boolean,
    meetUrl?: string
  ) => Promise<void>;
  fetchSlotsForAdmin?: (dateStr: string) => Promise<MeetingSlot[]>;
  initialMeetUrl?: string;
}

export function AdminSlotConfigModal({
  isOpen,
  onClose,
  onSaveSlots,
  fetchSlotsForAdmin,
  initialMeetUrl = '',
}: AdminSlotConfigModalProps) {
  const todayStr = formatLocalDate(new Date());
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = formatLocalDate(tomorrowDate);
  const dayAfterDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const dayAfterStr = formatLocalDate(dayAfterDate);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [slots, setSlots] = useState<Array<{ id?: string; startTime: string; endTime: string; durationMinutes: number; isBooked?: boolean; bookingId?: string }>>([]);
  const [meetUrl, setMeetUrl] = useState<string>(initialMeetUrl || '');
  const [newStartTime, setNewStartTime] = useState('11:00');
  const [newDuration, setNewDuration] = useState<number>(15);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep a stable ref to fetchSlotsForAdmin to prevent infinite re-render loops from inline callback props
  const fetchSlotsRef = useRef(fetchSlotsForAdmin);
  fetchSlotsRef.current = fetchSlotsForAdmin;

  // Sync initialMeetUrl if prop updates
  useEffect(() => {
    if (initialMeetUrl) {
      setMeetUrl((prev) => prev || initialMeetUrl);
    }
  }, [initialMeetUrl]);

  // Load existing slots when date changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function load() {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        if (fetchSlotsRef.current) {
          const remoteSlots = await fetchSlotsRef.current(selectedDate);
          if (active) {
            setSlots(
              remoteSlots.map((s) => ({
                id: s.id,
                startTime: s.startTime,
                endTime: s.endTime,
                durationMinutes: s.durationMinutes || 15,
                isBooked: s.isBooked,
                bookingId: s.bookingId,
              }))
            );
          }
        }
      } catch (err) {
        if (active) setErrorMessage('Failed to load slots for this date');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [isOpen, selectedDate]);

  // Periodic background sync while modal is open so new bookings immediately show as Booked
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (saving) return;
      try {
        if (fetchSlotsRef.current) {
          const remoteSlots = await fetchSlotsRef.current(selectedDate);
          if (remoteSlots) {
            setSlots(
              remoteSlots.map((s) => ({
                id: s.id,
                startTime: s.startTime,
                endTime: s.endTime,
                durationMinutes: s.durationMinutes || 15,
                isBooked: s.isBooked,
                bookingId: s.bookingId,
              }))
            );
          }
        }
      } catch {
        // Safe to ignore background sync errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, saving, selectedDate]);

  if (!isOpen) return null;

  // Compute end time based on start time + duration
  const calculateEndTime = (start: string, durationMins: number): string => {
    const [h, m] = start.split(':').map(Number);
    const totalMins = (h || 0) * 60 + (m || 0) + durationMins;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const handleAddSlot = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!newStartTime) return;

    const endTime = calculateEndTime(newStartTime, newDuration);
    const slotKey = `slot-${selectedDate}-${newStartTime}`;

    if (slots.some((s) => s.startTime === newStartTime)) {
      setErrorMessage(`A slot starting at ${newStartTime} already exists for this date.`);
      return;
    }

    const updated = [
      ...slots,
      {
        id: slotKey,
        startTime: newStartTime,
        endTime,
        durationMinutes: newDuration,
        isBooked: false,
      },
    ].sort((a, b) => a.startTime.localeCompare(b.startTime));

    setSlots(updated);
  };

  const handleDeleteSlot = (startTime: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSlots((prev) => prev.filter((s) => s.startTime !== startTime));
  };

  const handlePopulateStandardSlots = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const standardTimes = [
      '10:00',
      '10:30',
      '11:15',
      '14:00',
      '14:30',
      '15:15',
      '16:00',
      '16:30',
      '17:00',
    ];

    const newSlots = [...slots];
    standardTimes.forEach((st) => {
      if (!newSlots.some((s) => s.startTime === st)) {
        newSlots.push({
          id: `slot-${selectedDate}-${st}`,
          startTime: st,
          endTime: calculateEndTime(st, 15),
          durationMinutes: 15,
          isBooked: false,
        });
      }
    });

    setSlots(newSlots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    setSuccessMessage('Standard day slots populated. Click "Save Availability" to apply.');
  };

  const handleClearUnbooked = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    // Keep booked slots to prevent accidental data loss
    setSlots((prev) => prev.filter((s) => s.isBooked));
    setSuccessMessage('Cleared unbooked slots. Add new slots or populate standard slots.');
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = slots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
      }));

      await onSaveSlots(selectedDate, payload, true, meetUrl.trim());
      setSuccessMessage('Availability slots and Google Meet link saved successfully! Students can now book these times.');

      // Refresh
      if (fetchSlotsForAdmin) {
        const refreshed = await fetchSlotsForAdmin(selectedDate);
        setSlots(
          refreshed.map((s) => ({
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes || 15,
            isBooked: s.isBooked,
            bookingId: s.bookingId,
          }))
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save slots');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="relative flex w-full max-w-lg flex-col max-h-[90vh] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0D6EFD] to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <CalendarIcon className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Configure Available Time Slots</h3>
              <p className="text-xs text-gray-500">Set available dates and 10–15 min Google Meet slots for students</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-200/60 hover:text-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Google Meet Room Configuration */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                <Video className="size-4 text-emerald-600" />
                <span>Google Meet Room Link</span>
              </div>
              <button
                type="button"
                onClick={() => window.open('https://meet.google.com/new', '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                title="Open Google Meet in a new tab to create a real active meeting room"
              >
                <ExternalLink className="size-3" />
                <span>Get Real Code (meet.google.com/new)</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">
              Google requires meeting rooms created through an authentic Google account. Click above to launch a new room, copy the link, and paste it below:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={meetUrl}
                onChange={(e) => setMeetUrl(e.target.value)}
                placeholder="https://meet.google.com/xxx-yyyy-zzz"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-800 shadow-2xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              {meetUrl ? (
                <button
                  type="button"
                  onClick={() => setMeetUrl('')}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Clear link"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Date Selector */}
          <div>
            <label className="mb-2 block text-xs font-bold text-gray-800">
              Select Configuration Date:
            </label>
            <div className="grid grid-cols-3 gap-2 mb-2.5">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all ${
                  selectedDate === todayStr
                    ? 'border-[#0D6EFD] bg-blue-50/80 text-[#0D6EFD] shadow-2xs'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>Today</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(tomorrowStr)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all ${
                  selectedDate === tomorrowStr
                    ? 'border-[#0D6EFD] bg-blue-50/80 text-[#0D6EFD] shadow-2xs'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>Tomorrow</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(dayAfterStr)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all ${
                  selectedDate === dayAfterStr
                    ? 'border-[#0D6EFD] bg-blue-50/80 text-[#0D6EFD] shadow-2xs'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>Day After</span>
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium shrink-0">Or choose specific date:</span>
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-2xs outline-none focus:border-[#0D6EFD] focus:ring-2 focus:ring-[#0D6EFD]/20"
              />
            </div>
          </div>

          {/* Quick Presets Strip */}
          <div className="flex flex-wrap items-center gap-2 border-y border-gray-100 py-3">
            <button
              type="button"
              onClick={handlePopulateStandardSlots}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 active:scale-95"
            >
              <Sparkles className="size-3.5 text-indigo-600" />
              <span>Populate Standard Slots (10 AM - 5 PM)</span>
            </button>
            <button
              type="button"
              onClick={handleClearUnbooked}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              <Trash2 className="size-3 text-gray-500" />
              <span>Clear Unbooked</span>
            </button>
          </div>

          {/* Add Custom Slot Row */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5">
            <div className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1.5">
              <Plus className="size-3.5 text-[#0D6EFD]" />
              <span>Add Custom Time Slot</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Start Time:</label>
                <input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-mono font-medium text-gray-800 shadow-2xs outline-none focus:border-[#0D6EFD]"
                />
              </div>

              <div className="w-28">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Duration:</label>
                <select
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 shadow-2xs outline-none focus:border-[#0D6EFD]"
                >
                  <option value={15}>15 mins</option>
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                </select>
              </div>

              <div className="self-end">
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="flex items-center gap-1 rounded-xl bg-[#0D6EFD] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-105 active:scale-95"
                >
                  <Plus className="size-3.5" />
                  <span>Add Slot</span>
                </button>
              </div>
            </div>
          </div>

          {/* Slots List for this Date */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-800">
                Configured Slots for {selectedDate} ({slots.length}):
              </label>
              <span className="text-[10px] text-gray-400">
                {slots.filter((s) => s.isBooked).length} booked • {slots.filter((s) => !s.isBooked).length} available
              </span>
            </div>

            {loading ? (
              <div className="flex h-32 items-center justify-center text-xs text-gray-400">
                <Loader2 className="size-4 animate-spin mr-2" /> Loading slots...
              </div>
            ) : slots.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 p-4 text-center">
                <Clock className="size-6 text-gray-300 mb-1" />
                <p className="text-xs font-medium text-gray-600">No slots configured for {selectedDate}</p>
                <p className="text-[10px] text-gray-400">
                  Click &ldquo;Populate Standard Slots&rdquo; or add custom slots above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                {slots.map((slot) => (
                  <div
                    key={slot.startTime}
                    className={`flex items-center justify-between rounded-xl border p-2 transition-all ${
                      slot.isBooked
                        ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                        : 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-xs font-bold">
                        {slot.startTime} – {slot.endTime}
                      </div>
                      <div className="text-[10px] font-semibold flex items-center gap-1 mt-0.5">
                        {slot.isBooked ? (
                          <span className="text-amber-700">🔒 Booked</span>
                        ) : (
                          <span className="text-emerald-700">🟢 Available</span>
                        )}
                        <span className="text-gray-400">({slot.durationMinutes}m)</span>
                      </div>
                    </div>

                    {!slot.isBooked ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slot.startTime)}
                        className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Remove slot"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {errorMessage ? (
            <div className="flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              <AlertCircle className="size-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="flex items-start gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
              <Check className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            <span>Save Availability Slots</span>
          </button>
        </div>
      </div>
    </div>
  );
}
