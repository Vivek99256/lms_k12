'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  BookOpen,
  FolderTree,
  Users,
  GraduationCap,
  Target,
  Radio,
  FileSearch,
  Workflow,
  Gauge,
  GitBranch,
  FlaskConical,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { fetchClassIntelligence, fetchExecutive } from '@/lib/brain/api';
import { useBrainResource } from './_components/useBrainResource';
import { Card, ErrorState, LoadingState } from './_components/primitives';
import { Delta, EvidenceStrip, HealthDial, IntelligenceCard } from './_components/IntelligenceCard';
import type { BrainClassIntelligence, BrainExecutivePayload } from '@/lib/brain/api';

/* ------------------------------------------------------------------ header context */

/**
 * When the numbers on this page were read out of the LMS.
 *
 * `generatedAt` is stamped as the request is served, so the old "Data fresh · 1
 * min ago" was true by construction and told the reader nothing. What is worth
 * saying is the clock time the figures were read, and — separately — when the
 * findings beneath them were last recomputed.
 */
function DataFreshness({ generatedAt, findingsRefreshedAt }: { generatedAt: string; findingsRefreshedAt?: string | null }) {
  const readAt = new Date(generatedAt);
  const time = Number.isNaN(readAt.getTime())
    ? null
    : readAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {time ? `Read from the LMS at ${time}` : 'Read from the LMS'}
      {findingsRefreshedAt ? ` · findings last refreshed ${relativeTime(findingsRefreshedAt)}` : ''}
    </span>
  );
}

/** "3 days ago" / "just now" — never a date a reader has to subtract. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'at an unknown time';

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/* ------------------------------------------------------------------ organization hero */

function OrganizationHero({
  organization,
  academicYear,
  health,
  counts,
  generatedAt,
  findingsRefreshedAt,
}: {
  organization: string;
  academicYear: NonNullable<BrainExecutivePayload['academicYear']>;
  health: NonNullable<BrainExecutivePayload['health']>;
  counts: NonNullable<BrainExecutivePayload['counts']>;
  generatedAt: string;
  findingsRefreshedAt?: string | null;
}) {
  const overall = health.overall;
  const scoreColor =
    overall.band === 'Good'
      ? 'text-emerald-700'
      : overall.band === 'Watch'
        ? 'text-amber-700'
        : overall.band === 'At risk'
          ? 'text-orange-700'
          : overall.band === 'Critical'
            ? 'text-rose-700'
            : 'text-slate-700';

  return (
    <section className="mb-8">
      <Card className="overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Enterprise Brain · Overview</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{organization}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                {academicYear.title ? (
                  <span className="flex items-center gap-1.5">
                    <BookOpen size={13} className="text-slate-500" />
                    {academicYear.title}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-500">Academic year not set</span>
                )}
                <DataFreshness generatedAt={generatedAt} findingsRefreshedAt={findingsRefreshedAt} />
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-4">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Overall health</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className={`text-3xl font-semibold tabular-nums ${scoreColor}`}>
                    {overall.score ?? '—'}
                  </span>
                  <span className="text-sm text-slate-500">/100</span>
                </div>
                <span className={`text-[11px] font-bold ${scoreColor}`}>{overall.band ?? 'Not scored'}</span>
              </div>

              <div className="h-10 w-px bg-slate-700" />

              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Open findings</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{counts.openFindings}</p>
                <p className="text-[11px] text-slate-400">
                  {counts.high} high · {counts.awaitingDecision} awaiting decision
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ foundation cards */

