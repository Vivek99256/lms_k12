'use client';

/**
 * The Context Graph Inspector's five-stage view: Student State → Relevant
 * Learning Context → Concept Relationships → Decision Inputs →
 * Recommended Next Action.
 *
 * This sequence is a PRESENTATION GUIDE, not five backend stages — the
 * brief is explicit that this must not be assumed. What backs each stage:
 *   - Student State / Relevant Learning Context: EsoPolicyService::
 *     conceptMasteryDetails() — one persisted read.
 *   - Concept Relationships: EsoPolicyService::chapterKnowledgeMap() — the
 *     same canvas the Knowledge Graph Explorer uses, so a relationship
 *     looks the same in both places.
 *   - Decision Inputs / Recommended Next Action: the most recent
 *     eso_decision_log row — a PERSISTED fact, never a fresh call to
 *     nextAction() for a non-student viewer (see EsoEngineController::
 *     contextInspector()'s own docblock for why). Only the enrolled
 *     student themselves may additionally request a live, freshly
 *     computed check — rendered in its own clearly separate panel so it is
 *     never mistaken for the persisted row above it.
 */

import React from 'react';
import { AlertTriangle, ArrowRight, Clock, Database, Lightbulb, Target, User, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ConceptRelationshipGraph from '../../_components/ConceptRelationshipGraph';
import { mapConceptRelationships } from '../../_components/graph-mappers';
import { ACCENT, type AccentKey } from '../../_components/design-system';
import type { ContextInspectorData } from '../../data/context-inspector';

function Stage({
  index,
  title,
  icon: Icon,
  accent,
  children,
}: {
  index: number;
  title: string;
  icon: LucideIcon;
  accent: AccentKey;
  children: React.ReactNode;
}) {
  const { solid, text, bg } = ACCENT[accent];
  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1 w-full bg-gradient-to-r ${ACCENT[accent].gradient}`} />
      <div className="p-5">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${solid} text-xs font-bold text-white shadow-sm`}>
            {index}
          </span>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <span className={`flex h-6 w-6 items-center justify-center rounded-md ${bg} ${text}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            {title}
          </h3>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default function AssemblyPipeline({ data }: { data: ContextInspectorData }) {
  const m = data.masteryDetails;
  const latest = data.latestDecision;
  const relGraph = data.knowledgeMap ? mapConceptRelationships(data.knowledgeMap) : null;

  return (
    <div className="space-y-4">
      <p className="text-xs italic text-slate-400">
        The five sections below are a way of reading the evidence, not five separate things the backend stores — each
        is labelled with the one real read it came from.
      </p>

      <Stage index={1} title="Student State" icon={User} accent="brand">
        {m ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact label="Status" value={<Badge variant="outline">{m.status}</Badge>} />
            <Fact label="Knowledge mastery" value={m.knowledgeMastery == null ? '—' : `${Math.round(m.knowledgeMastery * 100)}%`} />
            <Fact label="Application mastery" value={m.applicationMastery == null ? '—' : `${Math.round(m.applicationMastery * 100)}%`} />
            <Fact label="Attempts" value={m.attempts} />
            <Fact label="Retention stage" value={m.retention.stageLabel ?? '—'} />
            <Fact label="Due for review" value={m.retention.dueNow ? 'Yes' : 'No'} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">No mastery record for this student on this concept yet.</p>
        )}
      </Stage>

      <Stage index={2} title="Relevant Learning Context" icon={Database} accent="info">
        {m && (m.misconceptions.length > 0 || m.recentResponses.length > 0) ? (
          <div className="space-y-3">
            {m.misconceptions.length > 0 ? (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Misconceptions seen</h4>
                <ul className="space-y-1 text-sm">
                  {m.misconceptions.map((mc, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="text-slate-700">{mc.description}</span>
                      <Badge variant={mc.corrected ? 'outline' : 'default'} className={mc.corrected ? 'border-emerald-300 text-emerald-700' : 'bg-amber-100 text-amber-800'}>
                        {mc.corrected ? 'Corrected' : 'Open'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {m.recentResponses.length > 0 ? (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent activity</h4>
                <ul className="space-y-1 text-sm text-slate-600">
                  {m.recentResponses.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={r.correct ? 'text-emerald-600' : 'text-rose-600'}>{r.correct ? '✓' : '✗'}</span>
                      <span className="truncate">{r.question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No recent activity or misconceptions recorded for this concept.</p>
        )}
      </Stage>

      <Stage index={3} title="Concept Relationships" icon={Target} accent="success">
        {relGraph && relGraph.nodes.length > 0 ? (
          <ConceptRelationshipGraph nodes={relGraph.nodes} edges={relGraph.edges} heightClassName="h-[380px]" />
        ) : (
          <p className="text-sm text-slate-500">No concept-relationship graph available for this concept.</p>
        )}
      </Stage>

      <Stage index={4} title="Decision Inputs" icon={Clock} accent="purple">
        {latest ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Badge variant="outline">
                Persisted · {new Date(latest.createdAt).toLocaleString()}
              </Badge>
            </div>
            <Fact label="Rule fired" value={latest.ruleFired} />
            {latest.stateSnapshot ? (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {JSON.stringify(latest.stateSnapshot, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">No state snapshot was recorded with this decision.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No decision has been logged for this student on this concept yet.</p>
        )}
      </Stage>

      <Stage index={5} title="Recommended Next Action" icon={ArrowRight} accent="warning">
        {latest ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Badge variant="outline">Persisted — from the decision above</Badge>
            <p className="mt-2 text-sm text-slate-800">{latest.action.replace(/_/g, ' ')}</p>
            {latest.llmInstruction ? <p className="mt-1 text-xs text-slate-500">{latest.llmInstruction}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No recommendation on record yet.</p>
        )}

        {data.liveNextAction ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              Freshly computed for you just now — this call also wrote a new decision-log row
            </Badge>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-900">
              <Lightbulb className="h-3.5 w-3.5" />
              {data.liveNextAction.action.replace(/_/g, ' ')}
            </p>
          </div>
        ) : null}
      </Stage>
    </div>
  );
}
