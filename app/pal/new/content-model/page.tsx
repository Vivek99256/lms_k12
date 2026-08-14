'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  FileSearch,
  Languages,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import NewPalNav from '@/app/pal/new/_components/NewPalNav';
import {
  fetchChapters,
  fetchEstateCoverage,
  fetchVocabulary,
  humanise,
  scoreTone,
  type ContentModelVocabulary,
  type EstateCoverage,
  type ExtractedChapter,
} from '@/app/pal/new/data/content-model';

/**
 * Content Model — workspace.
 *
 * Two jobs: show what the extracted estate can and cannot serve, and get the
 * user into a chapter. Everything shown — the vocabularies, the four-type
 * coverage, the chapter list and its filters — comes from the API; nothing is
 * hardcoded in this file.
 */
export default function ContentModelPage() {
  const [coverage, setCoverage] = useState<EstateCoverage | null>(null);
  const [vocabulary, setVocabulary] = useState<ContentModelVocabulary | null>(null);
  const [chapters, setChapters] = useState<ExtractedChapter[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [standards, setStandards] = useState<number[]>([]);

  const [subject, setSubject] = useState('');
  const [standard, setStandard] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [estate, vocab, list] = await Promise.all([
        fetchEstateCoverage(signal),
        fetchVocabulary(signal),
        fetchChapters({}, signal),
      ]);
      setCoverage(estate);
      setVocabulary(vocab);
      setChapters(list.chapters);
      setSubjects(list.subjects);
      setStandards(list.standards);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'Could not load the Content Model workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
  }, [load]);

  // Filtering is client-side over an already-loaded list: the estate is chapter
  // scale (tens to hundreds), so a round trip per keystroke would be worse.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return chapters.filter((chapter) => {
      if (subject && chapter.subjectName !== subject) return false;
      if (standard && String(chapter.standard) !== standard) return false;
      if (
        term &&
        !chapter.chapterName.toLowerCase().includes(term) &&
        !chapter.subjectName.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [chapters, subject, standard, search]);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">Content model</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                The PAL V4 four-type content model, projected from extracted chapter intelligence.
                Pick a chapter to open it.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/pal/new/content-model/review">
              <Button size="sm">
                <ClipboardCheck className="mr-1.5 h-4 w-4" />
                Review queue
              </Button>
            </Link>
          </div>
        </div>

        <NewPalNav />

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading && !coverage ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Loading content model…</span>
          </div>
        ) : null}

        {coverage && vocabulary ? (
          <>
            {/* four-type coverage across the estate */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {coverage.fourTypeModel.map((type) => (
                <div
                  key={type.key}
                  className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                >
                  <p className="text-[13px] font-medium text-slate-500">{type.label}</p>
                  <p className={`mt-3 text-[28px] font-semibold leading-none ${scoreTone(type.coveragePct)}`}>
                    {type.coveragePct}%
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {type.chaptersCovered} of {coverage.chapters} chapters carry the source section
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, type.coveragePct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* the model's live vocabulary — proves nothing here is hardcoded */}
            <div className="grid gap-4 lg:grid-cols-3">
              <VocabCard
                icon={<Sparkles className="h-4 w-4" />}
                title="Bloom ladder"
                subtitle={`${vocabulary.bloomLevels.length} levels → 5 practice rungs`}
                items={vocabulary.bloomLevels.map((b) => `L${b.practiceLevel} ${b.label}`)}
              />
              <VocabCard
                icon={<FileSearch className="h-4 w-4" />}
                title="Indian cultural contexts"
                subtitle={`${coverage.culturalAssignedNodes} nodes assigned so far`}
                items={vocabulary.culturalContexts.map(humanise)}
              />
              <VocabCard
                icon={<Languages className="h-4 w-4" />}
                title="Language variants"
                subtitle={`${coverage.languageVariantRows} stored across ${coverage.nodesWithVariants} nodes`}
                items={vocabulary.languages}
              />
            </div>

            {/* authoring pipeline */}
            <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">Authoring pipeline</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Only {vocabulary.servableStatuses.join(', ')} content is ever served to a learner,
                    so the review queue is the gate rather than a nicety.
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {coverage.nodesTouched} node{coverage.nodesTouched === 1 ? '' : 's'} touched
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {vocabulary.qualityStatuses.map((status) => (
                  <div
                    key={status}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2"
                  >
                    <span className="text-xs text-slate-500">{humanise(status)}</span>
                    <span className="font-mono text-sm font-semibold text-slate-800">
                      {coverage.pipeline[status] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* chapter picker */}
            <div className="rounded-2xl border border-[#DFE6F2] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
                <h2 className="text-[15px] font-semibold text-[#1F2A44]">Extracted chapters</h2>

                <div className="relative ml-auto">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search chapter or subject"
                    className="h-9 w-64 rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
                  />
                </div>

                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="">All subjects</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  value={standard}
                  onChange={(e) => setStandard(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="">All grades</option>
                  {standards.map((s) => (
                    <option key={s} value={String(s)}>
                      Grade {s}
                    </option>
                  ))}
                </select>
              </div>

              {visible.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  {chapters.length === 0
                    ? 'No extracted chapters are available for this institute yet. Run the chapter extraction pipeline first — the Content Model reads whatever it produces.'
                    : 'No chapter matches these filters.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-semibold">Chapter</th>
                        <th className="px-4 py-2.5 font-semibold">Subject</th>
                        <th className="px-4 py-2.5 font-semibold">Grade</th>
                        <th className="px-4 py-2.5 font-semibold">Concepts</th>
                        <th className="px-4 py-2.5 font-semibold">Extraction</th>
                        <th className="px-4 py-2.5 font-semibold">Quality</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((chapter) => (
                        <tr key={chapter.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-800">
                              {chapter.chapterName || `Chapter ${chapter.chapterNumber ?? '—'}`}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{chapter.subjectName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{chapter.standard ?? '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">
                            {chapter.totalConcepts}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{chapter.llmModel}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                chapter.qualityFlag === 'good'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}
                            >
                              {chapter.qualityFlag || 'unrated'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link href={`/pal/new/content-model/chapter?id=${chapter.id}`}>
                              <Button variant="outline" size="sm">
                                Open model
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {!coverage.aiAvailable && coverage.aiUnavailableReason ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <span className="font-semibold">AI enrichment unavailable.</span>{' '}
                  {coverage.aiUnavailableReason}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function VocabCard({
  icon,
  title,
  subtitle,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#1F2A44]">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
