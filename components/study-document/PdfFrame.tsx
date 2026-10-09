'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileWarning, Loader2, RefreshCw } from 'lucide-react';

import { canShowPdfInline } from '@/lib/study-document/api';

export interface PdfFrameProps {
  /** Reads the PDF's bytes. Called again when `cacheKey` changes (the other copy was chosen). */
  load: (signal: AbortSignal) => Promise<Blob>;
  cacheKey: string;
  /** What the frame is called to a screen reader. */
  title: string;
  /** Save the bytes the frame holds. */
  onDownload: (blob: Blob) => void;
}

type Settled = { status: 'ready'; blob: Blob; url: string } | { status: 'error'; message: string };

type State = { status: 'loading' } | Settled;

/**
 * A PDF shown where the reader already is.
 *
 * The file is asked for by the page (so the request carries the chapter and school, and the server finds the file itself),
 * and its bytes are shown from memory in a frame: the address bar never changes, no route is entered and no tab is
 * opened. The in-memory address is revoked as soon as it is replaced or the frame goes away.
 *
 * A browser that cannot show a PDF inside a page (many phones) is offered the download instead of a blank frame.
 */
export function PdfFrame({ load, cacheKey, title, onDownload }: PdfFrameProps) {
  const [attempt, setAttempt] = useState(0);
  // What came back is kept with the request it answers. A different copy or a retry is a different request, so until its
  // answer arrives the frame is loading, without anything having to be reset.
  const requestKey = `${cacheKey}#${attempt}`;
  const [answer, setAnswer] = useState<{ key: string; settled: Settled } | null>(null);
  const state: State = answer && answer.key === requestKey ? answer.settled : { status: 'loading' };
  // The load callback is not a dependency on purpose: it is a new function each render, and only the copy (cacheKey) or a retry should fetch again.
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;

    loader
      .current(controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setAnswer({ key: requestKey, settled: { status: 'ready', blob, url } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setAnswer({ key: requestKey, settled: { status: 'error', message: error instanceof Error ? error.message : 'Couldn’t open the PDF.' } });
      });

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [requestKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-hidden="true" />
        <p className="text-sm">Opening the PDF…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 p-6 text-center">
        <FileWarning className="h-8 w-8 text-amber-600" aria-hidden="true" />
        <p className="max-w-md text-sm text-slate-800">{state.message}</p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  if (!canShowPdfInline(typeof navigator === 'undefined' ? null : navigator)) {
    return (
      <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 p-6 text-center">
        <FileWarning className="h-8 w-8 text-slate-500" aria-hidden="true" />
        <p className="max-w-md text-sm text-slate-800">This browser does not show PDFs inside a page. Download it to read it, or use the Try it online tab.</p>
        <button
          type="button"
          onClick={() => onDownload(state.blob)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download the PDF
        </button>
      </div>
    );
  }

  return <iframe key={state.url} title={title} src={`${state.url}#view=FitH`} className="h-full w-full border-0 bg-slate-100" />;
}