function FoundationCards({ summary }: { summary: NonNullable<BrainExecutivePayload['summary']> }) {
  const cards = [
    {
      label: 'Departments',
      value: summary.foundation.departments,
      href: '/enterprise-brain/foundation/departments',
      icon: FolderTree,
    },
    {
      label: 'People',
      value: summary.foundation.people,
      href: '/enterprise-brain/foundation/people',
      icon: Users,
    },
    {
      label: 'Students',
      value: summary.foundation.students,
      href: '/enterprise-brain/foundation/students',
      icon: GraduationCap,
    },
    {
      label: 'Capabilities',
      value: summary.foundation.capabilities,
      href: '/enterprise-brain/capabilities',
      icon: Target,
    },
  ];

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Foundation</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-gray-300 hover:bg-white"
          >
            <card.icon size={18} className="text-slate-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{card.label}</p>
            <p className="text-xl font-semibold tabular-nums text-slate-900">{card.value.toLocaleString()}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ intelligence state */

function IntelligenceState({ summary }: { summary: NonNullable<BrainExecutivePayload['summary']> }) {
  const items = [
    { label: 'Signals', value: summary.brain.signals, icon: Radio, href: '/enterprise-brain/intelligence-loop', tone: 'text-rose-600' },
    { label: 'Evidence', value: summary.brain.evidence, icon: FileSearch, href: '/enterprise-brain/intelligence-loop/evidence', tone: 'text-amber-600' },
    { label: 'Recommendations', value: summary.brain.recommendations, icon: Workflow, href: '/enterprise-brain/automation', tone: 'text-indigo-600' },
    { label: 'Decisions', value: summary.brain.decisions, icon: Settings2, href: '/enterprise-brain/automation', tone: 'text-emerald-600' },
    { label: 'Executions', value: summary.brain.executions, icon: FlaskConical, href: '/enterprise-brain/automation', tone: 'text-sky-600' },
    { label: 'Outcomes', value: summary.brain.outcomes, icon: Gauge, href: '/enterprise-brain/automation', tone: 'text-violet-600' },
  ];

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-800">Intelligence state</h2>
        <Link href="/enterprise-brain/intelligence-loop" className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
          Open Intelligence Loop
          <ArrowRight size={13} />
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-gray-300 hover:bg-white"
          >
            <item.icon size={16} className={item.tone} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.label}</p>
            <p className="text-xl font-semibold tabular-nums text-slate-900">{item.value.toLocaleString()}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}



