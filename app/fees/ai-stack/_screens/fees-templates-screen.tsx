'use client';

/**
 * Fees → AI Stack → Templates.
 *
 * The Fees module's own template management. Decentralised in the sense that matters to
 * the person using it — it lives in Fees, it only ever shows Fees templates, and
 * creating one here cannot file it against another module — while still being the same
 * concept, the same store and the same API as the central screen under
 * AI & Intelligence. There is no second template system: a template written here is an
 * `ai_templates` row with `module_key = 'fees'`, which is exactly what the central
 * screen would have written, and exactly what the assistant already resolves.
 *
 * WHY IT IS NOT A COPY OF THE CENTRAL SCREEN
 *
 * Two screens over one table is how they drift. This one calls the same
 * `lib/intelligence/ai-templates` client the central screen uses, so a change to the
 * contract breaks both at compile time rather than leaving this one quietly wrong. What
 * it adds is the Fees framing: the module is fixed, the data sources are Fees ones, and
 * a new template opens with a working Fees layout already in it.
 *
 * WHY EVERY TEMPLATE HERE IS SAVED ESTATE-WIDE
 *
 * Fees templates are meant to be usable by anyone who opens the Fees module, whatever
 * their `sub_institute_id`. So every save from this screen sets `shared`, which writes
 * the row with no `sub_institute_id` — the platform baseline every school resolves.
 * The central screen still defaults to school-scoped saves; this is the one place that
 * opts in, and the banner says so rather than leaving it to be discovered.
 *
 * BRANDING IS READ, NEVER WRITTEN DOWN
 *
 * The school's name and logo come from `options.branding`, which the API reads from
 * that school's own fee receipt letterhead. Nothing here contains a school name, an
 * image path or a fallback to somebody else's — when a school has set neither, the
 * header falls back to the module name.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';

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

/** This screen is Fees and only Fees. The module is never a control the user can change. */
const MODULE_KEY = 'fees';

/**
 * What a new Fees template starts as.
 *
 * A working layout rather than an empty box, because the first thing an author needs is
 * to see the shape — a heading, the repeating row block, the totals line — and edit it,
 * not to learn the placeholder syntax from documentation. Every placeholder here is one
 * `fees.arrears` really returns, so this template produces a correct report the moment
 * it is saved and published.
 */
const STARTER_LAYOUT = [
  '<h2>&lt;&lt; report_title &gt;&gt;</h2>',
  '<p>&lt;&lt; row_count &gt;&gt; student(s) with pending fees &middot; generated &lt;&lt; generated_at &gt;&gt;</p>',
  '<table style="width:100%;border-collapse:collapse;font-size:13px">',
  '<thead><tr>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Student</th>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Gr. No.</th>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:left">Std/Div</th>',
  '<th style="border:1px solid #cbd5e1;padding:6px;text-align:right">Outstanding</th>',
  '</tr></thead><tbody>',
  '&lt;&lt;#rows&gt;&gt;<tr>',
  '<td style="border:1px solid #cbd5e1;padding:6px">&lt;&lt; student_name &gt;&gt;</td>',
  '<td style="border:1px solid #cbd5e1;padding:6px">&lt;&lt; enrollment_no &gt;&gt;</td>',
  '<td style="border:1px solid #cbd5e1;padding:6px">&lt;&lt; standard_name &gt;&gt;</td>',
  '<td style="border:1px solid #cbd5e1;padding:6px;text-align:right">&lt;&lt; outstanding &gt;&gt;</td>',
  '</tr>&lt;&lt;/rows&gt;&gt;',
  '</tbody></table>',
  '<p style="margin-top:16px"><strong>Total outstanding:</strong> &lt;&lt; total_outstanding &gt;&gt; ',
  'across &lt;&lt; defaulter_count &gt;&gt; of &lt;&lt; cohort_size &gt;&gt; students.</p>',
].join('\n');

interface FormState {
  id: number | null;
  name: string;
  description: string;
  data_source: string;
  html_layout: string;
  status: string;
  offer_in_module: boolean;
}

function starterForm(defaultSource: string): FormState {
  return {
    id: null,
    name: 'Pending Fees Report',
    description: 'Students carrying an outstanding fee balance.',
    data_source: defaultSource,
    html_layout: STARTER_LAYOUT,
    status: 'published',
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
    offer_in_module: row.offered_in_module,
  };
}

