'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Search, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import NewPalNav from '@/app/pal/new/_components/NewPalNav';
import CoherenceMapView from '@/app/pal/new/_components/CoherenceMapView';
import {
  chapterLabel,
  fetchCoherenceHealth,
  fetchCoherenceMap,
  fetchCoherenceScopes,
  stateLabel,
  type CoherenceHealth,
  type CoherenceMap,
  type CoherenceScope,
  type ReadinessMap,
} from '@/app/pal/new/data/coherence-map';

/**
 * New PAL → Coherence Map — workspace.
 *
 * Shows the concept prerequisite graph for one class and subject: what each
 * concept needs before it, what it unlocks after it, and what content and
 * questions are attached to teach and assess it.
 *
 * Everything on this page comes from `/api/pal/coherence/*`. Nothing about the
 * curriculum is hardcoded here — including the scope list, which is fetched so
 * the picker can never offer a combination that 404s.
 *
 * The banner is not decoration. On the live data every prerequisite link is an
 * unreviewed AI suggestion, the graph contains cycles, and no link crosses a
 * chapter boundary. A map that hides that reads as curriculum fact, which it is
 * not, so the counts are shown before the picture.
 */
export default function CoherenceMapPage() {
  const [scopes, setScopes] = useState<CoherenceScope[]>([]);
  const [scope, setScope] = useState<CoherenceScope | null>(null);
  const [map, setMap] = useState<CoherenceMap | null>(null);
  const [health, setHealth] = useState<CoherenceHealth | null>(null);
  const [readiness] = useState<ReadinessMap | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [showRequires, setShowRequires] = useState(true);
  const [showCross, setShowCross] = useState(true);

  // --- load the scope list once -------------------------------------------
  useEffect(() => {
    const controller = new AbortController();

    fetchCoherenceScopes(controller.signal)
      .then((list) => {
        setScopes(list);
        // Open on the richest scope. A map with concepts but no prerequisite
        // links is a list, and landing on one makes the feature look broken.
        setScope(list[0] ?? null);
        if (list.length === 0) {
          setError('No coherence map has been projected for this institute yet.');
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load the scope list.');
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // --- load the map whenever the scope changes ----------------------------
  const load = useCallback(
    (target: CoherenceScope, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setSelectedId(null);

      Promise.all([
        fetchCoherenceMap({ standardId: target.standardId, subjectId: target.subjectId }, signal),
        fetchCoherenceHealth({ standardId: target.standardId, subjectId: target.subjectId }, signal),
      ])
        .then(([nextMap, nextHealth]) => {
          if (signal?.aborted) return;
          setMap(nextMap);
          setHealth(nextHealth);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setError(err instanceof Error ? err.message : 'Could not load the coherence map.');
          setMap(null);
          setLoading(false);
        });
    },
    []
  );

  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    load(scope, controller.signal);
    return () => controller.abort();
  }, [scope, load]);

  const selected = useMemo(
    () => (map && selectedId !== null ? map.nodes.find((n) => n.id === selectedId) ?? null : null),
    [map, selectedId]
  );

  const nameOf = useCallback(
    (id: number) => map?.nodes.find((n) => n.id === id)?.name ?? `Concept ${id}`,
    [map]
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      <NewPalNav />

      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Coherence map</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            What each concept needs before it, what it unlocks after it, and what is attached to teach it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scope ? `${scope.standardId}:${scope.subjectId}` : ''}
            onChange={(event) => {
              const [standardId, subjectId] = event.target.value.split(':').map(Number);
              setScope(
                scopes.find((s) => s.standardId === standardId && s.subjectId === subjectId) ?? null
              );
            }}
            aria-label="Class and subject"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {scopes.map((s) => (
              <option key={`${s.standardId}:${s.subjectId}`} value={`${s.standardId}:${s.subjectId}`}>
                {s.standardName} — {s.subjectName} ({s.concepts} concepts, {s.requires} links)
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search concepts…"
              aria-label="Search concepts"
              className="w-52 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => scope && load(scope)}
            disabled={loading || !scope}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* the counts, before the picture */}
      {map && health ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DFE6F2] bg-white px-4 py-2.5 text-sm text-slate-600">
          <span><strong className="text-slate-900">{map.stats.concepts}</strong> concepts</span>
          <span className="text-slate-300">·</span>
          <span><strong className="text-slate-900">{map.stats.requires}</strong> prerequisite links</span>
          <span className="text-slate-300">·</span>
          <span><strong className="text-slate-900">{map.stats.crossLinks}</strong> related</span>
          <span className="text-slate-300">·</span>
          <span><strong className="text-slate-900">{map.stats.roots}</strong> entry points</span>
          <span className="text-slate-300">·</span>
          <span>deepest chain <strong className="text-slate-900">{map.stats.maxDepth}</strong></span>

          {!map.stats.acyclic ? (
            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-rose-700">
              {health.cycles.length} on a cycle
            </span>
          ) : null}
          {map.stats.isolated > 0 ? (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-700">
              {map.stats.isolated} unlinked
            </span>
          ) : null}
          {map.stats.draftEdges > 0 ? (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-700">
              {map.stats.draftEdges} draft links, AI-tagged
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading && !map ? (
        <div className="flex h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading the coherence map…
        </div>
      ) : null}

      {map ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            {/* legend + link toggles */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#DFE6F2] bg-white px-4 py-2 text-xs text-slate-600">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showRequires} onChange={(e) => setShowRequires(e.target.checked)} />
                <span className="inline-block h-0 w-4 border-t-2 border-[#0B6B60]" />
                Prerequisite
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showCross} onChange={(e) => setShowCross(e.target.checked)} />
                <span className="inline-block h-0 w-4 border-t-2 border-dashed border-slate-400" />
                Related
              </label>
              <span className="text-slate-400">Arrow points from the prerequisite to what needs it</span>
              <span className="ml-auto text-slate-400">▣ has content · ? has questions</span>
            </div>

            <CoherenceMapView
              map={map}
              readiness={readiness}
              selectedId={selectedId}
              query={query}
              showRequires={showRequires}
              showCross={showCross}
              onSelect={setSelectedId}
            />

            {/* chapter key — click to find a column */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-[#DFE6F2] bg-white px-4 py-2.5 text-xs text-slate-600">
              {map.chapters.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: ['#0B6B60','#3D5A94','#8A5C07','#6D3F7A','#1F6F8B','#8A4230','#4A6B23','#7A4B6B'][i % 8] }}
                  />
                  {chapterLabel(c)}
                  <span className="text-slate-400">{c.concepts}</span>
                </span>
              ))}
            </div>
          </div>

          {/* drawer */}
          <aside className="rounded-2xl border border-[#DFE6F2] bg-white p-4">
            {selected ? (
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className="text-base font-semibold leading-tight text-slate-900">{selected.name}</h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    #{selected.id}
                    {selected.code ? ` · ${selected.code}` : ''}
                    <br />
                    {selected.chapter ?? `chapter ${selected.chapterId} — no chapter node in the graph`}
                    <br />
                    {selected.bloom ?? 'no bloom level'}
                    {selected.minutes ? ` · ~${selected.minutes} min` : ''}
                    {` · gate ${selected.gate.toFixed(2)}`}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      selected.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {selected.status === 'approved' ? 'reviewed' : 'draft · AI-suggested'}
                  </span>
                  {selected.onCycle ? (
                    <span className="ml-1.5 inline-block rounded bg-rose-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-700">
                      on a cycle
                    </span>
                  ) : null}
                </div>

                {selected.description ? (
                  <p className="text-[13px] leading-relaxed text-slate-600">{selected.description}</p>
                ) : null}

                <Section title={`Needs first — ${selected.prereqIds.length}`}>
                  {selected.prereqIds.length === 0 ? (
                    <Empty>none recorded</Empty>
                  ) : (
                    selected.prereqIds.map((id) => (
                      <Ref key={id} label={nameOf(id)} onClick={() => setSelectedId(id)} />
                    ))
                  )}
                </Section>

                <Section title={`Unlocks — ${selected.unlocksIds.length}`}>
                  {selected.unlocksIds.length === 0 ? (
                    <Empty>nothing depends on this yet</Empty>
                  ) : (
                    selected.unlocksIds.map((id) => (
                      <Ref key={id} label={nameOf(id)} onClick={() => setSelectedId(id)} />
                    ))
                  )}
                </Section>

                <Section title="Attached">
                  <p className="text-[13px] text-slate-600">
                    {selected.contentCount} content · {selected.questionCount} questions
                  </p>
                  {selected.contentCount === 0 && selected.questionCount === 0 ? (
                    <Empty>
                      nothing attached — {map.stats.concepts - map.stats.withContent} of {map.stats.concepts}{' '}
                      concepts in this scope have no content
                    </Empty>
                  ) : null}
                </Section>

                {readiness && readiness[selected.id] ? (
                  <Section title={`Mastery — ${stateLabel(readiness[selected.id].state)}`}>
                    <p className="text-[13px] text-slate-600">
                      p = {readiness[selected.id].mastery.toFixed(2)} · gate{' '}
                      {readiness[selected.id].gate.toFixed(2)}
                    </p>
                  </Section>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-[13px] text-slate-500">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <Share2 className="h-3.5 w-3.5" />
                  Nothing selected
                </p>
                <p>
                  Click a concept to see what it needs first, what it unlocks, and what is attached to
                  teach or assess it.
                </p>
                <p className="rounded-lg bg-slate-50 p-3 leading-relaxed">
                  Every prerequisite link in this scope is an unreviewed AI suggestion, and none of them
                  crosses a chapter boundary. The columns show the syllabus order; the arrows show
                  dependencies within a chapter. The cross-grade progression a coherence map is usually
                  for does not exist in the data yet.
                </p>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-3">
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function Ref({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full py-0.5 text-left text-[13px] text-indigo-600 hover:underline"
    >
      {label}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] italic text-slate-400">{children}</p>;
}
