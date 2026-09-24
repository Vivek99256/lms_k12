'use client';

/**
 * Admission → AI Stack → Knowledge Base.
 *
 * The admission material the AI is allowed to draw on when it answers, and proof that each
 * source actually answers.
 *
 * WHAT A "KNOWLEDGE SOURCE" IS HERE
 *
 * Not a folder of uploaded files. For Admissions it is a read-only MCP tool —
 * `admissions.listEnquiries`, `admissions.today`, `admissions.getEnquiryDetails`,
 * `admissions.validateConfirmation` — because that is what the assistant really reads when
 * somebody asks an admission question. Those tools already carry the tenant scoping, the
 * academic-year filter, the joins onto standard and division, and the school's own list of
 * required confirmation fields that the rest of the platform was built on, and
 * `ReportDataSourceCatalog` in Laravel lists them from the tool registry itself. So the
 * catalogue on this screen is derived, not maintained: register an admission tool in the
 * backend and it appears here with no edit to this file.
 *
 * READ-ONLY BY CONSTRUCTION
 *
 * The backend filters the catalogue on each tool's own `read_only` annotation.
 * `admissions.confirm` confirms an admission and `admissions.updateEnquiry` edits one;
 * both are real tools in that registry, and neither can appear here or be bound to a
 * template. A knowledge source that changed records when it was read would mean opening a
 * report confirmed somebody's admission.
 *
 * WHY THERE IS A CHECK BUTTON
 *
 * A source can be registered, bound to a template, and still return nothing for this school
 * — wrong academic year, no enquiries taken yet, a permission the signed-in user lacks.
 * That is invisible on an inventory and obvious the moment you call it. Check runs the real
 * tool through the existing `/api/mcp/tools/call` proxy, as the signed-in user, and reports
 * what came back. It reads; it writes nothing.
 *
 * NOTHING IS SEEDED INTO THIS TAB. There is no sample document and no fabricated admission
 * policy. An estate that has indexed nothing is told exactly that, because a knowledge base
 * padded with invented material is worse than an empty one — it looks authoritative and it
 * is not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked, CheckCircle2, Database, FileText, Loader2, PlayCircle, XCircle } from 'lucide-react';

import { fetchCapability, type CapabilityDetail } from '@/lib/intelligence/ai-capabilities';
import {
  fetchTemplateOptions,
  fetchTemplates,
  type AiTemplateOptions,
  type AiTemplateRow,
  type TemplateDataSource,
} from '@/lib/intelligence/ai-templates';
import { ADMISSIONS_MODULE, readAdmissionsWorkspaceSession } from '@/lib/admissions/admissions-ai-stack';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  AiStackTableHead,
} from './admissions-ai-chrome';

/** What one Check produced. Held per source so several can be run independently. */
type CheckResult =
  | { state: 'running' }
  | { state: 'ok'; rows: number | null; detail: string }
  | { state: 'failed'; detail: string };

