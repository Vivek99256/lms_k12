'use client';

// The answer sheet itself, beside the marks.
//
// Two copies can be shown and they are never mixed up: the ORIGINAL scan exactly
// as uploaded (it is never modified), and the MARKED-UP copy, a separate file with
// the marks drawn on it. A PDF is shown in the browser's own viewer, which already
// brings zoom, fit, rotate, print and page navigation; a photo of a sheet gets zoom
// and rotate buttons here because an <img> has none.
//
// The marked-up copy is not a static picture of the AI's work. There are three
// things it can be, and the toolbar says which:
//   - SAVED     the copy the server drew from the marks as they were last saved;
//   - PREVIEW   the same drawing with the marks typed since then laid over it. An
//               <iframe> does not redraw itself, so this asks the server for a new
//               PDF and swaps it in -- after a short pause once the teacher stops
//               typing, never on every keystroke, and only for marks that are valid.
//               The old PDF stays on screen until the new one arrives. Nothing is
//               saved by a preview;
//   - ORIGINAL  the untouched scan.
//
// Jumping to a question's page is a `#page=N` on the PDF's address. A question's
// position on the page is NOT drawn over the viewer: the marked-up copy carries its
// marks where the reader found the answer, and a box laid over an embedded viewer
// would drift the moment anyone zoomed. (Swapping in a redrawn PDF reopens the
// viewer at the last page asked for, because the browser's own page is not readable.)
//
// The parent keys this component by sheet, so moving to another sheet starts it
// fresh (original/marked choice, zoom, rotation) with no reset logic here.

import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileWarning, Loader2, RefreshCw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchSheetFileUrl, fetchSheetPreviewUrl } from '@/app/lms/exam/_exam-evaluation/api';
import { previewKey, type PreviewEdit } from '@/lib/exam-evaluation/review-math';

type Props = {
  sheetId: number;
  originalName: string;
  fileType: string;
  hasAnnotated: boolean;
  /** Ask for a page. `nonce` lets the same page be asked for twice in a row. */
  jump: { page: number; nonce: number } | null;
  /** Marks typed but not saved, valid ones only. Empty when the screen matches what is saved. */
  edits: PreviewEdit[];
  /** Changes each time the sheet is (re)loaded from the server, so a freshly saved copy is fetched. */
  version: number;
};

type Source = 'original' | 'saved' | 'preview';
type Loaded = { key: string; url: string; error: string };

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;
/** How long the marks must sit still before the preview is redrawn. */
const PREVIEW_DELAY_MS = 600;