function OrganizationIntelligence({ intelligence }: { intelligence: NonNullable<BrainExecutivePayload['intelligence']> }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold tracking-tight text-slate-800">What&apos;s happening in your organization</h2>
      <p className="mb-4 text-xs text-slate-500">Strengths, risks and opportunities, all derived from the school&apos;s own records.</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Strengths */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-700">Strengths</h3>
          {intelligence.strengths.length === 0 ? (
            <Card className="p-5">
              <p className="text-xs text-slate-400">No scored dimensions are currently in the Good band.</p>
            </Card>
          ) : (
            intelligence.strengths.map((item, idx) => (
              <Card key={`strength-${idx}`} className="border-emerald-100 bg-emerald-50/30 p-5">
                <p className="text-sm font-semibold text-slate-900">{item.dimension}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-emerald-700">{item.score}</span>
                  <span className="text-xs text-emerald-600">/ 100 · {item.band}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.why}</p>
              </Card>
            ))
          )}
        </div>

        {/* Risks */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-rose-700">Risks</h3>
          {intelligence.risks.length === 0 ? (
            <Card className="p-5">
              <p className="text-xs text-slate-400">No critical or high risks identified.</p>
            </Card>
          ) : (
            intelligence.risks.map((item, idx) => (
              <Card key={`risk-${idx}`} className="border-rose-100 bg-rose-50/30 p-5">
                {item.type === 'dimension' ? (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{item.dimension}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tabular-nums text-rose-700">{item.score}</span>
                      <span className="text-xs text-rose-600">/ 100 · {item.band}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.why}</p>
                    {item.action && (
                      <p className="mt-2 rounded-lg bg-rose-100/50 px-3 py-2 text-xs font-medium text-rose-800">
                        {item.action}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        item.severity === 'critical' ? 'bg-rose-100 text-rose-700' :
                        item.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {item.severity}
                      </span>
                    </div>
                    {item.whyItMatters && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.whyItMatters}</p>
                    )}
                    {item.recommendation && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                        {item.recommendation}
                      </p>
                    )}
                    {item.owner && (
                      <p className="mt-1 text-[11px] text-slate-400">Owner: {item.owner}</p>
                    )}
                  </>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Opportunities */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-sky-700">Opportunities</h3>
          {intelligence.opportunities.length === 0 ? (
            <Card className="p-5">
              <p className="text-xs text-slate-400">No dimensions currently sit in the Watch band.</p>
            </Card>
          ) : (
            intelligence.opportunities.map((item, idx) => (
              <Card key={`opp-${idx}`} className="border-sky-100 bg-sky-50/30 p-5">
                <p className="text-sm font-semibold text-slate-900">{item.dimension}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-sky-700">{item.score}</span>
                  <span className="text-xs text-sky-600">/ 100 · {item.band}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.why}</p>
                {item.action && (
                  <p className="mt-2 rounded-lg bg-sky-100/50 px-3 py-2 text-xs font-medium text-sky-800">
                    {item.action}
                  </p>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ priority actions */

function PriorityActions({
  actions,
  recommendedFocus,
}: {
  actions: NonNullable<BrainExecutivePayload['actions']>;
  recommendedFocus: NonNullable<BrainExecutivePayload['intelligence']>['recommendedFocus'];
}) {
  const hasActions = actions.length > 0;
  const hasFocus = !!recommendedFocus;

  if (!hasActions && !hasFocus) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Priority actions</h2>
      <div className="space-y-4">
        {hasFocus && (
          <Card className="border-indigo-100 bg-indigo-50/30 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Recommended focus</p>
                <p className="mt-2 text-base font-semibold leading-relaxed text-slate-900">{recommendedFocus!.action}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Because: {recommendedFocus!.because.slice(0, 2).join(' · ')}
                  {recommendedFocus!.because.length > 2 ? ` · +${recommendedFocus!.because.length - 2} more` : ''}
                </p>
                <p className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Owner:</span> {recommendedFocus!.owner}
                  <span className="h-3 w-px bg-gray-300" />
                  <span className="font-semibold text-slate-700">Priority:</span>{' '}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    recommendedFocus!.priority === 'Critical' ? 'bg-rose-100 text-rose-700' :
                    recommendedFocus!.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {recommendedFocus!.priority}
                  </span>
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-indigo-100/50 px-4 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Expected benefit</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-indigo-800">{recommendedFocus!.expectedBenefit}</p>
              </div>
            </div>
          </Card>
        )}

        {hasActions && (
          <div className="space-y-2">
            {actions.map((action, index) => (
              <Card key={action.action} className="flex flex-wrap items-start gap-4 p-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-relaxed text-slate-900">{action.action}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Because: {action.because.slice(0, 2).join(' · ')}
                    {action.because.length > 2 ? ` · +${action.because.length - 2} more` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{action.priority}</p>
                  <p className="text-[11px] text-slate-400">{action.owner}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ intelligence tools */

function IntelligenceTools({
  ingestion,
  graph,
  evidence,
}: {
  ingestion: NonNullable<BrainExecutivePayload['ingestion']>;
  graph: NonNullable<BrainExecutivePayload['graph']>;
  evidence: NonNullable<BrainExecutivePayload['evidence']>;
}) {
  const orgNode = graph.organization?.node;
  const orgMetrics = orgNode?.metrics?.slice(0, 3) ?? [];

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">Intelligence tools</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Ingestion */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DatabaseZap size={16} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Ingestion engine</h3>
            </div>
            <Link href="/enterprise-brain/ingestion" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
              Open
            </Link>
          </div>
          {ingestion.available && ingestion.inventory.length > 0 ? (
            <div className="mt-3 space-y-2">
              {ingestion.inventory.slice(0, 3).map((entry) => (
                <div key={entry.scope} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-slate-600">{entry.label}</span>
                  <span className="shrink-0 tabular-nums text-slate-900">{entry.targetCount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Store not provisioned.</p>
          )}
        </Card>

        {/* Graph */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Graph explorer</h3>
            </div>
            <Link href="/enterprise-brain/knowledge/graph" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
              Explore
            </Link>
          </div>
          {graph.available && graph.roots?.length > 0 ? (
            <div className="mt-3">
              {orgNode && (
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{orgNode.label}</span>
                  {orgMetrics.map((m) => (
                    <span key={m.label} className="text-slate-400">
                      {m.label}: <span className="font-semibold text-slate-600">{m.value}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {graph.roots.map((root) => (
                  <span key={root.type} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-600">
                    {root.label} <span className="font-normal text-slate-400">{root.count.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Graph not available.</p>
          )}
        </Card>

        {/* Evidence */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlaskConical size={16} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Evidence</h3>
            </div>
            <Link href="/enterprise-brain/intelligence-loop/evidence" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
              View all
            </Link>
          </div>
          {evidence.length > 0 ? (
            <div className="mt-3 space-y-2">
              {evidence.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2">
                  <p className="truncate text-xs font-medium text-slate-700">{item.signalTitle}</p>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    item.severity === 'critical' ? 'bg-rose-100 text-rose-700' :
                    item.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {item.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No evidence recorded yet.</p>
          )}
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ main */

export default function BrainOverviewPage() {
  const { data, error, loading, refresh } = useBrainResource(fetchExecutive, []);
  const classIntelligence = useBrainResource(fetchClassIntelligence, []);

  if (loading && !data) return <LoadingState label="Reading the school" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  const {
    health,
    counts,
    intelligence,
    ingestion,
    graph,
    evidence,
    summary,
    organization,
    generatedAt,
    academicYear,
    findingsRefreshedAt,
    whatChanged,
    atRisk,
    topFindings,
    actions,
  } = data;
  const unscored = health.dimensions.filter((d) => !d.available);

  return (
    <div className="p-6">
      {/* ---------------------------------------------------- Organization Hero */}
      <OrganizationHero
        organization={organization}
        academicYear={academicYear}
        health={health}
        counts={counts}
        generatedAt={generatedAt}
        findingsRefreshedAt={findingsRefreshedAt}
      />

      {/* ---------------------------------------------------- Foundation Cards */}
      <FoundationCards summary={summary} />

      {/* ---------------------------------------------------- Intelligence State */}
      <IntelligenceState summary={summary} />

      {/* ---------------------------------------------------- Organization Intelligence */}
      <OrganizationIntelligence intelligence={intelligence} />

      {/* ---------------------------------------------------- Dimension Health */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-slate-800">Organization health</h2>
          {health.overall.score !== null && (
            <p className="text-xs text-slate-500">
              Overall{' '}
              <span className="text-base font-semibold tabular-nums text-slate-900">{health.overall.score}</span>
              <span className="text-slate-400">/100</span>{' '}
              <span className="font-semibold text-slate-600">{health.overall.band}</span>
            </p>
          )}
        </div>
        <p className="mb-4 max-w-3xl text-xs leading-relaxed text-slate-500">{health.overall.why}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {health.dimensions.filter((d) => d.available).map((dimension) => (
            <HealthDial key={dimension.key} dimension={dimension} />
          ))}
        </div>

        {unscored.length > 0 && (
          <Card className="mt-4 border-amber-200/70 bg-amber-50/40 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {unscored.length} {unscored.length === 1 ? 'area cannot' : 'areas cannot'} be scored yet
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  These are not failures — there is too little recorded data to judge them, and saying so is more useful than
                  showing a zero.
                </p>
                <ul className="mt-3 space-y-2">
                  {unscored.map((dimension) => (
                    <li key={dimension.key}>
                      <p className="text-xs font-semibold text-slate-700">{dimension.label}</p>
                      <p className="text-xs leading-relaxed text-slate-500">{dimension.why}</p>
                      {dimension.drivers?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          {dimension.drivers.map((driver) => (
                            <span key={driver.label} className="text-[11px] text-slate-400">
                              {driver.label}: <span className="font-semibold text-slate-600">{driver.value}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* ---------------------------------------------------- What changed */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">What changed</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {whatChanged.map((item) => (
            <Card key={item.key} className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{item.label}</p>
              {item.available ? (
                <>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{item.value}</p>
                  <div className="mt-1">
                    <Delta change={item.change} unit={item.unit === '%' ? '%' : 'pts'} />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{item.note}</p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm font-semibold text-slate-400">Cannot compare yet</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.note}</p>
                </>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- What is at risk */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">What is at risk</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <RiskList
            title="Classes below the attendance baseline"
            empty="No class is materially below the school baseline."
            items={atRisk.classes}
            href={(item) => `/enterprise-brain#class-${item.id}`}
          />
          <RiskList
            title="Students most often absent"
            empty="No student meets the persistent-absence threshold."
            items={atRisk.students}
            href={(item) => `/enterprise-brain/foundation/students?student=${item.id}`}
          />
          <RiskList
            title="Departments needing attention"
            empty="Every department that holds staff looks healthy."
            items={atRisk.departments}
            href={(item) => `/enterprise-brain/foundation/departments#${item.id}`}
          />
        </div>
      </section>

      {/* ---------------------------------------------------- Class Intelligence */}
      <ClassIntelligenceSection resource={classIntelligence} />

      {/* ---------------------------------------------------- Most important findings */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-slate-800">Most important findings</h2>
          <Link href="/enterprise-brain/intelligence-loop" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            See all {counts.openFindings}
          </Link>
        </div>
        <div className="space-y-3">
          {topFindings.map((finding) => (
            <IntelligenceCard key={finding.id} model={finding} />
          ))}
          {!topFindings.length && (
            <Card className="p-8">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <p className="text-sm text-slate-500">
                  No open findings. Every check the Brain runs currently passes for this school.
                </p>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- Priority Actions */}
      <PriorityActions actions={actions} recommendedFocus={intelligence.recommendedFocus} />

      {/* ---------------------------------------------------- Intelligence Tools */}
      <IntelligenceTools ingestion={ingestion} graph={graph} evidence={evidence} />
    </div>
  );
}

/* ------------------------------------------------------------------ class intelligence */

/**
 * Class-level attendance intelligence, embedded in the Overview screen so it is
 * reached from one place rather than a separate navigation entry.
 *
 * THE BASELINE IS THIS SCHOOL, NOT A NATIONAL FIGURE. The comparison is always
 * internal and stated on every row rather than assumed.
 *
 * CLASSES WITH TOO FEW MARKS ARE ABSENT, NOT SHOWN AT ZERO.
 */
function ClassIntelligenceSection({
  resource,
}: {
  resource: { data: BrainClassIntelligence | null; error: string; loading: boolean; refreshing: boolean; refresh: () => void };
}) {
  const { data, error, loading, refreshing, refresh } = resource;

  if (loading && !data) return null;
  if (error && !data) {
    return (
      <section className="mb-8" id="class-intelligence">
        <Card className="border-red-100 bg-red-50/50 p-4 text-sm text-red-700">
          Could not load class intelligence: {error}
        </Card>
      </section>
    );
  }

  if (!data) return null;

  if (!data.available) {
    return (
      <section className="mb-8" id="class-intelligence">
        <Card className="p-6">
          <p className="text-sm text-slate-500">{data.reason}</p>
        </Card>
      </section>
    );
  }

  const lagging = data.classes.filter((c) => c.gapPoints <= -4);

  return (
    <section className="mb-8" id="class-intelligence">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-800">Class attendance intelligence</h2>
        <Link
          href="/enterprise-brain/intelligence-loop/signals"
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View Intelligence Loop signals
          <ArrowRight size={13} />
        </Link>
      </div>

      <p className="mb-4 text-xs text-slate-500">
        Attendance for every class with enough recorded marks to measure, against a school baseline of {data.baseline}% across{' '}
        {data.marks.toLocaleString()} marks.
      </p>

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">School attendance baseline</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{data.baseline}%</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Classes below it</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
              {lagging.length}
              <span className="text-base font-normal text-slate-400"> of {data.classes.length}</span>
            </p>
          </div>
        </div>
        {lagging.length > 0 && (
          <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-600">What this means. </span>
            {lagging.length === 1
              ? `${lagging[0].name} is the only class materially below the school baseline. Attendance concentrated in one class usually points at a timetable, transport or teaching factor the school can fix.`
              : `${lagging.length} classes sit at least four points below the school baseline, the lowest being ${lagging[0].name} at ${lagging[0].attendanceRate}%.`}
          </p>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.classes.map((item) => {
          const below = item.gapPoints <= -4;
          return (
            <Card key={item.id} id={`class-${item.id}`} className="overflow-hidden">
              <div className="flex">
                <div className={`w-1 shrink-0 ${below ? 'bg-orange-500' : 'bg-emerald-400'}`} aria-hidden />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-slate-900">{item.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.summary}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-semibold tabular-nums leading-none text-slate-900">{item.attendanceRate}%</p>
                      <p className="mt-1 text-[11px] text-slate-400">attendance</p>
                      <div className="mt-1">
                        <Delta change={item.gapPoints} label="vs baseline" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <EvidenceStrip
                      evidence={[
                        { label: 'Students', value: item.students.toLocaleString() },
                        { label: 'Absences', value: item.absences.toLocaleString() },
                        { label: 'Marks recorded', value: item.marks.toLocaleString() },
                        { label: 'School baseline', value: `${item.baseline}%` },
                      ]}
                    />
                  </div>

                  {item.action && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium leading-relaxed text-slate-800">
                      {item.action}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {!data.classes.length && (
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-500" />
              <p className="text-sm text-slate-500">No class has enough recorded attendance to compare yet.</p>
            </div>
          </Card>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 text-xs text-slate-500">
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        <button type="button" onClick={refresh} disabled={refreshing} className="font-semibold text-indigo-600 hover:text-indigo-800">
          Refresh class intelligence
        </button>
      </div>
    </section>
  );
}

function RiskList<T extends { id: string; name: string; value: string; note: string }>({
  title,
  items,
  empty,
  href,
}: {
  title: string;
  items: T[];
  empty: string;
  href: (item: T) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3">
        <p className="text-xs font-semibold text-slate-900">{title}</p>
      </div>
      <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <Link
            key={item.id}
            href={href(item)}
            className="flex items-start justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
              <p className="text-[11px] leading-snug text-slate-400">{item.note}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{item.value}</span>
          </Link>
        ))}
        {!items.length && (
          <div className="flex items-center gap-2 px-5 py-6">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
            <p className="text-xs text-slate-400">{empty}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