export function FeesTemplatesScreen() {
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

    fetchTemplates(MODULE_KEY)
      .then((next) => {
        if (cancelled) return;
        // Report templates only. A Fees *prompt* template is a different thing managed
        // centrally, and mixing the two in one list is how an author edits the wrong one.
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

  /** Fees data sources first — this screen never offers another module's tools. */
  const sources = useMemo(() => {
    const all = options?.data_sources ?? [];

    return all.filter((source) => source.module === 'fees');
  }, [options]);

  const branding = options?.branding;
  const heading = branding?.institute_name ?? 'Fees';

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
      module_key: MODULE_KEY,
      kind: 'report' as const,
      html_layout: form.html_layout,
      data_source: form.data_source,
      status: form.status,
      user_prompt: '',
      offer_in_module: form.offer_in_module,
      // Every Fees template serves the whole estate — see the note at the top.
      shared: true,
    };

    try {
      if (form.id === null) {
        await createTemplate(payload);
        setNotice('Fees template saved.');
      } else {
        await updateTemplate(form.id, payload);
        setNotice('Fees template updated.');
      }

      setForm(null);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setSaving(false);
    }
  };

  const retire = async (row: AiTemplateRow) => {
    if (!window.confirm(`Retire "${row.name}"? Fees will stop offering it.`)) return;

    try {
      await retireTemplate(row.id);
      setNotice('Template retired.');
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  return (
    <section className="space-y-5">
      {/* Letterhead. Name and logo are the school's own, read from its fee receipt
          book — this component contains neither. */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex min-w-0 items-center gap-4">
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt=""
              className="size-12 shrink-0 rounded-lg object-contain"
              onError={(event) => {
                // A school whose logo file has gone missing gets the initial instead of
                // a broken-image icon on its own branding.
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-slate-900 text-lg font-semibold text-white">
              {heading.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-950">{heading}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Fees template management — the report designs this module uses to answer fee questions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(starterForm(sources[0]?.name ?? 'fees.arrears'));
              setNotice('');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
          >
            <Plus className="size-4" />
            New template
          </button>
        </div>
      </header>

      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
        Templates saved here are available to <strong>every institute</strong> that opens the Fees
        module, not just this one. Publishing a template makes the assistant use it when somebody
        asks a fee question from a Fees page.
      </p>

      {notice && (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Check className="mt-0.5 size-4 shrink-0" />
          {notice}
        </p>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50">
              {['Template', 'Data source', 'Status', 'In Fees', 'Actions'].map((heading) => (
                <th
                  key={heading}
                  className="whitespace-nowrap border-b border-slate-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  <Loader2 className="mr-2 inline size-4 animate-spin" />
                  Loading Fees templates…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  No Fees templates yet. <strong>New template</strong> opens one already filled in.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <FileText className="size-4 shrink-0 text-slate-400" />
                    {row.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">{row.template_key}</div>
                  {row.description && (
                    <div className="mt-1 max-w-md text-xs text-slate-500">{row.description}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                  {row.data_source ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium capitalize ${
                      row.status === 'published'
                        ? 'bg-emerald-100 text-emerald-800'
                        : row.status === 'draft'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {row.status}
                  </span>
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

      {form && (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">
              {form.id === null ? 'New Fees template' : 'Edit Fees template'}
            </h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-900"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Module Name *</span>
              {/* Fixed, and shown rather than hidden: this screen exists to manage Fees
                  templates, and a module selector here would only offer one option. */}
              <input
                value="Fees"
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

          {/* The label is a real <label htmlFor> rather than a wrapper, because the
              assistant's trigger is a button and a button inside a <label> also toggles
              the label's control. Same association, no double activation. */}
          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="fees-template-description" className="text-sm font-medium text-slate-900">
                What it is for
              </label>
              <AiFieldAssistant
                value={form.description}
                onApply={(next) => patch({ description: next })}
                fieldType="description"
                label="What it is for"
                module="fees"
                page="AI Stack — Reports & templates"
                entityType="fees_ai_template"
                related={{ Template: form.name }}
              />
            </div>
            <input
              id="fees-template-description"
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Fees data source *</span>
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
                  'Where the live fee records come from. Read-only tools only.'}
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
                Only a published template is used by the assistant.
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
            Offer this template in the Fees AI panel
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
