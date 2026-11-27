'use client';

import { Loader2 } from 'lucide-react';

import { NoData, SeverityChip, SeverityRail, resolveTone } from '@/components/intelligence/module/primitives';
import type {
  PalAgentManifest,
  PalPendingRecommendation,
  PalTopPick,
} from '@/app/pal/recommendation/_lib/pal-recommendation-api';

/**
 * Generalised forms of Fees' own `NextBestActionCard`/`AgenticStatusCard`
 * (`app/fees/recommendation/_components/intelligence-sections.tsx`) — a new
 * file rather than an edit to that one, so Fees' screen is untouched. "Generic"
 * here means "not Fees-specific", not "no concrete types": both components
 * take PAL's own `PalTopPick`/`PalAgentManifest`/`PalPendingRecommendation`
 * shapes directly, since nothing about them is actually shared with Fees —
 * only the visual language is.
 */

/**
 * Recommendation Intelligence's "top pick" — generalised from Fees' card to
 * also handle `topPick.governed === false`: PAL's real-time
 * `coherence_recommender` fallback (`PalNextBestActionResolver::realtimeFallback`),
 * surfaced only when no governed recommendation or open case exists yet. An
 * ungoverned pick is not a recommendation row at all — nothing has been
 * drafted, nothing is waiting for approval — so it renders in a visually
 * distinct amber/informational badge instead of the severity-tone rail, and
 * skips the "Requires human approval" line entirely rather than showing it
 * as false.
 */
