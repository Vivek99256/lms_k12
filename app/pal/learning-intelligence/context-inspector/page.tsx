'use client';

/**
 * Context Graph Inspector — Unified 4-Layer Context Graph.
 *
 * Connects:
 *   1. User Context: Profile, Standard, Division, Enrolled Subjects, Institute.
 *   2. Learning Activities: Diagnostic attempts, practice items, engagement telemetry.
 *   3. Knowledge Graph: Neo4j prerequisite graph, readiness, root blocker detection.
 *   4. Historical Trajectory: BKT mastery, spaced repetition, previous recommendations & outcomes.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Database,
  GitFork,
  History,
  Layers,
  Lightbulb,
  Loader2,
  Magnet,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import IconBadge from '../_components/IconBadge';
import { HEADER_WASH } from '../_components/design-system';
import {
  fetchUnifiedContextGraph,
  type UnifiedLearnerContextGraph,
} from '../data/context-inspector';

export default function ContextInspectorPage() {
  const searchParams = useSearchParams();
  const defaultLearnerId = searchParams.get('learnerId') || '1';
  const defaultSubjectId = searchParams.get('subjectId') ? Number(searchParams.get('subjectId')) : undefined;

  const [learnerId, setLearnerId] = useState(defaultLearnerId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | undefined>(defaultSubjectId);
  const [contextData, setContextData] = useState<UnifiedLearnerContextGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUnifiedContextGraph(learnerId, selectedSubjectId);
      setContextData(data);
      if (!selectedSubjectId && data.user_context?.primary_subject_id) {
        setSelectedSubjectId(data.user_context.primary_subject_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load context graph.');
    } finally {
      setLoading(false);
    }
  }, [learnerId, selectedSubjectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const user = contextData?.user_context;
  const activities = contextData?.learning_activities;
  const kg = contextData?.knowledge_graph;
  const history = contextData?.historical_context;
  const nba = contextData?.next_best_action;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <header className={`mx-auto mb-6 flex max-w-5xl items-center justify-between gap-3 rounded-2xl p-5 ${HEADER_WASH}`}>
        <div className="flex items-center gap-3">
          <IconBadge icon={Magnet} accent="brand" size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">Context Graph Inspector</h1>
              <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800">
                4-Layer Model
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Personalized learning intelligence uniting User Context, Activities, Knowledge Graph & Trajectory.
            </p>
          </div>
        </div>

        {user && (
          <div className="text-right">
            <span className="text-xs text-slate-400">Institute Scope</span>
            <div className="text-sm font-medium text-slate-800">{user.institute_name}</div>
          </div>
        )}
      </header>

      {/* Controls & Subject Selector */}
      <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-slate-400" />
          <div>
            <span className="text-xs text-slate-400">Selected Learner</span>
            <div className="text-sm font-semibold text-slate-800">
              {user ? user.name : `Learner #${learnerId}`} (ID: {learnerId})
            </div>
          </div>
        </div>

        {user?.enrolled_subjects && user.enrolled_subjects.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Subject:</span>
            <div className="flex flex-wrap gap-1.5">
              {user.enrolled_subjects.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedSubjectId === sub.id
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="mx-auto flex max-w-5xl items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          <span className="ml-3 text-sm text-slate-500">Assembling 4-layer context graph…</span>
        </div>
      )}

      {error && !loading && (
        <div className="mx-auto max-w-5xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Unable to load Context Graph
          </div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && contextData && (
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Next Best Action Card (Graph-Aware) */}
          {nba && (
            <div className="overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Next Best Action</span>
                      <Badge className="bg-sky-600 text-white">
                        {nba.action === 'unblock'
                          ? 'Unblock Prerequisite'
                          : nba.action === 'consolidate'
                          ? 'Consolidate Mastery'
                          : nba.action === 'advance'
                          ? 'Advance Syllabus'
                          : 'Spaced Review'}
                      </Badge>
                      {nba.graph_aware && (
                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                          Neo4j Prerequisite Verified
                        </Badge>
                      )}
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {nba.target_concept?.name || nba.concept?.name || 'Recommended Target Concept'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{nba.reason || nba.why?.because}</p>
                  </div>
                </div>
              </div>

              {/* Root Blocker Alert */}
              {nba.roots && nba.roots.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Root Prerequisite Blocker Detected:
                  </div>
                  <div className="mt-1 space-y-1">
                    {nba.roots.map((root: any) => (
                      <div key={root.id} className="flex items-center justify-between">
                        <span>
                          <strong>{root.name}</strong> (Mastery: {Math.round(root.mastery * 100)}% vs Gate:{' '}
                          {Math.round(root.gate * 100)}%)
                        </span>
                        <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-bold">
                          {root.depth} step(s) back
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4 Layers Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Layer A: User Context */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <User className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800">Layer A: User Context</h3>
              </div>
              {user && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400">Class & Standard</span>
                    <p className="font-medium text-slate-800">{user.standard_name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Division</span>
                    <p className="font-medium text-slate-800">{user.division_name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Admission No</span>
                    <p className="font-medium text-slate-800">{user.admission_no || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Roll No</span>
                    <p className="font-medium text-slate-800">{user.roll_no || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-400">Enrolled Subjects</span>
                    <p className="font-medium text-slate-800">
                      {user.enrolled_subjects.map((s) => s.name).join(', ') || 'None registered'}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Layer B: Learning Activities */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Activity className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-800">Layer B: Learning Activities & Telemetry</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400">Recent Diagnostic Attempts</span>
                  {activities?.recent_diagnostics && activities.recent_diagnostics.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {activities.recent_diagnostics.slice(0, 3).map((d) => (
                        <div key={d.id} className="flex justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                          <span>Chapter #{d.chapter_id}</span>
                          <span className="font-medium text-slate-700">
                            Score: {d.score} / {d.total_questions} ({d.status})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No diagnostic attempts recorded yet.</p>
                  )}
                </div>

                <div>
                  <span className="text-xs text-slate-400">Recent Practice Accuracy</span>
                  {activities?.recent_practice && activities.recent_practice.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {activities.recent_practice.slice(0, 3).map((p) => (
                        <div key={p.id} className="flex justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                          <span>Concept #{p.concept_id}</span>
                          <span className="font-semibold text-emerald-600">{p.accuracy}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No practice sessions recorded yet.</p>
                  )}
                </div>

                <div className="flex justify-between rounded-lg bg-emerald-50/50 p-2 text-xs">
                  <span className="text-emerald-800">Total Engagement Interactions:</span>
                  <span className="font-bold text-emerald-900">{activities?.total_engagement_events || 0}</span>
                </div>
              </div>
            </section>

            {/* Layer C: Knowledge Graph Relationships */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <GitFork className="h-5 w-5 text-sky-600" />
                <h3 className="font-semibold text-slate-800">Layer C: Knowledge Graph Relationships</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded bg-sky-50 p-2">
                    <span className="block font-bold text-sky-900">{kg?.stats?.concepts || kg?.nodes?.length || 0}</span>
                    <span className="text-sky-700">Concepts</span>
                  </div>
                  <div className="rounded bg-sky-50 p-2">
                    <span className="block font-bold text-sky-900">{kg?.stats?.requires || kg?.edges?.length || 0}</span>
                    <span className="text-sky-700">Prerequisites</span>
                  </div>
                  <div className="rounded bg-sky-50 p-2">
                    <span className="block font-bold text-sky-900">{kg?.stats?.chapters || kg?.chapters?.length || 0}</span>
                    <span className="text-sky-700">Chapters</span>
                  </div>
                </div>

                {kg?.root_blockers && kg.root_blockers.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                    <span className="text-xs font-semibold text-amber-900">
                      Unmastered Root Blockers ({kg.root_blockers.length}):
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {kg.root_blockers.map((rb) => (
                        <Badge key={rb.id} variant="outline" className="border-amber-300 bg-white text-amber-800 text-[11px]">
                          {rb.name} ({Math.round(rb.mastery * 100)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Layer D: Historical Trajectory */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <History className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-slate-800">Layer D: Historical Trajectory & Decisions</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400">Recent Recommendation Audit Trail</span>
                  {history?.recent_recommendations && history.recent_recommendations.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {history.recent_recommendations.slice(0, 3).map((r) => (
                        <div key={r.id} className="rounded bg-slate-50 px-2 py-1 text-xs">
                          <div className="flex justify-between font-medium text-slate-700">
                            <span>{r.pedagogy_type || 'recommendation'}</span>
                            <span className="text-slate-400">{r.recommended_at?.slice(0, 10)}</span>
                          </div>
                          <p className="truncate text-slate-500">{r.reason}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No recommendation audit rows recorded yet.</p>
                  )}
                </div>

                <div>
                  <span className="text-xs text-slate-400">Recent Competencies</span>
                  {history?.recent_competencies && history.recent_competencies.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {history.recent_competencies.slice(0, 6).map((c) => (
                        <span
                          key={c.concept_id}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          Concept #{c.concept_id}: <strong>{c.mastery_score}%</strong>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No competency rows available.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
