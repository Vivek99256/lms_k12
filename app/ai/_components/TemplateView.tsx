'use client';

/**
 * The View page's body — the whole template, read-only.
 *
 * WHY IT IS NOT THE FORM WITH THE INPUTS DISABLED
 *
 * A disabled form answers "what could I change" when the question is "what does this
 * template do". Fields that matter to a reader — which module offers it, whether it is
 * live, which placeholders it actually uses — are laid out as facts here, and the two
 * prompts are shown as the text they are rather than in boxes that look editable and
 * are not.
 *
 * It also surfaces the two things the listing can only hint at: the placeholders the
 * prompt uses that nothing will fill, and whether the template carries a grounding
 * variable at all. Both are the difference between a template that works and one that
 * quietly invents its answer.
 */

import Link from 'next/link';
import { AlertTriangle, Check, Lock, Pencil } from 'lucide-react';

import type { AiTemplateRow } from '@/lib/intelligence/ai-templates';

export function TemplateView({ row }: { row: AiTemplateRow }) {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-950">
              {row.name}
              {row.is_platform && (
                <span
                  title="A platform template shared by every school. Editing it saves this school its own copy."
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-indigo-700"
                >
                  <Lock className="size-2.5" />
                  Platform
                </span>
              )}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{row.template_key}</p>
          </div>
          <Link
            href={`/ai/prompts/${row.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            <Pencil className="size-4" />
            {row.editable_in_place ? 'Edit' : 'Customise'}
          </Link>
        </header>

        <dl className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Module Name" value={row.module_label} />
          <Fact label="Type" value={row.kind === 'report' ? 'Report template' : 'Prompt template'} />
          <Fact label="Status" value={`${row.status} · v${row.version}`} />
          <Fact label="Owner" value={row.is_platform ? 'Platform (shared)' : 'This school'} />
          <Fact
            label={row.kind === 'report' ? 'Data source' : 'Output format'}
            value={row.kind === 'report' ? row.data_source ?? 'Not set' : row.output_format}
          />
          <Fact
            label="In module"
            value={row.offered_in_module ? `Offered as “${row.offer_label}”` : 'Not offered'}
          />
          <Fact label="Human review" value={row.requires_review ? 'Required' : 'Not required'} />
          <Fact label="Usable as evidence" value={row.allow_as_evidence ? 'Allowed' : 'Not allowed'} />
        </dl>

        {row.description && (
          <p className="border-t px-4 py-3 text-sm leading-6 text-slate-600">{row.description}</p>
        )}
      </section>

      {/* Stated plainly rather than left for the reader to work out by eye: whether the
          prompt carries data, and whether any placeholder in it is a dead letter. */}
      {/* Grounding is a question about a prompt. A report's figures are substituted
          from rows its data source returned, so "no data variable" is not a thing that
          can be wrong with one — showing the warning there would flag every correct
          layout. */}
      <section className={`space-y-2 ${row.kind === 'report' ? 'hidden' : ''}`}>
        {row.grounding_variables.length > 0 ? (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <Check className="mt-0.5 size-4 shrink-0" />
            <span>
              Grounded on {row.grounding_variables.map((key) => `{{${key}}}`).join(' and ')} — the
              model answers from the data on screen.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              No data variable. The model has nothing to work from and will answer from general
              knowledge.
            </span>
          </p>
        )}

        {row.unresolvable_variables.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Nothing fills {row.unresolvable_variables.map((key) => `{{${key}}}`).join(', ')} — the
              model receives that text literally.
            </span>
          </p>
        )}
      </section>

      {row.kind === 'report' ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b px-4 py-3 text-sm font-semibold text-slate-950">Report layout</h3>

          {/* Rendered in a sandboxed frame with everything disallowed, the same way
              /ai-reports/[id] renders a generated report. The layout is author-written
              HTML stored in the database, so it is shown, never executed. */}
          <iframe
            title="Report layout preview"
            sandbox=""
            srcDoc={`<style>body{font:13px/1.6 system-ui,sans-serif;color:#0f172a;margin:16px}table{border-collapse:collapse}</style>${row.html_layout ?? ''}`}
            className="h-[28rem] w-full border-0 bg-white"
          />

          <p className="border-t px-4 py-3 text-xs leading-6 text-slate-500">
            Placeholders are shown as written. They are filled from live records when the chatbot
            generates a report from this template.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b px-4 py-3 text-sm font-semibold text-slate-950">Prompt Content</h3>

          <div className="divide-y divide-slate-200">
            <div className="p-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                System instruction
              </span>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-6 text-slate-600">
                {row.system_prompt || 'None — the template relies on the user prompt alone.'}
              </pre>
            </div>

            <div className="p-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                User prompt
              </span>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-6 text-slate-900">
                {row.user_prompt}
              </pre>
            </div>
          </div>
        </section>
      )}

      {row.safety_rules.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b px-4 py-3 text-sm font-semibold text-slate-950">Safety rules</h3>
          <ul className="list-inside list-disc space-y-1 px-4 py-3 text-sm leading-6 text-slate-600">
            {row.safety_rules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}
