'use client';

import { BookOpen, Cpu, Layers3 } from 'lucide-react';
import type { PedagogyConceptOption, PedagogyContext } from '@/app/pal/data/pedagogy-engine';

/**
 * Identifies the extracted chapter and concept the engine was run against, and
 * lets the reviewer switch concept. Every field is read from the backend's
 * `context` block, which is built from the semantic_intelligence row.
 */
export default function ConceptContextBar({
  context,
  concepts,
  activeConcept,
  onSelectConcept,
}: {
  context: PedagogyContext;
  concepts: PedagogyConceptOption[];
  activeConcept: string;
  onSelectConcept: (index: string) => void;
}) {
  const selected = activeConcept || String(context.concept_index);

  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">
            <BookOpen className="h-3.5 w-3.5" />
            Evaluated against
          </div>

          <h2 className="mt-2 text-lg font-bold text-slate-900">
            {context.concept_name ?? 'Concept'}
          </h2>
          {context.concept_definition ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">{context.concept_definition}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              context.subject_name ? `Subject: ${context.subject_name}` : null,
              context.standard ? `Class ${context.standard}` : null,
              context.chapter_number ? `Chapter ${context.chapter_number}` : null,
              context.concept_difficulty ? `Difficulty: ${context.concept_difficulty}` : null,
              context.concept_importance ? `Importance: ${context.concept_importance}` : null,
            ]
              .filter((chip): chip is string => Boolean(chip))
              .map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {chip}
                </span>
              ))}
          </div>

          <p className="mt-3 text-sm font-medium text-slate-700">{context.chapter_title}</p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <Layers3 className="h-3.5 w-3.5" />
              Concept {context.concept_index + 1} of {context.concept_total}
            </span>
            <select
              value={selected}
              onChange={(event) => onSelectConcept(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none"
            >
              {concepts.map((concept) => (
                <option key={concept.index} value={String(concept.index)}>
                  {concept.index + 1}. {concept.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <Cpu className="h-3.5 w-3.5" />
              Extraction
            </div>
            <dl className="mt-2 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between gap-3">
                <dt>Table</dt>
                <dd className="font-mono text-slate-800">{context.source_table}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Row</dt>
                <dd className="font-mono text-slate-800">#{context.semantic_id}</dd>
              </div>
              {context.chapter_id !== null ? (
                <div className="flex justify-between gap-3">
                  <dt>chapter_id</dt>
                  <dd className="font-mono text-slate-800">{context.chapter_id}</dd>
                </div>
              ) : null}
              {context.extracted_by ? (
                <div className="flex justify-between gap-3">
                  <dt>Extracted by</dt>
                  <dd className="font-mono text-slate-800">{context.extracted_by}</dd>
                </div>
              ) : null}
              {context.extracted_at ? (
                <div className="flex justify-between gap-3">
                  <dt>Extracted at</dt>
                  <dd className="font-mono text-slate-800">{context.extracted_at}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
