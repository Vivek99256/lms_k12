'use client';

import { useEffect, useState } from 'react';
import { Bot, X } from 'lucide-react';

/**
 * The small "need a hand?" notification shown at the bottom-right after the idle
 * threshold. It owns presentation only: "Yes" and "No" are handed back to the
 * caller, which decides what opening the assistant means.
 */
export function StuckNudgePopup({
  onYes,
  onNo,
}: {
  onYes: () => void;
  onNo: () => void;
}) {
  // Mount hidden, then flip on the next frame so the entrance transition runs.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onNo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onNo]);

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label="Assistant suggestion"
      className={`fixed bottom-4 right-4 z-[80] w-[min(42vw,8rem)] min-w-[7rem] transition-all duration-300 ease-out sm:bottom-6 sm:right-6 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="relative overflow-hidden rounded-xl border border-gray-200/70 bg-white/95 p-1.5 shadow-[0_22px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: 'var(--accent-gradient, linear-gradient(90deg,#0D6EFD,#4f46e5))' }}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={onNo}
          aria-label="Dismiss"
          className="absolute right-1 top-1 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="size-2.5" aria-hidden="true" />
        </button>

        <div className="flex justify-center">
          <div className="relative mt-0.5 shrink-0">
            <span
              className="absolute inset-0 animate-ping rounded-full bg-[#0D6EFD]/30"
              aria-hidden="true"
            />
            <div className="relative flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#0D6EFD] to-indigo-600 text-white shadow-[0_8px_18px_rgba(13,110,253,0.3)]">
              <Bot className="size-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="mt-1.5 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onYes}
            autoFocus
            className="w-4/5 rounded-full bg-[#0D6EFD] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-[0_6px_14px_rgba(13,110,253,0.3)] transition-colors hover:bg-[#0b5ed7]"
          >
            Yes, help me
          </button>
          <button
            type="button"
            onClick={onNo}
            className="w-4/5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-blue-100"
          >
            No, I&apos;m fine
          </button>
        </div>
      </div>
    </div>
  );
}