export default function SheetPdfPane({ sheetId, originalName, fileType, hasAnnotated, jump, edits, version }: Props) {
  // Until the teacher chooses, show the marked-up copy whenever there is something to show.
  const [choice, setChoice] = useState<'marked' | 'original' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [turns, setTurns] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // The last PDF that actually loaded: kept on screen while the next one is being drawn.
  const [lastGood, setLastGood] = useState<{ url: string; marked: boolean } | null>(null);
  const shownUrls = useRef<string[]>([]);

  const editKey = previewKey(edits);
  const hasEdits = edits.length > 0;
  // A sheet with no saved marked-up copy can still be drawn on demand, once there is a mark to draw.
  const canMarkUp = hasAnnotated || hasEdits;
  const markedUp = (choice ? choice === 'marked' : canMarkUp) && canMarkUp;
  const source: Source = !markedUp ? 'original' : hasEdits || !hasAnnotated ? 'preview' : 'saved';
  // The marked-up copy is always a PDF; the original is whatever was uploaded.
  const isPdf = markedUp || fileType === 'pdf';

  // Anything loaded for an older request is "still loading": derived, so no state is set in the effect.
  const requestKey = `${sheetId}:${source}:${version}:${source === 'preview' ? editKey : ''}:${attempt}`;
  const current = loaded?.key === requestKey ? loaded : null;
  const updating = current === null;
  // Only a PDF drawn the same way is worth showing meanwhile: not the original in place of a marked-up copy.
  const fileUrl = current?.url || (lastGood?.marked === (source !== 'original') ? lastGood.url : '');
  const error = current?.error ?? '';

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = () => {
      const request =
        source === 'preview'
          ? fetchSheetPreviewUrl(sheetId, edits, controller.signal)
          : fetchSheetFileUrl(sheetId, source === 'saved');

      request
        .then((url) => {
          if (cancelled) {
            URL.revokeObjectURL(url);

            return;
          }

          shownUrls.current.push(url);
          setLoaded({ key: requestKey, url, error: '' });
          setLastGood({ url, marked: source !== 'original' });
          // Older blobs go once the new one is in place, so the viewer never loses the one it shows.
          const stale = shownUrls.current.splice(0, shownUrls.current.length - 1);
          window.setTimeout(() => stale.forEach((old) => URL.revokeObjectURL(old)), 2000);
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setLoaded({
              key: requestKey,
              url: '',
              error: loadError instanceof Error ? loadError.message : 'That scan couldn’t be opened.',
            });
          }
        });
    };

    // A preview waits for the marks to settle; the saved and original copies load straight away.
    const timer = source === 'preview' ? window.setTimeout(load, PREVIEW_DELAY_MS) : undefined;

    if (source !== 'preview') load();

    return () => {
      cancelled = true;
      controller.abort();

      if (timer !== undefined) window.clearTimeout(timer);
    };
    // `edits` is read only when `editKey` says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, sheetId, source]);

  // Release every blob when the sheet is left: working through 40 sheets must not leave 40 behind.
  useEffect(() => {
    const urls = shownUrls.current;

    return () => urls.forEach((old) => URL.revokeObjectURL(old));
  }, []);

  const choose = (marked: boolean) => {
    setChoice(marked ? 'marked' : 'original');
    setZoom(100);
    setTurns(0);
  };

  const downloadName =
    source === 'original'
      ? originalName || 'answer-sheet'
      : `marked-${(originalName || 'answer-sheet').replace(/\.[^.]+$/, '')}${source === 'preview' ? '-preview' : ''}.pdf`;

  const pdfSrc = fileUrl ? `${fileUrl}#page=${jump?.page ?? 1}&view=FitH` : '';
  const initialLoad = updating && !fileUrl;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Which copy to show">
          {([true, false] as const).map((marked) => {
            const disabled = marked && !canMarkUp;
            const active = markedUp === marked && !disabled;

            return (
              <button
                key={String(marked)}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                title={disabled ? 'No marked-up copy was produced for this sheet' : undefined}
                onClick={() => choose(marked)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  active ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-slate-100'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {marked ? 'Marked up' : 'Original'}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {!isPdf && fileUrl ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Zoom out"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
              >
                <ZoomOut />
              </Button>
              <span className="w-10 text-center text-xs tabular-nums text-slate-500">{zoom}%</span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Zoom in"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
              >
                <ZoomIn />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Rotate a quarter turn"
                onClick={() => setTurns((value) => (value + 1) % 4)}
              >
                <RotateCw />
              </Button>
            </>
          ) : null}

          {fileUrl ? (
            <>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="size-3.5" /> Open
              </a>
              <a
                href={fileUrl}
                download={downloadName}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="size-3.5" /> Download
              </a>
            </>
          ) : null}
        </div>
      </div>

      {/* Which marks this copy shows, so a preview is never mistaken for what is saved. */}
      {markedUp ? (
        <div
          role="status"
          aria-live="polite"
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-xs ${
            source === 'preview' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-100 bg-slate-50 text-slate-600'
          }`}
        >
          {source === 'preview' ? (
            <>
              <span className="font-semibold">Preview of your unsaved marks</span>
              <span>
                {updating ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> Updating…
                  </span>
                ) : error ? null : (
                  'Up to date. Save the draft to keep it.'
                )}
              </span>
            </>
          ) : (
            <span>
              Marks as last saved. <span className="text-blue-700">Blue</span> = your mark, grey = AI suggestion.
            </span>
          )}
          {source === 'preview' ? (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="ml-auto inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
            >
              <RefreshCw className="size-3" /> Refresh
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-[420px] flex-1 overflow-hidden bg-slate-100 p-2 lg:min-h-0">
        {initialLoad ? (
          <p className="flex h-full min-h-[380px] items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Opening the scan…
          </p>
        ) : error && !fileUrl ? (
          <div role="alert" className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="flex items-center gap-2 text-sm text-red-700">
              <FileWarning className="size-4 shrink-0" /> {error}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </Button>
          </div>
        ) : fileUrl && isPdf ? (
          <div className="flex h-full min-h-[380px] flex-col gap-2">
            {error ? (
              // A failed redraw keeps the last good PDF on screen and says why it is out of date.
              <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                <FileWarning className="size-3.5 shrink-0" /> {error} The copy below does not show your latest marks.
              </p>
            ) : null}
            <iframe
              // A new key per request makes a repeated jump to the same page work.
              key={`${markedUp ? 'marked' : 'original'}-${jump?.nonce ?? 0}`}
              src={pdfSrc}
              title={markedUp ? 'Marked-up answer sheet' : 'Original answer sheet'}
              className="min-h-0 w-full flex-1 rounded-lg border border-slate-200 bg-white"
            />
          </div>
        ) : fileUrl ? (
          <div className="h-full min-h-[380px] overflow-auto rounded-lg border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt="Original answer sheet"
              style={{ width: `${zoom}%`, transform: `rotate(${turns * 90}deg)`, transformOrigin: 'center' }}
              className="mx-auto max-w-none transition-transform"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
