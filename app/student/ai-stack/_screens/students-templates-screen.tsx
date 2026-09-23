'use client';

/**
 * Student → AI Stack → Templates.
 *
 * The Student module's own report layouts, and the place a report is actually built from
 * one. Decentralised in the sense that matters to the person using it — it lives in the
 * Student module, it only ever shows Student templates, and creating one here cannot file
 * it against another module — while still being the same concept, the same store and the
 * same API as the central screen under AI & Intelligence. There is no second template
 * system: a template written here is an `ai_templates` row with `module_key = 'students'`,
 * which is exactly what the central screen would have written, and exactly what the report
 * generator already resolves.
 *
 * A LAYOUT IS NOT A PROMPT, AND THAT IS THE POINT
 *
 * Every placeholder in a layout is filled by substitution from rows `students.directory`
 * read out of the enrolment records. No model sees the figures, which is why a report here
 * can print a roll number and a prompt on the Prompts tab cannot. The data source list is
 * filtered to student tools and the backend only ever offers tools annotated `read_only`,
 * so a layout cannot be bound to something that changes a child's record.
 *
 * `count` IS THE COHORT, `row_count` IS THE PAGE
 *
 * `students.directory` counts the whole cohort before applying its limit, so a read of 50
 * rows out of 812 reports `count: 812`. A layout that printed one over a table of the other
 * would be wrong in the way nobody checks, so the starter layout below prints both and
 * labels them.
 *
 * WHICH LAYOUT THE MODULE ACTUALLY RENDERS WITH
 *
 * `ReportTemplateResolver` picks ONE layout per module — this school's own row first, then
 * the highest version — so with more than one published layout, only one of them is what
 * "Build report" produces. That is not obvious from a list of equals, so the table below
 * marks it. Promoting the other is a version change on this screen, not a support ticket.
 *
 * BUILD, PREVIEW, EDIT, PRINT, SEND
 *
 * Building writes a saved report and returns its link. Everything after that — previewing
 * it, editing the text, refreshing the figures against the live records, printing it and
 * sending it — already lives on `/ai-reports/{id}`, which is where the link goes.
 * Rebuilding those five here would be a second implementation of a page that works.
 *
 * WHY EVERY TEMPLATE HERE IS SAVED ESTATE-WIDE
 *
 * Student layouts are meant to be usable by anyone who opens the Student module, whatever
 * their `sub_institute_id`. So every save from this screen sets `shared`, which writes the
 * row with no `sub_institute_id` — the platform baseline every school resolves. The central
 * screen still defaults to school-scoped saves; this is one of the places that opts in, and
 * the banner says so rather than leaving it to be discovered.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileText, Loader2, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react';

import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import { TemplateHtmlEditor } from '@/app/general/_components/TemplateHtmlEditor';
import {
  createTemplate,
  fetchTemplateOptions,
  fetchTemplates,
  retireTemplate,
  updateTemplate,
  type AiTemplateOptions,
  type AiTemplateRow,
} from '@/lib/intelligence/ai-templates';
import { generateReportForContext, type WorkspaceReport } from '@/lib/intelligence/workspace';
import {
  STUDENTS_AI_STACK_ROUTE,
  STUDENTS_MODULE,
  logStudentsOperation,
  readStudentsWorkspaceSession,
  refreshStudentsAiStack,
} from '@/lib/students/students-ai-stack';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackNotice,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './students-ai-chrome';

/**
 * What a new Student layout starts as.
 *
 * A working layout rather than an empty box, because the first thing an author needs is to
 * see the shape — a heading, the repeating row block, the total line — and edit it, not to
 * learn the placeholder syntax from documentation. Every placeholder here is one
 * `students.directory` really returns, so this template produces a correct report the
 * moment it is saved and published. There is no child, roll number or class in it; the
 * repeating block runs once per student the school actually has enrolled.
 */
