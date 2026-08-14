'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PenLine } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { severityTone, type MisconceptionEntry } from '@/app/pal/new/data/content-model';

/**
 * One misconception with its corrective ladder.
 *
 * Shared by the concept view (Type 3 tab) and the chapter-wide library, so the
 * two can never drift on how a C6 violation is presented — the rule that a
 * misconception with no corrective may not be served is the first thing the
 * card says, not a footnote.
 */
export default function MisconceptionCard({
  entry,
  showConcept = false,
}: {
  entry: MisconceptionEntry;
  showConcept?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-2xl border bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)] ${
        entry.c6Ok ? 'border-[#DFE6F2]' : 'border-rose-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-[#1F2A44]">{entry.title}</h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${severityTone(entry.severity)}`}
            >
              {entry.severity}
            </span>
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              priority {entry.priorityLevel}
            </span>
            {entry.origin === 'assessment_distractor' ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                from a distractor only
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {entry.tag}
            {showConcept && entry.conceptName ? (
              <span className="ml-2 font-sans text-slate-500">· {entry.conceptName}</span>
            ) : null}
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm font-semibold text-slate-800">
            {entry.prevalenceRate !== null ? `${Math.round(entry.prevalenceRate * 100)}%` : '—'}
          </p>
          <p className="text-[11px] text-slate-500">
            {entry.detectedInItems} distractor{entry.detectedInItems === 1 ? '' : 's'}
          </p>
        </div>
      </button>

      {!entry.c6Ok && entry.c6Reason ? (
        <p className="border-t border-rose-100 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
          {entry.c6Reason}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-3 border-t border-slate-100 p-4">
          {entry.errorPattern ? <Field label="What the student does" value={entry.errorPattern} /> : null}
          {entry.rootCause ? <Field label="Root cause" value={entry.rootCause} /> : null}
          {entry.correctiveAction ? <Field label="Correction" value={entry.correctiveAction} /> : null}

          {entry.typicalWrongAnswers.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Typical wrong answers
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {entry.typicalWrongAnswers.map((answer) => (
                  <span
                    key={answer}
                    className="rounded-full bg-rose-50 px-2.5 py-1 font-mono text-[11px] text-rose-700"
                  >
                    {answer}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {entry.correctives.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Corrective content ({entry.correctives.length} modalities)
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Served in this order. Each uses a different modality — re-showing the explanation the
                learner already failed is what separates a quiz engine from an adaptive one.
              </p>
              <div className="mt-2 space-y-2">
                {entry.correctives.map((corrective) => (
                  <div key={corrective.nodeKey} className="rounded-xl border border-slate-100 px-3.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700">
                          {corrective.priorityLevel}
                        </span>
                        <p className="text-sm font-medium text-slate-800">{corrective.title}</p>
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-[11px] text-indigo-700">
                          {corrective.format}
                        </span>
                        {corrective.h5pType ? (
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                            {corrective.h5pType}
                          </span>
                        ) : null}
                      </div>
                      <Link href={`/pal/new/content-model/authoring?node=${corrective.nodeKey}`}>
                        <Button variant="outline" size="sm">
                          <PenLine className="mr-1.5 h-3.5 w-3.5" />
                          Author
                        </Button>
                      </Link>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">
                      {corrective.body}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{value}</p>
    </div>
  );
}
