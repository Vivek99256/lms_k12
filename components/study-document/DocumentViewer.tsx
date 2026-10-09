'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Download, FileText, Sparkles, X } from 'lucide-react';

import { defaultVariant, documentFileName, variantLabels, variantsOffered, type Audience, type PdfVariant } from '@/lib/study-document/api';
import { KIND_LABEL } from '@/lib/study-document/document';
import type { DocumentKind } from '@/lib/study-document/types';
import { loadDocumentPdf, saveBlob } from './data';
import { OnlinePractice } from './OnlinePractice';
import { PdfFrame } from './PdfFrame';

export interface DocumentViewerItem {
  chapterId: number;
  /** content_master.id of the document. */
  contentId: number;
  title: string;
  kind: DocumentKind;
}

export interface DocumentViewerProps {
  /** The document to show, or null for none. */
  item: DocumentViewerItem | null;
  /** Who is reading: it only chooses which copy of the PDF opens first and which are offered. */
  audience: Audience;
  instituteId: number;
  /** Identifies the learner so progress in the online practice is kept per learner. */
  userKey: string;
  onClose: () => void;
}

type Tab = 'pdf' | 'online';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, summary, iframe, [tabindex]:not([tabindex="-1"])';

/**
 * A study document opened IN PLACE.
 *
 * Revision notes, a remedial class and classroom activities are PDFs. Opening one does not leave the page: this panel
 * opens over whatever the reader was looking at, shows the PDF in a frame, and offers the "Try it online" tab (diagrams to
 * select, cards to turn, questions that are marked) beside it. Closing it returns to exactly where they were. There is no
 * route for it, no `router.push` and no new tab.
 *
 * What a PDF cannot do is not claimed for it: the PDF says where the online version is, and the online tab is built from
 * the same stored document the PDF was drawn from.
 */
export function DocumentViewer(props: DocumentViewerProps) {
  const { item } = props;
  if (!item) return null;

  // Keyed by the content item, so opening another document starts it afresh.
  return <Viewer key={`${item.chapterId}:${item.contentId}`} {...props} item={item} />;
}

function Viewer({ item, audience, instituteId, userKey, onClose }: DocumentViewerProps & { item: DocumentViewerItem }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const offered = variantsOffered(item.kind, audience);
  const [variant, setVariant] = useState<PdfVariant>(() => (offered.includes(defaultVariant(audience)) ? defaultVariant(audience) : offered[0]));
  const [tab, setTab] = useState<Tab>('pdf');
  const [onlineOpened, setOnlineOpened] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The bytes of each copy, once read: switching back to a copy shows it at once, and a download needs no second request.
  const cache = useRef(new Map<PdfVariant, Blob>());
  const labels = variantLabels(item.kind);

  // Focus moves into the panel and goes back to what opened it; the page behind does not scroll while it is open.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);

  // Escape closes and Tab stays inside, wherever focus is. Handled on the document, not on the panel: a control that is
  // removed while it has focus (a "go to unit 1" button, once it has done its job) leaves focus on the page behind, and a
  // handler on the panel would never hear the key.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const box = panel.current;
      if (!box) return;
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        box.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!box.contains(active) || active === box) {
        // Focus is outside the panel (or on the panel itself): bring it in at the end Tab was heading for.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const pulledOut = (event: FocusEvent) => {
      const box = panel.current;
      if (box && event.target instanceof Node && !box.contains(event.target)) box.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', keys);
    document.addEventListener('focusin', pulledOut);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('focusin', pulledOut);
    };
  }, []);

  const read = useCallback(
    async (copy: PdfVariant, signal?: AbortSignal): Promise<Blob> => {
      const have = cache.current.get(copy);
      if (have) return have;
      const blob = await loadDocumentPdf({ chapterId: item.chapterId, contentId: item.contentId, instituteId, variant: copy, signal });
      cache.current.set(copy, blob);

      return blob;
    },
    [item.chapterId, item.contentId, instituteId]
  );

  const download = useCallback(
    async (known?: Blob) => {
      setSaveError(null);
      try {
        saveBlob(known ?? (await read(variant)), documentFileName(item.title, variant));
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Couldn’t download the PDF.');
      }
    },
    [read, variant, item.title]
  );

  const choose = (next: Tab) => {
    setTab(next);
    if (next === 'online') setOnlineOpened(true);
  };

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/55 p-2 sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      data-testid="document-viewer"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-[min(94dvh,60rem)] w-[min(78rem,98vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
      >
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {KIND_LABEL[item.kind]}
            </p>
            <h2 id={titleId} className="mt-1 line-clamp-2 text-base font-semibold text-slate-900 sm:truncate sm:text-lg">
              {item.title}
            </h2>
          </div>

          {offered.length > 1 ? (
            <div role="group" aria-label="Which copy of the PDF" className="inline-flex overflow-hidden rounded-xl border border-slate-300">
              {offered.map((copy) => (
                <button
                  key={copy}
                  type="button"
                  aria-pressed={variant === copy}
                  onClick={() => {
                    setVariant(copy);
                    setTab('pdf');
                  }}
                  className={`px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 ${
                    variant === copy ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {labels[copy]}
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void download(cache.current.get(variant))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div role="tablist" aria-label="How to read it" className="flex gap-1 border-b border-slate-200 bg-slate-50 px-3 pt-2">
          {(
            [
              ['pdf', 'PDF', FileText],
              ['online', 'Try it online', Sparkles],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              id={`${titleId}-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`${titleId}-panel-${id}`}
              type="button"
              onClick={() => choose(id)}
              className={`inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 ${
                tab === id ? 'border-slate-200 bg-white text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
          {saveError ? (
            <p role="alert" className="ml-auto self-center pr-2 text-sm text-red-700">
              {saveError}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1">
          <div id={`${titleId}-panel-pdf`} role="tabpanel" aria-labelledby={`${titleId}-tab-pdf`} hidden={tab !== 'pdf'} className="h-full">
            <PdfFrame
              cacheKey={variant}
              title={`${item.title}, ${labels[variant]}`}
              load={(signal) => read(variant, signal)}
              onDownload={(blob) => void download(blob)}
            />
          </div>
          <div id={`${titleId}-panel-online`} role="tabpanel" aria-labelledby={`${titleId}-tab-online`} hidden={tab !== 'online'} className="h-full">
            {onlineOpened ? <OnlinePractice chapterId={item.chapterId} contentId={item.contentId} instituteId={instituteId} userKey={userKey} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