const STARTER_LAYOUT = [
  '<h2>&lt;&lt; report_title &gt;&gt;</h2>',
  '<p>&lt;&lt; row_count &gt;&gt; student(s) listed &middot; academic year &lt;&lt; academic_year &gt;&gt; &middot; generated &lt;&lt; generated_at &gt;&gt;</p>',
  '<table style="width:100%;border-collapse:collapse;font-size:13px">',
  '<thead><tr>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Roll</th>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Student</th>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Enrolment no.</th>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Std / Div</th>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Mobile</th>',
  '</tr></thead><tbody>',
  '&lt;&lt;#rows&gt;&gt;<tr>',
  '<td style="border:1px solid #cbd5e1;padding:6px">&lt;&lt; roll_no &gt;&gt;</td>',
  '<td style="border:1px solid #cbd5e1;padding:6px">&lt;&lt; student_name &gt;&gt;</td>',
  '<td style="border:1px solid #cbd5e1;padding:6px">&lt;&lt; enrollment_no &gt;&gt;</td>',
  '<td style="border:1px solid #cbd5e1;padding:6px">&lt;&lt; standard_name &gt;&gt; / &lt;&lt; division_name &gt;&gt;</td>',
  '<td style="border:1px solid #cbd5e1;padding:6px">&lt;&lt; mobile &gt;&gt;</td>',
  '</tr>&lt;&lt;/rows&gt;&gt;',
  '</tbody></table>',
  '<p style="margin-top:16px"><strong>Students matching these filters: &lt;&lt; count &gt;&gt;</strong> ',
  '&mdash; of which &lt;&lt; row_count &gt;&gt; are listed above. A blank cell is a detail the school has not ',
  'recorded, not a detail that does not exist.</p>',
].join('\n');

interface FormState {
  id: number | null;
  name: string;
  description: string;
  data_source: string;
  html_layout: string;
  status: string;
  version: number;
  offer_in_module: boolean;
}

function starterForm(defaultSource: string): FormState {
  return {
    id: null,
    name: 'Student Report',
    description: 'The students enrolled this academic year, with the details the school holds on each.',
    data_source: defaultSource,
    html_layout: STARTER_LAYOUT,
    status: 'published',
    version: 1,
    offer_in_module: true,
  };
}

function formFrom(row: AiTemplateRow): FormState {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    data_source: row.data_source ?? '',
    html_layout: row.html_layout ?? '',
    status: row.status,
    version: row.version,
    offer_in_module: row.offered_in_module,
  };
}

/**
 * The layout a report is actually built with, by the backend's own rule.
 *
 * Mirrors `ReportTemplateResolver::find()`: published, has a layout, this school's own row
 * before the platform baseline, then highest version. Computed rather than guessed so the
 * badge cannot say one thing while the generator does another.
 */
function resolveActiveLayout(rows: AiTemplateRow[]): AiTemplateRow | null {
  const candidates = rows.filter((row) => row.status === 'published' && (row.html_layout ?? '').trim() !== '');

  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const ownership = Number(a.sub_institute_id === null) - Number(b.sub_institute_id === null);
    if (ownership !== 0) return ownership;
    return b.version - a.version;
  })[0];
}

