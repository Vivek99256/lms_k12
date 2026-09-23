'use client';

// ---------------------------------------------------------------------------
// The blueprint, on the page it will print on.
//
// This is the whole point of the screen: it is NOT a styled summary that
// happens to resemble the PDF, it is the same BlueprintSheet the exporter
// rasterises, laid out at the same content width. What is on screen is what
// comes out, because there is only one layout.
//
// The white area is drawn at A4's printable width and the page boundaries are
// marked where the exporter will actually cut — at `data-pdf-block` edges — so
// a coordinator can see a table is about to be split before they print forty
// copies rather than after.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Printer, X } from 'lucide-react';
import BlueprintSheet, { type SheetBranding } from './BlueprintSheet';
import { CONTENT_WIDTH_MM, PREVIEW_WIDTH_PX, generateBlueprintPdf } from './pdf';
import { PAGE_SIZES_MM, PX_PER_MM, computePageCuts } from '@/lib/question-paper/pagination';
import type { Blueprint } from './types';

type Props = { blueprint: Blueprint; branding: SheetBranding; onClose: () => void };

const PAGE_HEIGHT_PX = (PAGE_SIZES_MM.a4[1] - 14 * 2) * PX_PER_MM;

export default function BlueprintPreview({ blueprint, branding, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  // The real cut positions, not multiples of the page height: computePageCuts
  // moves a break UP to the nearest block boundary so a row is never split, so
  // drawing at fixed offsets would show lines the exporter will not use.
  const [cuts, setCuts] = useState<Array<[number, number]>>([]);
  const [busy, setBusy] = useState<'' | 'open' | 'save'>('');
  const [error, setError] = useState('');

  // Measured after paint from the same block markers the exporter reads, so the
  // page count shown here is the page count that will come out.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const sheet = sheetRef.current?.querySelector<HTMLElement>('.blueprint-sheet');

      if (!sheet) return;

      const rect = sheet.getBoundingClientRect();
      const tops = Array.from(sheet.querySelectorAll<HTMLElement>('[data-pdf-block]')).map(
        (block) => block.getBoundingClientRect().top - rect.top
      );

      setCuts(computePageCuts(tops, rect.height, PAGE_HEIGHT_PX));
    });

    return () => cancelAnimationFrame(frame);
  }, [blueprint]);

  const exportPdf = useCallback(
    async (action: 'open' | 'save') => {
      setBusy(action);
      setError('');

      try {
        await generateBlueprintPdf({ blueprint, branding, action });
      } catch (exportError) {
        setError(
          exportError instanceof Error ? exportError.message : 'The PDF could not be produced.'
        );
      } finally {
        setBusy('');
      }
    },
    [blueprint, branding]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0F172A]/55 p-3">
      <div className="mx-auto flex h-full w-full max-w-[1000px] flex-col overflow-hidden rounded-[18px] border border-[#E4E9F2] bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF1F6] px-5 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-[#172554]">{blueprint.name}</h3>
            <p className="mt-0.5 text-[12px] text-[#7A889D]">
              A4 portrait · {Math.max(1, cuts.length)} page{cuts.length === 1 ? '' : 's'} · this is
              the layout the PDF uses
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void exportPdf('open')}
              disabled={busy !== ''}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E4E9F2] px-3.5 py-2 text-[13px] font-semibold text-[#334155] transition hover:bg-[#F3F5F9] disabled:opacity-50"
            >
              {busy === 'open' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Printer size={15} />
              )}
              Open PDF
            </button>

            <button
              type="button"
              onClick={() => void exportPdf('save')}
              disabled={busy !== ''}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#5846EA] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#4738CE] disabled:opacity-50"
            >
              {busy === 'save' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              Download
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-[9px] border border-[#E4E9F2] p-1.5 text-[#5F7087] transition hover:bg-[#F3F5F9]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-5 mt-3 rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto bg-[#E9EDF4] p-5">
          <div
            ref={sheetRef}
            className="relative mx-auto bg-white shadow-sm"
            style={{
              // A4's printable width, plus the margin drawn as real padding, so
              // the text block on screen is the text block on paper.
              width: PREVIEW_WIDTH_PX + 2 * 14 * PX_PER_MM,
              padding: 14 * PX_PER_MM,
            }}
          >
            <BlueprintSheet blueprint={blueprint} branding={branding} />

            {/* Where the exporter will cut. Drawn over the sheet rather than in
                it, so nothing about the measured layout changes. */}
            {cuts.slice(1).map(([top], index) => (
              <div
                key={top}
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[#B6C2D4]"
                style={{ top: 14 * PX_PER_MM + top }}
              >
                <span className="absolute right-1 -top-2.5 bg-[#E9EDF4] px-1.5 text-[10px] font-semibold text-[#8A97AC]">
                  page {index + 2}
                </span>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-3 max-w-[640px] text-center text-[11.5px] leading-5 text-[#6B7A90]">
            The dashed lines are the exporter&apos;s actual cuts — pulled up to the nearest row
            boundary, so nothing is ever split through the middle. Width is A4&apos;s printable{' '}
            {Math.round(CONTENT_WIDTH_MM)}mm.
          </p>
        </div>
      </div>
    </div>
  );
}
