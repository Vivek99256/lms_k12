'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import NewPalNav from '@/app/pal/new/_components/NewPalNav';
import {
  fetchChapterModel,
  humanise,
  scoreTone,
  type ChapterModel,
  type ConceptSummary,
} from '@/app/pal/new/data/content-model';

/**
 * Content Model — one chapter.
 *
 * Scores the chapter against the seven Content Model requirements, then lists
 * every extracted concept with its four-type coverage so the reader can see
 * where the gaps actually are before opening one.
 */
export default function ChapterModelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading chapter…
        </div>
      }
    >
      <ChapterModelContent />
    </Suspense>
  );
}

function ChapterModelContent() {
  const searchParams = useSearchParams();
  const semanticId = Number(searchParams?.get('id') ?? 0);

  const [model, setModel] = useState<ChapterModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!semanticId) {
        setError('No chapter was selected.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        setModel(await fetchChapterModel(semanticId, signal));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Could not load this chapter.');
      } finally {
        setLoading(false);
      }
    },
    [semanticId]
  );

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
  }, [load]);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/pal/new/content-model">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Chapters
              </Button>
            </Link>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">
                {model?.chapterName || 'Chapter'}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {model
                  ? `${model.subjectName} · Grade ${model.standard ?? '—'} · ${model.conceptCount} concepts`
                  : 'Loading…'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {semanticId ? (
              <Link href={`/pal/new/content-model/misconceptions?chapter=${semanticId}`}>
                <Button variant="outline" size="sm">
                  <AlertTriangle className="mr-1.5 h-4 w-4" />
                  Misconception library
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        <NewPalNav />

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading && !model ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Projecting the content model…</span>
          </div>
        ) : null}

        {model ? (
          <>
            {model.chapterSummary ? (
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">Chapter summary</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{model.chapterSummary}</p>

                {model.chapterObjectives.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Learning objectives ({model.chapterObjectives.length})
                    </p>
                    <ul className="mt-2 space-y-1">
                      {model.chapterObjectives.slice(0, 6).map((objective, index) => (
                        <li key={index} className="flex gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                          {objective}
                        </li>
                      ))}
                    </ul>
                    {model.chapterObjectives.length > 6 ? (
                      <p className="mt-1.5 text-xs text-slate-400">
                        + {model.chapterObjectives.length - 6} more
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* the seven Content Model requirements */}
            <div>
              <h2 className="mb-3 text-[15px] font-semibold text-[#1F2A44]">
                Content model requirements
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {model.requirements.map((req) => (
                  <div
                    key={req.key}
                    className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                  >
                    <p className="text-[13px] font-medium text-slate-500">{req.label}</p>
                    <p className={`mt-3 text-[28px] font-semibold leading-none ${scoreTone(req.scorePct)}`}>
                      {req.scorePct}%
                    </p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          req.scorePct >= 80
                            ? 'bg-emerald-500'
                            : req.scorePct >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, req.scorePct)}%` }}
                      />
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{req.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* totals strip */}
            <div className="flex flex-wrap gap-2">
              <Total label="Projected nodes" value={model.totals.nodes ?? 0} />
              <Total label="Concept variants" value={model.totals.variants_present ?? 0} />
              <Total label="Practice items" value={model.totals.practice_items ?? 0} />
              <Total label="Misconceptions" value={model.totals.misconceptions ?? 0} />
              <Total label="Assessment items" value={model.totals.assessment_items ?? 0} />
              <Total label="Avg completeness" value={`${model.totals.avg_completeness ?? 0}%`} />
              <Total label="Approved" value={model.totals.nodes_approved ?? 0} />
            </div>

            {/* concepts */}
            <div className="rounded-2xl border border-[#DFE6F2] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-[15px] font-semibold text-[#1F2A44]">
                  Concepts ({model.concepts.length})
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Each concept projects its own four-type model. Gaps are shown rather than filled —
                  a variant with no extracted material behind it is a gap, not a blank page.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 font-semibold">Concept</th>
                      <th className="px-4 py-2.5 font-semibold">Type 1 · variants</th>
                      <th className="px-4 py-2.5 font-semibold">Type 2 · Bloom ladder</th>
                      <th className="px-4 py-2.5 font-semibold">Type 3 · misconceptions</th>
                      <th className="px-4 py-2.5 font-semibold">Type 4 · assessment</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {model.concepts.map((concept) => (
                      <ConceptRow key={concept.slug} concept={concept} semanticId={model.semanticId} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ConceptRow({ concept, semanticId }: { concept: ConceptSummary; semanticId: number }) {
  return (
    <tr className="border-b border-slate-50 align-top hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">{concept.name}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {concept.importance ? (
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              {concept.importance}
            </span>
          ) : null}
          {concept.difficulty ? (
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              {concept.difficulty}
            </span>
          ) : null}
          {concept.confidence !== null ? (
            <span className="rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
              conf {Math.round(concept.confidence * 100)}%
            </span>
          ) : null}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-slate-800">
            {concept.type1.present}/{concept.type1.total}
          </span>
          {concept.type1.meetsMinimum ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {concept.type1.gaps.length === 0
            ? 'all variants backed'
            : `gap at V${concept.type1.gaps.join(', V')}`}
        </p>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-end gap-0.5">
          {concept.type2.perLevel.map((level) => (
            <div key={level.level} className="flex flex-col items-center gap-0.5">
              <div
                className={`w-5 rounded-sm ${level.items === 0 ? 'bg-rose-200' : 'bg-indigo-400'}`}
                style={{ height: `${Math.max(4, Math.min(28, level.items * 5))}px` }}
                title={`L${level.level}: ${level.items} item(s)`}
              />
              <span className="text-[9px] text-slate-400">L{level.level}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {concept.type2.items} items ·{' '}
          {concept.type2.hardGaps.length === 0
            ? 'every rung populated'
            : `no items at L${concept.type2.hardGaps.join(', L')}`}
        </p>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-slate-800">{concept.type3.total}</span>
          {concept.type3.c6Pass ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {concept.type3.servable} servable
          {concept.type3.meetsMinimum ? '' : ' · under the 3-per-concept minimum'}
        </p>
      </td>

      <td className="px-4 py-3">
        <span className="font-mono text-sm text-slate-800">{concept.type4.items}</span>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {concept.type4.items === 0
            ? 'no calibrated items'
            : `${concept.type4.calibrated} with answer keys · ${concept.type4.evidenceVerified} evidence-verified`}
        </p>
      </td>

      <td className="px-4 py-3 text-right">
        <Link href={`/pal/new/content-model/concept?chapter=${semanticId}&slug=${concept.slug}`}>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </Link>
      </td>
    </tr>
  );
}

function Total({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#DFE6F2] bg-white px-3.5 py-2">
      <span className="text-xs text-slate-500">{humanise(label)}</span>
      <span className="font-mono text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}
