'use client';

/**
 * The curated Curriculum Structure view — Subject -> Chapters -> Concepts,
 * in teaching order, via the `curriculum-structure` ontology view seeded
 * 2026-11-19 (`database/migrations/2026_11_19_100000_seed_teach_learn_curriculum_ontology_views.php`).
 *
 * Deliberately separate from `ModuleKnowledgeGraph` (the bubble-canvas
 * sample every module's "Knowledge Graph" tab already shows, including
 * Teach/Learn's — that one is a connected-sample explorer; this one is an
 * ordered, read-only curriculum list for one subject at a time, reading
 * through `fetchOntologyView`/`fetchModuleViews`, not `GraphModuleBrowser`).
 * Rendered additively alongside it in Teach/Learn's Knowledge Graph tab —
 * no other module's tab is affected.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight, Layers, Loader2, ServerCrash } from 'lucide-react';

import { searchKnowledgeGraph } from '@/lib/intelligence/client';
import { fetchModuleViews, fetchOntologyView, type OntologyViewSummary } from '@/lib/intelligence/workspace';
import { mapOntologyViewResult } from './graph/graph-query-mapper';
import { readGraphSession } from './graph/graph-session';
import type { KgHop } from './graph/graph-model';

interface SubjectOption {
  /**
   * The SQL `subject.id`, NOT the node's Neo4j `recordId` — `recordId` is
   * Neo4j's internal id (`id(n)`), a different id space `GraphModuleBrowser`
   * itself hands the frontend for cross-label canvas purposes, but the
   * ontology-view walk (`OntologyViewResolver`/`GraphQueryService`, a
   * separate SQL-aware layer) resolves `entity_id` against the domain
   * primary key. Confirmed live: passing `recordId` here returns "That
   * relationship view is not available here"; `attributes.id` works.
   */
  domainId: number;
  label: string;
}

const VIEW_KEY = 'curriculum-structure';

export function CurriculumStructureView({ moduleName }: { moduleName: string }) {
  const session = useMemo(() => readGraphSession(), []);
  const route = `/modules/${moduleName}/knowledge-graph`;

  const [viewAvailable, setViewAvailable] = useState<boolean | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);
  const [hops, setHops] = useState<KgHop[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState('');

  const loadForSubject = useCallback(
    async (subject: SubjectOption) => {
      setSelectedSubject(subject);
      setStatus('loading');
      setError('');

      try {
        const result = await fetchOntologyView(session, VIEW_KEY, {
          route,
          entity_type: 'subject',
          entity_id: subject.domainId,
        });
        const mapped = mapOntologyViewResult(result);

        setHops(mapped.hops);
        setStatus(mapped.hops.some((h) => h.available && h.total > 0) ? 'ready' : 'empty');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to walk the curriculum structure view.');
        setStatus('error');
      }
    },
    [session, route]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const viewsPayload = await fetchModuleViews(session, { route, module: moduleName });
        const views: OntologyViewSummary[] = Array.isArray(viewsPayload?.views) ? viewsPayload.views : [];
        const available = views.some((v) => v.key === VIEW_KEY);

        if (cancelled) return;
        setViewAvailable(available);

        if (!available) {
          setStatus('empty');
          return;
        }

        const searchRes = await searchKnowledgeGraph(session, '', 50, ['Subject']);
        const options: SubjectOption[] = (searchRes?.nodes ?? [])
          .map((n) => {
            const rawId = n.attributes?.id;
            const domainId = typeof rawId === 'number' ? rawId : typeof rawId === 'string' ? Number(rawId) : NaN;
            return Number.isFinite(domainId) ? { domainId, label: n.label } : null;
          })
          .filter((option): option is SubjectOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label));

        if (cancelled) return;
        setSubjects(options);

        if (options.length > 0) {
          await loadForSubject(options[0]);
        } else {
          setStatus('empty');
        }
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Failed to load the curriculum structure view.');
        setStatus('error');
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleName]);

  if (viewAvailable === false) {
    // Honest "not set up for this module yet" — same rule
    // ModuleKnowledgeGraph itself follows, never a fabricated view.
    return null;
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Layers className="h-4 w-4 text-blue-500" />
          Curriculum structure
        </div>

        {subjects.length > 0 && (
          <select
            aria-label="Select subject"
            value={selectedSubject ? String(selectedSubject.domainId) : ''}
            onChange={(e) => {
              const next = subjects.find((s) => String(s.domainId) === e.target.value);
              if (next) void loadForSubject(next);
            }}
            className="h-8 rounded-md border border-slate-300 bg-white px-2.5 pr-8 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {subjects.map((s) => (
              <option key={String(s.domainId)} value={String(s.domainId)}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="p-4">
        {status === 'loading' && (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading curriculum structure…
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 py-6 text-sm text-rose-600">
            <ServerCrash className="h-4 w-4" />
            {error}
          </div>
        )}

        {status === 'empty' && (
          <p className="py-6 text-sm text-slate-500">
            No curriculum structure is available for this subject right now.
          </p>
        )}

        {status === 'ready' && (
          <div className="space-y-4">
            {hops.map((hop, index) => (
              <div key={`${hop.relation}-${index}`}>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <BookOpen className="h-3.5 w-3.5" />
                  {hop.label} ({hop.total})
                </div>
                {hop.available ? (
                  <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {hop.items.map((item) => (
                      <li
                        key={`${item.entity}-${String(item.id)}`}
                        className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                      >
                        <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">{hop.reason ?? 'Not available.'}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CurriculumStructureView;