export function GenericNextBestActionCard({
  available,
  reason,
  topPick,
}: {
  available: boolean;
  reason: string | null;
  topPick: PalTopPick | null;
}) {
  if (!available || !topPick) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <SeverityRail tone="low" />
        <div className="pl-4">
          <NoData bare detail="No next action to show" reason={reason} hint={null} />
        </div>
      </div>
    );
  }

  if (!topPick.governed) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="py-4 pl-5 pr-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
              {topPick.label ?? 'Real-time suggestion, not yet reviewed by a person.'}
            </span>
            {topPick.risk_level ? (
              <SeverityChip tone={resolveTone(topPick.risk_level)}>{topPick.risk_level}</SeverityChip>
            ) : null}
          </div>

          <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">{topPick.title}</h3>

          {topPick.concept?.chapter ? (
            <p className="mt-1 text-[12.5px] text-slate-600">Chapter: {String(topPick.concept.chapter)}</p>
          ) : null}

          {topPick.action ? <p className="mt-1 text-[12px] text-slate-500">Suggested action: {topPick.action}</p> : null}
        </div>
      </div>
    );
  }

  const tone = resolveTone(topPick.risk_level);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <SeverityRail tone={tone} />
      <div className="py-4 pl-5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          {topPick.risk_level ? <SeverityChip tone={tone}>{topPick.risk_level}</SeverityChip> : null}
          <span className="text-[12px] text-slate-500">
            {topPick.source === 'recommendation' ? 'Governed recommendation' : 'Open case (no recommendation yet)'}
          </span>
        </div>

        <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">{topPick.title}</h3>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
          {topPick.confidence !== null ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Confidence</dt>
              <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{topPick.confidence.toFixed(2)}</dd>
            </div>
          ) : null}
          {topPick.evidence_ids.length > 0 ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence cited</dt>
              <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{topPick.evidence_ids.length}</dd>
            </div>
          ) : null}
          {topPick.workflow_key ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Workflow</dt>
              <dd className="mt-0.5 text-[13px] font-bold text-slate-900">{topPick.workflow_key}</dd>
            </div>
          ) : null}
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-0.5 text-[13px] font-bold text-slate-900">{topPick.status}</dd>
          </div>
        </dl>

        {topPick.evidence_records && topPick.evidence_records.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[12.5px] leading-5 text-slate-600">
            {topPick.evidence_records.map((record) => (
              <li key={record.id} className="flex items-start gap-1.5">
                <span>·</span>
                <span>
                  {record.summary}
                  {!record.verified ? <span className="ml-1.5 text-amber-600">(not verified)</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {topPick.requires_approval ? (
          <p className="mt-3 text-[12px] text-slate-500">Requires human approval before anything executes.</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Agentic Intelligence's roster + approval queue — simpler than Fees' own
 * `AgenticStatusCard`: PAL has no bespoke scheduler service behind it, so
 * there is no start/stop/interval here, only a manual "Run now" per agent
 * against the same `/api/ai/agents/{key}/run` route the AI Stack console
 * already uses.
 *
 * `pendingRecommendations` is PAL's actual approval surface, not
 * `ModuleApprovalQueue` — that component filters by `workflow_key`, which
 * these drafts never carry (they are deliberately `is_consequential:false`,
 * see `PalRecommendationIntelligenceController::pendingRecommendations`), so
 * it would always render empty for PAL.
 */
export function GenericAgentStatusCard({
  agents,
  pendingRecommendations,
  executionNote,
  onRunAgent,
  onApprove,
  onReject,
  onDefer,
  busyId,
}: {
  agents: PalAgentManifest[];
  pendingRecommendations: PalPendingRecommendation[];
  executionNote: string;
  onRunAgent: (agentKey: string) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onDefer: (id: number) => void;
  /** The agent key or recommendation id currently in flight, or null when nothing is — disables its own row's buttons and shows a spinner. */
  busyId: string | number | null;
}) {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="py-4 pl-5 pr-4">
          <h3 className="text-[13.5px] font-bold text-slate-900">PAL agent roster</h3>

          {agents.length === 0 ? (
            <div className="mt-2">
              <NoData bare detail="No PAL agents are registered for this school yet." reason={null} hint={null} />
            </div>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {agents.map((agent) => (
                <li key={agent.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">{agent.name}</p>
                      {agent.purpose ? (
                        <p className="mt-0.5 text-[12px] leading-5 text-slate-600">{agent.purpose}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                        {agent.max_verb}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                          agent.may_execute_actions
                            ? 'bg-green-50 text-green-800 ring-green-200'
                            : 'bg-slate-100 text-slate-700 ring-slate-200'
                        }`}
                      >
                        {agent.may_execute_actions ? 'may execute' : 'recommend only'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRunAgent(agent.key)}
                        disabled={busyId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {busyId === agent.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Run now
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="py-4 pl-5 pr-4">
          <h3 className="text-[13.5px] font-bold text-slate-900">Waiting for a decision</h3>

          {pendingRecommendations.length === 0 ? (
            <div className="mt-2">
              <NoData bare detail="Nothing is waiting on a decision right now." reason={null} hint={null} />
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {pendingRecommendations.map((rec) => {
                const tone = resolveTone(rec.risk_level);
                const busy = busyId === rec.id;

                return (
                  <li key={rec.id} className="rounded-lg border border-slate-200 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {rec.risk_level ? <SeverityChip tone={tone}>{rec.risk_level}</SeverityChip> : null}
                      <span className="text-[11px] text-slate-500">{rec.status}</span>
                    </div>

                    <h4 className="mt-1.5 text-[14px] font-bold leading-snug text-slate-900">{rec.title}</h4>
                    {rec.body ? <p className="mt-1 text-[12.5px] leading-5 text-slate-700">{rec.body}</p> : null}
                    {rec.rationale ? (
                      <p className="mt-1 text-[12px] leading-5 text-slate-500">
                        <span className="font-semibold text-slate-600">Why: </span>
                        {rec.rationale}
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-slate-500">
                      {rec.confidence !== null ? <span>Confidence {rec.confidence.toFixed(2)}</span> : null}
                      <span>{rec.evidence_count} evidence item(s)</span>
                      <span>{rec.created_at}</span>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(rec.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(rec.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => onDefer(rec.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Defer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Always visible, never conditional — the "nothing executes automatically" disclosure. */}
      <p className="text-[12px] text-slate-500">{executionNote}</p>
    </div>
  );
}
