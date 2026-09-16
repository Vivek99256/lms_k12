'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  Link2,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Send,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InlineMessage,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import { TemplateHtmlEditor } from '@/app/general/_components/TemplateHtmlEditor';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAiReport,
  getReportRecipients,
  regenerateAiReport,
  saveAiReport,
  sendAiReport,
  type IntelligenceContext,
} from '@/lib/intelligence/client';
import type { AiReport, AiReportSendPreview } from '@/lib/intelligence/types';

/**
 * A generated report: read it, edit it, refresh its figures, print it, share it.
 *
 * This is where the link `ai.templates.generate` hands back actually goes. The
 * document is a `template_master` row filed under the assistant's category — an HTML
 * blob composed from real rows — so this page edits HTML, which is why it reuses
 * `TemplateHtmlEditor` (Settings → Templates) rather than the drag-and-drop designer
 * at `/document-templates`. That designer stores a Craft.js node tree of absolutely
 * positioned A4 blocks and exports by rasterising the canvas; it can neither read nor
 * write `html_content`, so pointing this page at it would have meant writing an
 * HTML↔node-tree adapter in both directions to gain a canvas that suits a
 * per-student certificate rather than a table of two hundred rows.
 *
 * **The document is never injected into this app's DOM.** It is admin-editable HTML
 * stored unfiltered — the trust position `template_master` has always had — so it is
 * displayed inside a sandboxed frame with scripts disallowed, and printed from that
 * same frame. `allow-same-origin` is present so this page can call `print()` on it;
 * `allow-scripts` is deliberately absent, so a script pasted into a report has
 * nothing to execute in, whether it is being read or printed.
 */

/** Print and screen styling for the frame — the report is a fragment, not a document. */
const FRAME_STYLES = `
  @page { margin: 16mm; }
  html { background: #fff; }
  body {
    margin: 0; padding: 24px;
    font: 14px/1.6 Inter, "Segoe UI", system-ui, sans-serif;
    color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h2 { margin: 0 0 8px; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  small { color: #64748b; }
  @media print { body { padding: 0; } }
`;

function frameDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Report</title><style>${FRAME_STYLES}</style></head><body>${html}</body></html>`;
}

/** "4 Sep 2026, 15:27" — the format the generated provenance line already uses. */
function formatMoment(iso: string): string {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AiReportPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const frameRef = useRef<HTMLIFrameElement>(null);

  const reportId = Number(params?.id);

  const context = useMemo<IntelligenceContext>(() => {
    const token = typeof window === 'undefined' ? null : localStorage.getItem('token');

    return {
      token,
      instituteId: auth?.menuContext?.sub_institute_id ?? null,
      academicYear:
        (auth?.academicYears?.[0] as { syear?: string | number } | undefined)?.syear ?? null,
    };
  }, [auth?.menuContext?.sub_institute_id, auth?.academicYears]);

  const [report, setReport] = useState<AiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'saving' | 'refreshing' | 'resolving' | 'sending' | null>(null);
  // Held rather than sent straight away: this is the list the operator is approving,
  // and the count travels back with the send so the backend can refuse a list that
  // moved in between.
  const [sendPreview, setSendPreview] = useState<AiReportSendPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The draft is separate from the loaded report so that Cancel is a real discard and
  // a failed save leaves the edits on screen rather than reverting them.
  const [draftTitle, setDraftTitle] = useState('');
  const [draftHtml, setDraftHtml] = useState('');

  // A malformed id is a fact about the URL, not something to discover by asking the
  // server, so it is derived during render rather than pushed into state.
  const malformedId = !Number.isInteger(reportId) || reportId <= 0;

  useEffect(() => {
    if (malformedId) return;

    let cancelled = false;

    // Every state change here happens after the await, so the effect body itself
    // triggers no cascading render, and a navigation mid-flight is discarded rather
    // than landing on an unmounted page.
    (async () => {
      try {
        const { report: loaded } = await getAiReport(context, reportId);

        if (cancelled) return;

        setReport(loaded);
        setDraftTitle(loaded.title);
        setDraftHtml(loaded.html);
        setError(null);
      } catch (caught) {
        if (cancelled) return;

        setError(caught instanceof Error ? caught.message : 'This report could not be opened.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [context, reportId, malformedId]);

  const dirty = Boolean(report) && (draftTitle !== report?.title || draftHtml !== report?.html);

  const save = useCallback(async () => {
    if (!report) return;

    if (!draftTitle.trim()) {
      setError('A report needs a title.');

      return;
    }

    setBusy('saving');
    setError(null);
    setNotice(null);

    try {
      const { report: saved } = await saveAiReport(context, report.id, {
        title: draftTitle.trim(),
        html: draftHtml,
      });

      setReport({ ...report, title: saved.title, html: draftHtml, figures: saved.figures });
      setDraftTitle(saved.title);
      setEditing(false);
      setNotice('Report saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The report could not be saved.');
    } finally {
      setBusy(null);
    }
  }, [context, report, draftTitle, draftHtml]);

  /**
   * Refresh the figures against live records.
   *
   * Offered only outside edit mode. It writes to the stored document immediately, so
   * running it over an unsaved draft would mean one of the two changes silently losing.
   */
  const refresh = useCallback(async () => {
    if (!report) return;

    setBusy('refreshing');
    setError(null);
    setNotice(null);

    try {
      const result = await regenerateAiReport(context, report.id);
      setReport({ ...report, html: result.html });
      setDraftHtml(result.html);
      setNotice(
        `Figures refreshed — ${result.row_count} row${result.row_count === 1 ? '' : 's'} read from live ${result.module} records.`
      );
    } catch (caught) {
      // The backend refuses rather than blanking a table it can no longer fill, so
      // the reason it gives is the useful thing to show.
      setError(caught instanceof Error ? caught.message : 'The figures could not be refreshed.');
    } finally {
      setBusy(null);
    }
  }, [context, report]);

  /**
   * Step one of sending: find out who would receive something, and show it.
   *
   * Nothing is queued here. Each person in the report gets their own figures rather
   * than the report itself, so this is also where an operator can see that the
   * consolidated table is not what goes out.
   */
  const resolveRecipients = useCallback(async () => {
    if (!report) return;

    setBusy('resolving');
    setError(null);
    setNotice(null);
    setSendPreview(null);

    try {
      setSendPreview(await getReportRecipients(context, report.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The recipients could not be worked out.');
    } finally {
      setBusy(null);
    }
  }, [context, report]);

  /** Step two: send, against the count that was shown. */
  const confirmSend = useCallback(async () => {
    if (!report || !sendPreview) return;

    setBusy('sending');
    setError(null);

    try {
      const result = await sendAiReport(context, report.id, sendPreview.recipient_count);

      setSendPreview(null);
      setNotice(
        `${result.queued} notice${result.queued === 1 ? '' : 's'} queued for sending.` +
          (result.failed_count > 0 ? ` ${result.failed_count} could not be queued.` : '')
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The notices could not be sent.');
    } finally {
      setBusy(null);
    }
  }, [context, report, sendPreview]);

  const print = useCallback(() => {
    const frame = frameRef.current?.contentWindow;

    if (!frame) {
      setError('The report could not be prepared for printing.');

      return;
    }

    frame.focus();
    frame.print();
  }, []);

  const copyLink = useCallback(async () => {
    setError(null);

    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Link copied. Anyone you send it to will need access to this school.');
    } catch {
      setError('The link could not be copied. Copy it from the address bar instead.');
    }
  }, []);

  const cancel = useCallback(() => {
    if (dirty && !window.confirm('Discard the changes to this report?')) return;

    setDraftTitle(report?.title ?? '');
    setDraftHtml(report?.html ?? '');
    setEditing(false);
    setError(null);
  }, [dirty, report]);

  const actions = report ? (
    <div className="flex flex-wrap items-center gap-2">
      {editing ? (
        <>
          <Button type="button" onClick={() => void save()} disabled={busy !== null || !dirty}>
            {busy === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </Button>
          <Button type="button" variant="outline" onClick={cancel} disabled={busy !== null}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
            disabled={busy !== null || !report.figures}
            title={
              report.figures
                ? 'Re-read the live records. Anything written around the table is kept.'
                : 'This document no longer contains a generated table, so there is nothing to refresh.'
            }
          >
            {busy === 'refreshing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh figures
          </Button>
          <Button type="button" variant="outline" onClick={print}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void resolveRecipients()}
            disabled={busy !== null || !report.figures}
            title={
              report.figures
                ? 'Show who would be emailed. Each person receives only their own figures.'
                : 'This document no longer contains a generated table, so there is nobody it is about.'
            }
          >
            {busy === 'resolving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
          <Button type="button" variant="outline" onClick={() => void copyLink()}>
            <Link2 className="h-4 w-4" />
            Copy link
          </Button>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <PageFrame>
      <PageHeader
        title={report?.title || 'Report'}
        description={
          report?.figures
            ? `Figures read from live ${report.figures.module} records via ${report.figures.source} · ${formatMoment(report.figures.generated_at)}`
            : 'Generated report'
        }
        action={actions}
      />

      {malformedId ? (
        <InlineMessage type="error" text="That is not a valid report reference." />
      ) : null}
      {error ? <InlineMessage type="error" text={error} /> : null}
      {notice ? <InlineMessage type="success" text={notice} /> : null}

      {sendPreview ? (
        <SectionPanel
          title={`Send to ${sendPreview.recipient_count} recipient${sendPreview.recipient_count === 1 ? '' : 's'}`}
          description="Each person is emailed their own figures only. The report itself is not sent to anybody."
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void confirmSend()}
                disabled={busy !== null || sendPreview.recipient_count < 1 || sendPreview.over_limit}
              >
                {busy === 'sending' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send {sendPreview.recipient_count} notice
                {sendPreview.recipient_count === 1 ? '' : 's'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSendPreview(null)}
                disabled={busy !== null}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          }
        >
          <div className="space-y-4 p-4">
            {sendPreview.over_limit ? (
              <InlineMessage
                type="error"
                text={`This report resolves to ${sendPreview.recipient_count} recipients, above the ${sendPreview.limit} that may be sent at once. Narrow the report — by class, or by amount — and try again.`}
              />
            ) : null}

            <div>
              <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Subject
              </span>
              <p className="text-sm text-slate-800">{sendPreview.subject}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Will be emailed
                </span>
                <ul className="mt-1 max-h-56 divide-y divide-slate-100 overflow-auto rounded-md border border-slate-200">
                  {sendPreview.recipients.map((recipient) => (
                    <li
                      key={`${recipient.email}-${recipient.name}`}
                      className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-800">{recipient.name}</span>
                      <span className="truncate text-xs text-slate-500">{recipient.email}</span>
                    </li>
                  ))}
                  {sendPreview.recipients.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-500">Nobody.</li>
                  ) : null}
                </ul>
              </div>

              {/* Named, not silently dropped: "sent to 8 of 12" is only honest if the
                  other four are on screen. */}
              {sendPreview.unreachable.length > 0 ? (
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-amber-700 uppercase">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No address on record ({sendPreview.unreachable.length})
                  </span>
                  <ul className="mt-1 max-h-56 divide-y divide-amber-100 overflow-auto rounded-md border border-amber-200 bg-amber-50">
                    {sendPreview.unreachable.map((person, index) => (
                      <li
                        key={`${person.name}-${index}`}
                        className="px-3 py-2 text-sm text-amber-900"
                      >
                        {person.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {sendPreview.sample ? (
              <div>
                <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  What {sendPreview.sample.to} receives
                </span>
                {/* The real notice, in the same script-free frame the report uses. */}
                <iframe
                  title="Notice preview"
                  srcDoc={frameDocument(sendPreview.sample.html)}
                  sandbox="allow-same-origin"
                  className="mt-1 h-64 w-full rounded-md border border-slate-200 bg-white"
                />
              </div>
            ) : null}
          </div>
        </SectionPanel>
      ) : null}

      {loading && !malformedId ? (
        <SectionPanel>
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening the report…
          </div>
        </SectionPanel>
      ) : null}

      {!loading && report ? (
        <SectionPanel
          title={editing ? 'Editing the report' : undefined}
          description={
            editing
              ? 'The figures were composed from real records. Refreshing replaces the table and keeps anything you write around it.'
              : undefined
          }
        >
          {editing ? (
            <div className="space-y-4 p-4">
              <div>
                <label
                  className="text-xs font-medium text-slate-600"
                  htmlFor="ai-report-title"
                >
                  Report title
                </label>
                <Input
                  id="ai-report-title"
                  value={draftTitle}
                  maxLength={250}
                  onChange={(event) => setDraftTitle(event.target.value)}
                />
              </div>

              <div>
                <span className="text-xs font-medium text-slate-600">Document</span>
                {/* A report carries no <<tokens>>: it is already-resolved data, so the
                    editor's merge-field picker has nothing to offer here. */}
                <TemplateHtmlEditor
                  value={draftHtml}
                  onChange={setDraftHtml}
                  tags={[]}
                  disabled={busy !== null}
                />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <iframe
                ref={frameRef}
                title={report.title || 'Report'}
                srcDoc={frameDocument(report.html)}
                // No allow-scripts: the document is admin-editable HTML and nothing in
                // it may run. allow-same-origin is only so Print can reach this frame.
                sandbox="allow-same-origin allow-modals"
                className="h-[70vh] w-full rounded-md border border-slate-200 bg-white"
              />
            </div>
          )}
        </SectionPanel>
      ) : null}

      {!loading && !report && !error && !malformedId ? (
        <SectionPanel>
          <div className="flex items-center gap-2 p-10 text-sm text-slate-500">
            <Check className="h-4 w-4" />
            There is nothing to show for this report.
          </div>
        </SectionPanel>
      ) : null}
    </PageFrame>
  );
}