export function AdmissionsKnowledgeBaseScreen() {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [templates, setTemplates] = useState<AiTemplateRow[]>([]);
  const [documents, setDocuments] = useState<CapabilityDetail | null>(null);
  /** Non-fatal: the document inventory is admin-only, and the rest of the screen stands without it. */
  const [documentsError, setDocumentsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setChecks({});
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchTemplateOptions(), fetchTemplates(ADMISSIONS_MODULE)])
      .then(([nextOptions, index]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setTemplates(index.templates);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    // Separate, and allowed to fail on its own: `knowledge-rag` is an administrator read.
    // A non-admin still gets the source catalogue rather than an error page.
    fetchCapability('knowledge-rag')
      .then((detail) => {
        if (!cancelled) setDocuments(detail);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setDocumentsError(cause instanceof Error ? cause.message : 'Document inventory unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  /** Admission sources only. This screen never lists another module's tools. */
  const sources = useMemo<TemplateDataSource[]>(
    () => (options?.data_sources ?? []).filter((source) => source.module === ADMISSIONS_MODULE),
    [options],
  );

  /** Which Admission templates read each source — the binding, from the template rows. */
  const consumers = useMemo(() => {
    const map = new Map<string, AiTemplateRow[]>();

    for (const template of templates) {
      if (!template.data_source) continue;
      const list = map.get(template.data_source) ?? [];
      list.push(template);
      map.set(template.data_source, list);
    }

    return map;
  }, [templates]);

  const boundCount = useMemo(
    () => sources.filter((source) => (consumers.get(source.name) ?? []).length > 0).length,
    [sources, consumers],
  );

  const check = useCallback(async (source: TemplateDataSource) => {
    setChecks((current) => ({ ...current, [source.name]: { state: 'running' } }));

    const session = readAdmissionsWorkspaceSession();

    try {
      const response = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        cache: 'no-store',
        body: JSON.stringify({
          tool: source.name,
          // No arguments, so a tool with a required argument reports itself as such rather
          // than being called wrongly. `admissions.getEnquiryDetails` needs an enquiry and
          // will say so — which is a true and useful thing for this tab to show.
          arguments: {},
          baseUrl: session.baseUrl,
          meta: {
            instituteId: session.instituteId,
            academicYear: session.academicYear,
            termId: session.termId,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : `The call failed (${response.status}).`;
        setChecks((current) => ({ ...current, [source.name]: { state: 'failed', detail: message } }));
        return;
      }

      const { rows, detail } = summariseMcpPayload(payload);
      setChecks((current) => ({ ...current, [source.name]: { state: 'ok', rows, detail } }));
    } catch (cause) {
      setChecks((current) => ({
        ...current,
        [source.name]: { state: 'failed', detail: cause instanceof Error ? cause.message : 'The call failed.' },
      }));
    }
  }, []);

  if (loading && !options) {
    return <AiStackLoading label="Loading Admission knowledge sources…" />;
  }

  const documentCount = documents?.metrics.find((metric) => metric.key === 'sops')?.value ?? null;
  const evidenceCount = documents?.metrics.find((metric) => metric.key === 'evidence')?.value ?? null;

  return (
    <section className="space-y-5">
      <AiStackHeader
        icon={BookMarked}
        title="Admission knowledge base"
        summary="The admission records and documents the AI may draw on when it answers, and whether each one is actually returning data."
        loading={loading}
        onRefresh={reload}
      />

      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <AiStackMetrics
        metrics={[
          { key: 'sources', label: 'Admission sources', value: sources.length, hint: 'read-only tools' },
          { key: 'bound', label: 'In use', value: boundCount, hint: 'read by an Admission template' },
          { key: 'templates', label: 'Admission templates', value: templates.length, hint: 'prompts and reports' },
          {
            key: 'documents',
            label: 'SOP documents',
            value: documentCount ?? '—',
            hint: documentCount === null ? 'not readable by your role' : 'estate-wide',
          },
          {
            key: 'evidence',
            label: 'Evidence records',
            value: evidenceCount ?? '—',
            hint: evidenceCount === null ? 'not readable by your role' : 'what claims rested on',
          },
        ]}
      />

      <AiStackHint>
        Every source below is read-only by construction — the backend filters the catalogue on each tool&apos;s own
        annotation, so a tool that confirms an admission or edits an enquiry cannot appear here or be bound to a
        template.
      </AiStackHint>

      {sources.length === 0 ? (
        <AiStackEmpty icon={Database} title="No Admission knowledge sources registered">
          The backend reported no read-only admission tools. Until one is registered, Admission AI has no records to
          ground an answer in.
        </AiStackEmpty>
      ) : (
        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading
            title="Admission data sources"
            hint="Each is a governed, read-only tool. Check calls it as you, and writes nothing."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
              <AiStackTableHead columns={['Source', 'What it returns', 'Arguments', 'Read by', 'Check']} />
              <tbody className="divide-y divide-slate-200">
                {sources.map((source) => {
                  const readers = consumers.get(source.name) ?? [];
                  const result = checks[source.name];

                  return (
                    <tr key={source.name} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-medium text-slate-900">{source.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{source.label}</div>
                      </td>
                      <td className="max-w-md px-4 py-3 text-xs leading-5 text-slate-600">{source.description}</td>
                      <td className="px-4 py-3">
                        {source.arguments.length ? (
                          <ul className="space-y-1">
                            {source.arguments.map((argument) => (
                              <li key={argument.key} className="text-[11px] leading-4">
                                <span className="font-mono text-slate-700">{argument.key}</span>
                                <span className="text-slate-400">
                                  {' '}
                                  {argument.type}
                                  {argument.required ? ' · required' : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-slate-400">none</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {readers.length ? (
                          <ul className="space-y-1">
                            {readers.map((reader) => (
                              <li key={reader.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                                <FileText className="size-3 shrink-0 text-slate-400" />
                                <span className="truncate">{reader.name}</span>
                                <AiStackPill tone={reader.kind === 'report' ? 'blue' : 'gray'}>
                                  {reader.kind}
                                </AiStackPill>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-slate-400">nothing yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void check(source)}
                          disabled={result?.state === 'running'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {result?.state === 'running' ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <PlayCircle className="size-3.5" />
                          )}
                          Check
                        </button>

                        {result?.state === 'ok' && (
                          <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-4 text-emerald-700">
                            <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                            <span>
                              {result.rows === null ? 'Answered' : `${result.rows.toLocaleString('en-IN')} row(s)`}
                              {result.detail ? ` · ${result.detail}` : ''}
                            </span>
                          </p>
                        )}

                        {result?.state === 'failed' && (
                          <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-4 text-amber-700">
                            <XCircle className="mt-0.5 size-3 shrink-0" />
                            <span>{result.detail}</span>
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}

      <AiStackCard className="overflow-hidden">
        <AiStackCardHeading
          title="Indexed documents"
          hint="SOPs and circulars from ai_sops. Held per institute, not per module — an admission policy indexed here is visible to the whole estate's AI."
        />

        {documentsError ? (
          <p className="px-5 py-6 text-sm text-slate-500">{documentsError}</p>
        ) : !documents ? (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Loading the document inventory…
          </p>
        ) : documents.table && documents.table.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <AiStackTableHead columns={documents.table.columns.map((column) => column.label)} />
              <tbody className="divide-y divide-slate-200">
                {documents.table.rows.map((row, index) => (
                  <tr key={index}>
                    {documents.table!.columns.map((column) => (
                      <td key={column.key} className="px-4 py-2.5 text-xs text-slate-600">
                        {row[column.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">
            No documents are indexed for this institute yet. Admission answers therefore rest entirely on the enquiry
            and registration records above, which is the stronger ground of the two.
          </p>
        )}
      </AiStackCard>
    </section>
  );
}

/**
 * Turn an MCP envelope into a row count and a short sentence.
 *
 * Deliberately defensive rather than typed: different tools return their payload under
 * different keys, and this only has to say "it answered, with this much". A shape it does
 * not recognise reports as answered with no count, which is honest — better than claiming
 * zero rows because the count was somewhere else.
 */
function summariseMcpPayload(payload: Record<string, unknown> | null): { rows: number | null; detail: string } {
  if (!payload) return { rows: null, detail: '' };

  const error = payload.error ?? (payload.result as Record<string, unknown> | undefined)?.error;
  if (typeof error === 'string' && error.trim()) return { rows: null, detail: error };

  const candidates: unknown[] = [
    payload.rows,
    payload.data,
    payload.records,
    (payload.result as Record<string, unknown> | undefined)?.rows,
    (payload.result as Record<string, unknown> | undefined)?.data,
    // `admissions.listEnquiries` returns its list under `enquiries` and `admissions.today`
    // under `admissions`. Named explicitly rather than left to the generic keys below, so
    // the count is the pipeline and not whichever array happened to be found first.
    (payload.data as Record<string, unknown> | undefined)?.enquiries,
    (payload.data as Record<string, unknown> | undefined)?.admissions,
    (payload.data as Record<string, unknown> | undefined)?.rows,
    (payload.data as Record<string, unknown> | undefined)?.records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const first = candidate[0];
      const keys = first && typeof first === 'object' ? Object.keys(first as object).slice(0, 4) : [];
      return { rows: candidate.length, detail: keys.length ? keys.join(', ') : '' };
    }
  }

  const count = payload.count ?? payload.total;
  if (typeof count === 'number') return { rows: count, detail: '' };

  return { rows: null, detail: '' };
}