export function StudentsTemplatesScreen() {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [rows, setRows] = useState<AiTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchTemplateOptions()
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'The request failed.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchTemplates(STUDENTS_MODULE)
      .then((next) => {
        if (cancelled) return;
        // Report layouts only. A Student *prompt* is a different thing managed on the
        // Prompts tab, and mixing the two in one list is how an author edits the wrong one.
        setRows(next.templates.filter((row) => row.kind === 'report'));
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  /** Student data sources only — this screen never offers another module's tools. */
  const sources = useMemo(
    () => (options?.data_sources ?? []).filter((source) => source.module === STUDENTS_MODULE),
    [options],
  );

  const activeLayout = useMemo(() => resolveActiveLayout(rows), [rows]);

  const branding = options?.branding;
  const heading = branding?.institute_name ?? 'Students';

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      module_key: STUDENTS_MODULE,
      kind: 'report' as const,
      html_layout: form.html_layout,
      data_source: form.data_source,
      status: form.status,
      user_prompt: '',
      offer_in_module: form.offer_in_module,
      // Every Student layout serves the whole estate — see the note at the top.
      shared: true,
    };

    try {
      if (form.id === null) {
        await createTemplate(payload);
        setNotice('Student template saved.');
      } else {
        await updateTemplate(form.id, payload);
        setNotice('Student template updated.');
      }

      setForm(null);
      refreshStudentsAiStack();
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setSaving(false);
    }
  };

  const retire = async (row: AiTemplateRow) => {
    if (!window.confirm(`Retire "${row.name}"? The Student module will stop offering it.`)) return;

    try {
      await retireTemplate(row.id);
      setNotice('Template retired.');
      refreshStudentsAiStack();
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  return (
    <section className="space-y-5">
      {/* Letterhead. Name and logo are the school's own, read from its own records —
          this component contains neither. */}
      <AiStackHeader
        icon={FileText}
        title={heading}
        summary="Student template management — the report designs this module fills from the enrolment records."
        loading={loading}
        onRefresh={reload}
        actions={
          <button
            type="button"
            onClick={() => {
              setForm(starterForm(sources[0]?.name ?? 'students.directory'));
              setNotice('');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
          >
            <Plus className="size-4" />
            New template
          </button>
        }
      />

      <AiStackHint>
        Templates saved here are available to <strong>every institute</strong> that opens the Student module, not just
        this one. Only one published layout is the one a report is built with — the table marks it.
      </AiStackHint>

      {notice && <AiStackNotice>{notice}</AiStackNotice>}
      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <BuildReportPanel activeLayout={activeLayout} onError={setError} />

      <AiStackCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <AiStackTableHead
              columns={['Template', 'Data source', 'Version', 'Status', 'In Students', 'Updated', 'Actions']}
            />
            <tbody className="divide-y divide-slate-200">
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Loading Student templates…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No Student templates yet. <strong>New template</strong> opens one already filled in.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      <FileText className="size-4 shrink-0 text-slate-400" />
                      {row.name}
                      {activeLayout?.id === row.id && <AiStackPill tone="green">builds reports</AiStackPill>}
                      {row.is_platform && <AiStackPill tone="blue">platform</AiStackPill>}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">{row.template_key}</div>
                    {row.description && <div className="mt-1 max-w-md text-xs text-slate-500">{row.description}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                    {row.data_source ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600">v{row.version}</td>
                  <td className="px-4 py-3">
                    <AiStackPill tone={row.status === 'published' ? 'green' : row.status === 'draft' ? 'amber' : 'gray'}>
                      {row.status}
                    </AiStackPill>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.offered_in_module ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <Check className="size-3.5" />
                        Offered
                      </span>
                    ) : (
                      <span className="text-slate-500">Not offered</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatWhen(row.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(formFrom(row));
                          setNotice('');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      {row.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => void retire(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="size-3.5" />
                          Retire
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AiStackCard>

      {form && (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">
              {form.id === null ? 'New Student template' : 'Edit Student template'}
            </h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-900"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Module Name *</span>
              {/* Fixed, and shown rather than hidden: this screen exists to manage Student
                  templates, and a module selector would offer one option. */}
              <input
                value="Student"
                readOnly
                className="mt-1 h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Template Title *</span>
              <input
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                required
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          {/* A real <label htmlFor> rather than a wrapper, because the assistant's trigger
              is a button and a button inside a <label> also toggles the label's control. */}
          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="students-template-description" className="text-sm font-medium text-slate-900">
                What it is for
              </label>
              <AiFieldAssistant
                value={form.description}
                onApply={(next) => patch({ description: next })}
                fieldType="description"
                label="What it is for"
                module={STUDENTS_MODULE}
                page="AI Stack — Templates"
                entityType="students_ai_template"
                related={{ Template: form.name }}
              />
            </div>
            <input
              id="students-template-description"
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Student data source *</span>
              <select
                value={form.data_source}
                onChange={(event) => patch({ data_source: event.target.value })}
                required
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select…</option>
                {sources.map((source) => (
                  <option key={source.name} value={source.name}>
                    {source.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                {sources.find((source) => source.name === form.data_source)?.description ??
                  'Where the live student records come from. Read-only tools only.'}
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Status</span>
              <select
                value={form.status}
                onChange={(event) => patch({ status: event.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {(options?.statuses ?? ['draft', 'published', 'archived']).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                Only a published template is used. With more than one published, the highest version builds reports.
              </span>
            </label>
          </div>

          <div>
            <span className="text-sm font-medium text-slate-900">Report layout *</span>
            <TemplateHtmlEditor
              value={form.html_layout}
              onChange={(html) => patch({ html_layout: html })}
              tags={(options?.report_placeholders ?? []).map((placeholder) => ({
                key: placeholder.key,
                label: placeholder.label,
              }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={form.offer_in_module}
              onChange={(event) => patch({ offer_in_module: event.target.checked })}
              className="size-4 accent-blue-600"
            />
            Offer this template in the Student AI panel
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/**
 * Build a report from the live enrolment records, and hand over the link that previews,
 * edits, refreshes, prints and sends it.
 *
 * The filters are the arguments `students.directory` accepts, and nothing else. They narrow
 * what the school itself can already see: the institute and the academic year come from the
 * bearer token on the backend and are not parameters this form could widen even if it
 * tried.
 *
 * A standard or division the institute does not have returns no rows and says so, rather
 * than falling back to every student — that rule lives in the tool, not here, and this form
 * simply reports what came back.
 */
function BuildReportPanel({
  activeLayout,
  onError,
}: {
  activeLayout: AiTemplateRow | null;
  onError: (message: string) => void;
}) {
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [limit, setLimit] = useState('200');
  const [activeOnly, setActiveOnly] = useState(true);
  const [building, setBuilding] = useState(false);
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [emptyNote, setEmptyNote] = useState('');

  const positive = (value: string) => {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  };

  const build = async () => {
    setBuilding(true);
    setReport(null);
    setEmptyNote('');
    onError('');

    // `active_only` is sent as a real boolean either way, because the published layout's
    // own default is true and leaving it out would silently mean "only active students"
    // when the operator had cleared the box.
    const argumentsGiven: Record<string, unknown> = { active_only: activeOnly };

    for (const [key, value] of Object.entries({
      standard_id: positive(standardId),
      division_id: positive(divisionId),
      limit: positive(limit),
    })) {
      if (value !== undefined) argumentsGiven[key] = value;
    }

    try {
      const result = await generateReportForContext(readStudentsWorkspaceSession(), {
        route: STUDENTS_AI_STACK_ROUTE,
        arguments: argumentsGiven,
      });

      // `row_count: 0` comes back as a success with no link, because an empty result is an
      // answer and not a document. Saying so is better than opening a blank report.
      if (!result.template_link || result.row_count === 0) {
        setEmptyNote(
          'No students matched those filters, so no report was created. A standard or division this institute does not have returns nothing rather than the whole school.',
        );
        return;
      }

      setReport(result);
      logStudentsOperation('class_roll_report', {
        message: `Built "${result.title}" from ${result.row_count} student record(s).`,
        reference: result.title,
        tool: result.source_tool,
        result: {
          row_count: result.row_count,
          layout: result.layout_name,
          filters: argumentsGiven,
        },
      });
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'The report could not be built.');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <AiStackCard>
      <AiStackCardHeading
        title="Build a report"
        hint={
          activeLayout
            ? `Filled from the live enrolment records using the "${activeLayout.name}" layout.`
            : 'No published layout yet — publish one above and this builds the plain table instead.'
        }
      />

      <div className="grid gap-3 p-5 sm:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium text-slate-700">Standard id</span>
          <input
            value={standardId}
            onChange={(event) => setStandardId(event.target.value)}
            inputMode="numeric"
            placeholder="all"
            className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-700">Division id</span>
          <input
            value={divisionId}
            onChange={(event) => setDivisionId(event.target.value)}
            inputMode="numeric"
            placeholder="all"
            className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-700">Rows</span>
          <input
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            inputMode="numeric"
            className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-sm text-slate-900">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(event) => setActiveOnly(event.target.checked)}
            className="size-4 accent-blue-600"
          />
          <span>
            Active students only
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
              Clear it to include students marked inactive.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={() => void build()}
          disabled={building}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {building ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Build report
        </button>

        <p className="text-xs text-slate-500">
          The institute and academic year come from your session, not from this form.
        </p>
      </div>

      {emptyNote && (
        <p className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          {emptyNote}
        </p>
      )}

      {report && (
        <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">{report.title}</p>
          <p className="mt-0.5 text-xs">
            {report.row_count} row(s) read through <span className="font-mono">{report.source_tool ?? 'the module'}</span>
            {report.layout_name ? ` into the "${report.layout_name}" layout` : ''}.
          </p>
          <a
            href={report.template_link}
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Open to preview, edit, print or send
          </a>
        </div>
      )}
    </AiStackCard>
  );
}
