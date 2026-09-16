'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  ChevronDown,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';

import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';
import { decideRecommendation } from '@/lib/brain/api';
import {
  fetchFeesAccounts,
  fetchFeesIntelligence,
  recordFeesOutcome,
  runFeesIntelligence,
  type FeesAccountsPage,
  type FeesClass,
  type FeesFinding,
  type FeesDecisionTrailEntry,
  type FeesIntelligencePayload,
  type FeesRecommendation,
} from '@/app/fees/intelligence/_lib/fees-intelligence-api';
import {
  AgingProfile,
  ClassBreakdown,
  CycleTrend,
  HeadBreakdown,
  PaymentModeMix,
} from '@/app/fees/intelligence/_components/fees-intelligence-charts';
import {
  ConfidencePill,
  count,
  EvidenceGrid,
  MetricTile,
  money,
  moneyExact,
  percent,
  Section,
  SeverityChip,
  SeverityRail,
  Surface,
  toneFor,
  Unavailable,
} from '@/app/fees/intelligence/_components/fees-intelligence-primitives';

/**
 * Fees Intelligence — the native LMS screen.
 *
 * THIS DOES NOT LEAVE THE LMS. There is no redirect to the Enterprise Brain
 * workspace, no iframe and no external host: it calls the Fees Intelligence
 * endpoints directly and renders in the Fees module's own visual language.
 *
 * THE ACADEMIC YEAR IS THE HEADER'S, AND CHANGING IT RELOADS THE DATA.
 * `useBrainResource` puts the selected year in its cache key and drops the
 * previous payload when the key changes, so switching 2021 → 2020 cannot leave
 * 2021's figures on screen under a 2020 heading; `brainFetch` then carries the
 * year on the request itself. There is no second year selector on this page —
 * the one in the LMS header is the only one in the product.
 *
 * The eight sections follow the loop: what is true (Analytics), what it means
 * (Intelligence), what it rests on (Evidence, inside each finding), what to
 * consider (Recommendations), what was decided (Decision), what was done
 * (Execution), whether it worked (Outcome) and what was learnt (Memory).
 */
export function FeesIntelligenceScreen() {
  const { data, error, loading, refreshing, refresh } = useBrainResource<FeesIntelligencePayload>(
    () => fetchFeesIntelligence(),
    [],
  );

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [drawer, setDrawer] = useState<null | { kind: 'accounts'; title: string; subtitle: string; standardId?: string }>(null);

  const recompute = useCallback(async () => {
    setRunning(true);
    setRunError('');
    try {
      await runFeesIntelligence();
      refresh();
    } catch (caught) {
      setRunError(caught instanceof Error ? caught.message : 'Unable to recompute the fee findings.');
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-8 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading fee records for the selected academic year…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { coverage, position } = data;

  return (
    <div className="space-y-8 pb-10">
      <Hero data={data} onRecompute={recompute} running={running} refreshing={refreshing} />

      {runError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{runError}</span>
        </div>
      ) : null}

      {!coverage.available || !position ? (
        <Unavailable
          title="No fee position for this academic year"
          reason={
            coverage.reason ??
            'There are no fee records for the year selected in the header. Choose another academic year to see its position.'
          }
        />
      ) : (
        <>
          <ManagementSummary data={data} />

          <FinancialPosition
            data={data}
            onDrillOutstanding={() =>
              setDrawer({
                kind: 'accounts',
                title: 'Accounts in arrears',
                subtitle: `${count(position.defaulterAccounts)} of ${count(position.feeAccounts)} fee accounts owe money for ${data.academicYear.syear ?? 'this year'}, largest first.`,
              })
            }
          />

          <WhatTheBrainSees data={data} onRecompute={recompute} running={running} />

          <Trends
            data={data}
            onSelectClass={(row: FeesClass) =>
              setDrawer({
                kind: 'accounts',
                title: `${row.label} — accounts in arrears`,
                subtitle: `${row.label} carries ${moneyExact(row.outstandingAmount)} across ${row.defaulterAccounts} of ${row.accounts} accounts, largest first.`,
                // The drill-down narrows to this class server-side rather than
                // filtering a page the browser happens to hold.
                standardId: row.standardId,
              })
            }
          />

          <PriorityAttention data={data} />
          <Recommendations data={data} onDecided={refresh} />
          <DecisionAndOutcome data={data} onRecorded={refresh} />
          <DataQuality data={data} />
          <Learning data={data} />
        </>
      )}

      {drawer ? (
        <AccountsDrawer
          title={drawer.title}
          subtitle={drawer.subtitle}
          standardId={drawer.standardId}
          onClose={() => setDrawer(null)}
        />
      ) : null}
    </div>
  );
}

/* ================================================================== hero */

function Hero({
  data,
  onRecompute,
  running,
  refreshing,
}: {
  data: FeesIntelligencePayload;
  onRecompute: () => void;
  running: boolean;
  refreshing: boolean;
}) {
  const { coverage, freshness, academicYear } = data;

  return (
    <header className="relative overflow-hidden rounded-2xl border border-[#E3E0FB] bg-gradient-to-br from-[#F7F6FE] via-white to-[#F4F8FF] px-5 py-6 sm:px-7 sm:py-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5846EA]">Fees</p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight text-slate-950 sm:text-[30px]">
            Fees Intelligence
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-600">
            Understand collection health, identify financial risks, and turn fee data into evidence-backed actions.
          </p>
        </div>

        <button
          type="button"
          onClick={onRecompute}
          disabled={running}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#5846EA] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#4B3AD6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running || refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {running ? 'Analysing…' : 'Recompute findings'}
        </button>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[#E3E0FB] pt-5 lg:grid-cols-4">
        <HeroFact label="Organization" value={data.organization || '—'} />
        <HeroFact label="Academic year" value={academicYear.syear ?? 'Not selected'} />
        <HeroFact
          label="Data coverage"
          value={
            coverage.available
              ? `${count(coverage.feeAccounts)} fee accounts · ${count(coverage.receiptRows)} receipts`
              : 'No fee records'
          }
          note={coverage.available ? `${count(coverage.enrolledStudents)} students enrolled this year` : coverage.reason}
        />
        {/* Freshness is two separate truths: the position is read live on every
            request, the findings are only as fresh as the last rule run. */}
        <HeroFact label="Data freshness" value={freshness.positionLabel} note={freshness.findingsLabel} />
      </dl>
    </header>
  );
}

function HeroFact({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-[14px] font-bold leading-5 text-slate-900">{value}</dd>
      {note ? <dd className="mt-0.5 text-[11.5px] leading-4 text-slate-500">{note}</dd> : null}
    </div>
  );
}

/* =========================================== 0. management summary */

/**
 * "What is happening", in the words the backend composed.
 *
 * DELIBERATELY NOT A CHAT PANEL. Every sentence here was assembled server-side
 * from the same figures the cards below show (FeesSummary.php) — it is
 * deterministic, reproducible and traceable to a row. Styling it like an AI
 * assistant would imply a model wrote it and invite the reader to discount it.
 */
function ManagementSummary({ data }: { data: FeesIntelligencePayload }) {
  const { summary } = data;

  if (!summary.available) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5846EA]">What is happening</p>
      {summary.headline ? (
        <h2 className="mt-1.5 text-[19px] font-bold leading-snug tracking-tight text-slate-950">
          {summary.headline}
        </h2>
      ) : null}
      <ul className="mt-3 space-y-1.5">
        {summary.sentences.map((sentence, index) => (
          <li key={index} className="flex gap-2.5 text-[13.5px] leading-6 text-slate-700">
            <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            <span>{sentence}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ====================================================== 1. analytics */

function FinancialPosition({
  data,
  onDrillOutstanding,
}: {
  data: FeesIntelligencePayload;
  onDrillOutstanding: () => void;
}) {
  const p = data.position;
  if (!p) return null;

  const settledShare = p.feeAccounts > 0 ? (p.fullySettledAccounts / p.feeAccounts) * 100 : null;

  return (
    <Section
      eyebrow="Analytics"
      title="Financial position"
      description="What is happening — every figure below is read from this year's fee records at the moment you loaded the page."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Total fee demand" value={money(p.demandAmount)} hint="Billed to enrolled students" emphasis />
        <MetricTile
          label="Collected"
          value={money(p.collectedAmount)}
          hint={`${count(p.receipts)} ${p.receipts === 1 ? 'receipt' : 'receipts'} recorded`}
          tone={p.collectedAmount > 0 ? 'positive' : 'neutral'}
          emphasis
        />
        <MetricTile
          label="Outstanding"
          value={money(p.outstandingAmount)}
          hint={`Across ${count(p.defaulterAccounts)} ${p.defaulterAccounts === 1 ? 'account' : 'accounts'}`}
          tone={p.outstandingAmount > 0 ? 'medium' : 'positive'}
          emphasis
          onClick={p.defaulterAccounts > 0 ? onDrillOutstanding : undefined}
          actionLabel="See the accounts"
        />
        <MetricTile
          label="Collection rate"
          value={percent(p.collectionRate)}
          hint={p.collectionRate === null ? 'Nothing billed this year' : 'Collected against billed'}
          tone={p.collectionRate === null ? 'neutral' : p.collectionRate >= 70 ? 'positive' : p.collectionRate >= 40 ? 'medium' : 'high'}
          emphasis
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Overdue amount"
          value={money(p.overdueAmount)}
          hint={`${count(p.overdueCycles)} past ${p.overdueCycles === 1 ? 'cycle' : 'cycles'} still unpaid`}
          tone={p.overdueAmount > 0 ? 'high' : 'positive'}
        />
        <MetricTile
          label="Accounts in arrears"
          value={count(p.defaulterAccounts)}
          hint={
            p.averageOutstandingPerDefaulter === null
              ? 'No account is in arrears'
              : `${money(p.averageOutstandingPerDefaulter)} average balance`
          }
          tone={p.defaulterAccounts > 0 ? 'medium' : 'positive'}
          onClick={p.defaulterAccounts > 0 ? onDrillOutstanding : undefined}
          actionLabel="See the accounts"
        />
        <MetricTile
          label="Active fee accounts"
          value={count(p.feeAccounts)}
          hint={
            settledShare === null
              ? undefined
              : `${count(p.fullySettledAccounts)} fully settled (${percent(settledShare)})`
          }
        />
        <MetricTile
          label="Concessions applied"
          value={money(p.concessionAmount)}
          hint={p.fineAmount > 0 ? `${money(p.fineAmount)} collected as fines` : 'No fines recorded'}
        />
      </div>
    </Section>
  );
}

/* ================================================ 2. what the brain sees */

function WhatTheBrainSees({
  data,
  onRecompute,
  running,
}: {
  data: FeesIntelligencePayload;
  onRecompute: () => void;
  running: boolean;
}) {
  const { findings, ruleStatus } = data;

  return (
    <Section
      eyebrow="Intelligence"
      title="What the Brain sees"
      description="What the figures mean. Each finding states what happened, why it matters, and the evidence it rests on — nothing appears here without figures behind it."
    >
      {findings.length === 0 ? (
        <Surface className="px-4 py-6">
          <p className="text-[13px] font-semibold text-slate-700">
            {data.freshness.findingsRefreshedAt
              ? 'Nothing met the evidence threshold for this year'
              : 'Findings have not been computed for this year yet'}
          </p>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
            {data.freshness.findingsRefreshedAt
              ? 'Every check below ran against this year’s fee records and none found enough evidence to raise a finding.'
              : 'Run the analysis to evaluate this year’s fee records against the checks below.'}
          </p>
          {!data.freshness.findingsRefreshedAt ? (
            <button
              type="button"
              onClick={onRecompute}
              disabled={running}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#5846EA] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#4B3AD6] disabled:opacity-60"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Analyse this year
            </button>
          ) : null}
        </Surface>
      ) : (
        <ul className="space-y-3">
          {findings.map((finding) => (
            <li key={finding.id}>
              <FindingCard finding={finding} />
            </li>
          ))}
        </ul>
      )}

      {/* Makes silence readable: without this, "two findings" looks the same
          whether the other six checks passed or never ran. */}
      {ruleStatus.length > 0 ? <RuleStatusPanel ruleStatus={ruleStatus} /> : null}
    </Section>
  );
}

function FindingCard({ finding }: { finding: FeesFinding }) {
  const [open, setOpen] = useState(false);
  const tone = toneFor(finding.severity);

  return (
    <Surface className="relative overflow-hidden">
      <SeverityRail tone={tone} />
      <div className="py-4 pl-5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip tone={tone}>{finding.severityLabel}</SeverityChip>
          <ConfidencePill band={finding.confidence.band} value={finding.confidence.value} />
          {finding.impactAmount !== null ? (
            <span className="text-[12px] text-slate-500">
              <span className="font-semibold text-slate-700">{money(finding.impactAmount)}</span> in play
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">{finding.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-6 text-slate-700">{finding.whatHappened}</p>

        {finding.whyItMatters ? (
          <div className="mt-3 rounded-lg border-l-2 border-[#5846EA]/40 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Why it matters</p>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-700">{finding.whyItMatters}</p>
          </div>
        ) : null}

        {finding.recommendation ? (
          <div className="mt-3 flex items-start gap-2">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#5846EA]" />
            <p className="text-[13px] leading-5 text-slate-800">
              <span className="font-semibold">Recommended next step:</span> {finding.recommendation}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="mt-3 inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-[#5846EA] transition hover:underline"
        >
          {open ? 'Hide evidence' : 'View evidence'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open ? (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <EvidenceGrid points={finding.evidence} />

            {finding.likelyCause ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Why the Brain believes this</p>
                <p className="mt-0.5 text-[13px] leading-5 text-slate-700">{finding.likelyCause}</p>
              </div>
            ) : (
              <p className="text-[13px] leading-5 text-slate-500">
                No reviewed explanation has been approved for this finding, so its cause is recorded as undetermined.
              </p>
            )}

            <p className="text-[11.5px] text-slate-400">
              Raised {finding.raisedAt || 'recently'} · suggested owner: {finding.owner}
            </p>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

function RuleStatusPanel({ ruleStatus }: { ruleStatus: FeesIntelligencePayload['ruleStatus'] }) {
  const [open, setOpen] = useState(false);

  return (
    <Surface className="px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[13px] font-semibold text-slate-700">
          What was checked ({ruleStatus.filter((rule) => rule.raised).length} of {ruleStatus.length} raised a finding)
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <ul className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
          {ruleStatus.map((rule) => (
            <li key={rule.key} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-slate-700">{rule.label}</span>
              <span
                className={`shrink-0 font-semibold ${
                  rule.raised ? 'text-amber-700' : rule.checked ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {rule.raised ? 'Finding raised' : rule.checked ? 'Checked — nothing found' : 'Not enough data'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Surface>
  );
}

/* ========================================================== 3. trends */

function Trends({ data, onSelectClass }: { data: FeesIntelligencePayload; onSelectClass: (row: FeesClass) => void }) {
  const { trends, position, coverage } = data;

  const charts = useMemo(
    () => ({
      cycles: trends.cycles.filter((cycle) => cycle.demandAmount > 0 || cycle.collectedAmount > 0),
      classes: trends.classes.filter((row) => row.demandAmount > 0),
      heads: trends.heads.filter((row) => row.demandAmount > 0),
      modes: trends.paymentModes.filter((row) => row.amount > 0),
      aging: position?.agingBands ?? [],
    }),
    [trends, position],
  );

  const nothing =
    charts.cycles.length < 2 &&
    charts.classes.length === 0 &&
    charts.heads.length === 0 &&
    charts.modes.length === 0 &&
    charts.aging.length === 0;

  return (
    <Section
      eyebrow="Trends"
      title="Where the money sits"
      description="Only dimensions with real data are charted. Each chart answers one question and states what the figures actually show."
    >
      {nothing ? (
        <Unavailable
          title="Not enough data to chart this year"
          reason={
            coverage.hasReceipts
              ? 'This year has too few billed cycles and classes to draw a meaningful breakdown.'
              : 'No fee receipts are available for the selected academic year, so there is no collection to trend.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <CycleTrend cycles={charts.cycles} />
          <ClassBreakdown classes={charts.classes} baseline={position?.collectionRate ?? null} onSelect={onSelectClass} />
          <HeadBreakdown heads={charts.heads} />
          <AgingProfile bands={charts.aging} />
          <PaymentModeMix modes={charts.modes} />
        </div>
      )}
    </Section>
  );
}

/* ================================================ 4. priority attention */

function PriorityAttention({ data }: { data: FeesIntelligencePayload }) {
  const { priorities } = data;
  if (priorities.length === 0) return null;

  return (
    <Section
      eyebrow="Priority"
      title="Priority attention"
      description="Ranked by severity, then by the amount actually in play. Nothing here is assigned a priority by hand."
    >
      <ol className="space-y-3">
        {priorities.map((item, index) => {
          const tone = toneFor(item.severity);

          return (
            <li key={item.id}>
              <Surface className="relative overflow-hidden">
                <SeverityRail tone={tone} />
                <div className="py-4 pl-5 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <SeverityChip tone={tone}>{item.severityLabel}</SeverityChip>
                    {item.impactAmount !== null ? (
                      <span className="text-[12px] text-slate-500">
                        Financial impact <span className="font-semibold text-slate-700">{money(item.impactAmount)}</span>
                      </span>
                    ) : (
                      <span className="text-[12px] text-slate-400">Financial impact not computable</span>
                    )}
                  </div>

                  <h3 className="mt-2 text-[15px] font-bold leading-snug text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-[13.5px] leading-6 text-slate-700">{item.whatHappened}</p>
                  {item.whyItMatters ? (
                    <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{item.whyItMatters}</p>
                  ) : null}

                  {item.evidence.length > 0 ? (
                    <div className="mt-3">
                      <EvidenceGrid points={item.evidence.slice(0, 4)} />
                    </div>
                  ) : null}

                  {item.nextStep ? (
                    <p className="mt-3 text-[13px] leading-5 text-slate-800">
                      <span className="font-semibold">Suggested next step:</span> {item.nextStep}
                    </p>
                  ) : null}
                </div>
              </Surface>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ================================================= 5. recommendations */

function Recommendations({ data, onDecided }: { data: FeesIntelligencePayload; onDecided: () => void }) {
  const { recommendations, execution } = data;

  return (
    <Section
      eyebrow="Recommendations"
      title="What to consider doing"
      description="Each recommendation carries the evidence behind it and the balance it covers. Approving one records a decision — it does not itself move money or contact anyone."
    >
      {recommendations.length === 0 ? (
        <Unavailable
          title="No recommendations for this year"
          reason="A recommendation is produced only when a finding has an approved explanation behind it. Recompute the findings, or review the checks above."
        />
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-[12.5px] leading-5 text-blue-900">
            <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{execution.note}</span>
          </div>

          <ul className="mt-3 space-y-3">
            {recommendations.map((recommendation) => (
              <li key={recommendation.id}>
                <RecommendationCard recommendation={recommendation} onDecided={onDecided} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function RecommendationCard({
  recommendation,
  onDecided,
}: {
  recommendation: FeesRecommendation;
  onDecided: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Surface className="overflow-hidden">
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-indigo-800 ring-1 ring-inset ring-indigo-200">
            {recommendation.category}
          </span>
          <SeverityChip tone={toneFor(recommendation.priority)}>{recommendation.priority} priority</SeverityChip>
          <ConfidencePill band={recommendation.confidence.band} value={recommendation.confidence.value} />
          {recommendation.decision ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
              Decided: {recommendation.decision.status}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 text-[15px] font-bold leading-snug text-slate-900">{recommendation.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-6 text-slate-700">{recommendation.description}</p>

        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Why</dt>
            <dd className="mt-0.5 text-[13px] leading-5 text-slate-700">
              {recommendation.why ?? 'Raised from the evidence on the finding below.'}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Expected impact</dt>
            <dd className="mt-0.5 text-[13px] leading-5 text-slate-700">
              {/* Deliberately worded as exposure, never as recovery. */}
              {recommendation.expectedImpact
                ? recommendation.expectedImpact.wording
                : 'The amount this would address cannot be computed from the available evidence.'}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[12.5px] text-slate-500">
          Based on: <span className="font-medium text-slate-700">{recommendation.finding.title}</span>
        </p>

        {recommendation.decision ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Decision on record</p>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-700">{recommendation.decision.rationale}</p>
            <p className="mt-1 text-[11.5px] text-slate-500">
              {recommendation.decision.status} · recorded {recommendation.decision.decidedAt}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#5846EA] px-3 py-1.5 text-[13px] font-semibold text-[#5846EA] transition hover:bg-indigo-50"
          >
            Review and decide
          </button>
        )}
      </div>

      {open ? (
        <DecisionDialog
          recommendation={recommendation}
          onClose={() => setOpen(false)}
          onDecided={() => {
            setOpen(false);
            onDecided();
          }}
        />
      ) : null}
    </Surface>
  );
}

/**
 * The Decision Record.
 *
 * A recommendation never executes silently: this dialog is the only way one
 * becomes a decision, and it requires a named rationale because the decision is
 * written to the Brain's audit trail against the signed-in LMS user, the tenant
 * and the academic year.
 */
function DecisionDialog({
  recommendation,
  onClose,
  onDecided,
}: {
  recommendation: FeesRecommendation;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [status, setStatus] = useState<'approved' | 'rejected' | 'deferred'>('approved');
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (rationale.trim().length < 3) {
      setError('Record why this decision was taken — it becomes part of the audit trail.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await decideRecommendation(recommendation.id, status, rationale.trim());
      onDecided();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to record the decision.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Decision record"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">Decision record</h3>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Recorded against your account for {recommendation.syear ?? 'this academic year'}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Recommendation</p>
            <p className="mt-0.5 text-[13.5px] font-semibold leading-5 text-slate-900">{recommendation.title}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Evidence</p>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-700">{recommendation.finding.title}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Expected outcome</p>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-700">
              {recommendation.expectedImpact
                ? recommendation.expectedImpact.wording
                : 'Not computable from the available evidence.'}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Confidence</p>
            <p className="mt-1">
              <ConfidencePill band={recommendation.confidence.band} value={recommendation.confidence.value} />
            </p>
          </div>

          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Decision</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(['approved', 'deferred', 'rejected'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  aria-pressed={status === option}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold capitalize transition ${
                    status === option
                      ? 'border-[#5846EA] bg-indigo-50 text-[#5846EA]'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="decision-rationale" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Rationale
            </label>
            <textarea
              id="decision-rationale"
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              rows={3}
              placeholder="Why this decision was taken, and who will carry it out."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-[#5846EA] focus:ring-2 focus:ring-[#5846EA]/20"
            />
          </div>

          {error ? (
            <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5846EA] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#4B3AD6] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Record decision
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================================== 6 & 7. decision and outcome */

const OUTCOME_COPY: Record<string, { label: string; tone: 'positive' | 'medium' | 'high' | 'neutral' }> = {
  resolved: { label: 'Resolved', tone: 'positive' },
  partially_resolved: { label: 'Partially resolved', tone: 'medium' },
  not_reached: { label: 'Not reached', tone: 'high' },
  undetermined: { label: 'Undetermined', tone: 'neutral' },
  awaiting_outcome: { label: 'Awaiting outcome', tone: 'neutral' },
  no_action_queued: { label: 'No follow-up queued', tone: 'neutral' },
};

function DecisionAndOutcome({
  data,
  onRecorded,
}: {
  data: FeesIntelligencePayload;
  onRecorded: () => void;
}) {
  const { decisionTrail } = data;
  const [recording, setRecording] = useState<FeesDecisionTrailEntry | null>(null);

  return (
    <Section
      eyebrow="Decisions"
      title="Decisions and outcomes"
      description="Every decision taken on a fee recommendation, the follow-up it queued, and whether anyone has recorded what happened."
    >
      {decisionTrail.length === 0 ? (
        <Unavailable
          title="No decision has been recorded for this year"
          reason="Decisions taken on the recommendations above appear here with their rationale, the follow-up queued, and the outcome once someone records it."
        />
      ) : (
        <ul className="space-y-3">
          {decisionTrail.map((entry) => {
            const outcome = OUTCOME_COPY[entry.outcomeState] ?? OUTCOME_COPY.undetermined;

            return (
              <li key={entry.decisionId}>
                <Surface className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 ring-1 ring-inset ring-slate-200">
                      {entry.status}
                    </span>
                    <SeverityChip tone={outcome.tone}>{outcome.label}</SeverityChip>
                    <span className="text-[12px] text-slate-500">Recorded {entry.decidedAt}</span>
                  </div>

                  <h3 className="mt-2 text-[14.5px] font-bold leading-snug text-slate-900">
                    {entry.recommendation.title}
                  </h3>
                  <p className="mt-1 text-[12.5px] text-slate-500">In response to: {entry.finding}</p>

                  <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Rationale</dt>
                      <dd className="mt-0.5 text-[13px] leading-5 text-slate-700">{entry.rationale}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Follow-up</dt>
                      <dd className="mt-0.5 text-[13px] leading-5 text-slate-700">
                        {entry.execution ? (
                          <>
                            <span className="block font-medium text-slate-800">{entry.execution.action}</span>
                            <span className="mt-0.5 block text-[11.5px] text-slate-500">
                              {entry.execution.status} · carried out by a person · queued {entry.execution.queuedAt}
                            </span>
                          </>
                        ) : (
                          'No follow-up procedure was queued for this decision.'
                        )}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Outcome</dt>
                      <dd className="mt-0.5 text-[13px] leading-5 text-slate-700">
                        {entry.outcome
                          ? `${entry.outcome.result}${entry.outcome.feedback ? ` — ${entry.outcome.feedback}` : ''}`
                          : 'Nobody has recorded what happened yet.'}
                      </dd>
                    </div>
                  </dl>

                  {entry.outcome?.measured ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Measured change</p>
                      <p className="mt-0.5 text-[13px] leading-5 text-slate-700">
                        {money(entry.outcome.measured.before)} → {money(entry.outcome.measured.after)} ·{' '}
                        <span className="font-semibold">
                          {entry.outcome.measured.change >= 0 ? 'reduced by ' : 'increased by '}
                          {money(Math.abs(entry.outcome.measured.change))}
                        </span>
                        {entry.outcome.measured.accountsAffected !== null
                          ? ` across ${count(entry.outcome.measured.accountsAffected)} accounts`
                          : ''}
                      </p>
                      {/* The judgement and the arithmetic are recorded apart:
                          a balance that fell is not automatically a success. */}
                      <p className="mt-1 text-[11.5px] leading-4 text-slate-500">{entry.outcome.measured.basis}</p>
                    </div>
                  ) : null}

                  {entry.expectedImpact !== null ? (
                    <p className="mt-2.5 text-[12.5px] text-slate-500">
                      Balance this decision covered:{' '}
                      <span className="font-semibold text-slate-700">{money(entry.expectedImpact)}</span>
                    </p>
                  ) : null}

                  {entry.execution && !entry.outcome ? (
                    <button
                      type="button"
                      onClick={() => setRecording(entry)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#5846EA] px-3 py-1.5 text-[13px] font-semibold text-[#5846EA] transition hover:bg-indigo-50"
                    >
                      Record what happened
                    </button>
                  ) : null}
                </Surface>
              </li>
            );
          })}
        </ul>
      )}

      {recording?.execution ? (
        <OutcomeDialog
          entry={recording}
          onClose={() => setRecording(null)}
          onRecorded={() => {
            setRecording(null);
            onRecorded();
          }}
        />
      ) : null}
    </Section>
  );
}

/**
 * Outcome capture — what actually happened after the action.
 *
 * The measured figures are OPTIONAL and the loop closes without them. That is
 * deliberate: forcing a number would produce invented ones, and an outcome
 * nobody quantified is still a real outcome. When both are given the change is
 * computed server-side and recorded beside, never instead of, the human
 * judgement — a balance that fell is not automatically a success.
 */
function OutcomeDialog({
  entry,
  onClose,
  onRecorded,
}: {
  entry: FeesDecisionTrailEntry;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [result, setResult] = useState<'success' | 'partial' | 'failed'>('partial');
  const [feedback, setFeedback] = useState('');
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [accounts, setAccounts] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const numeric = (value: string) => {
    const parsed = Number(value.replace(/,/g, '').trim());
    return value.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
  };

  const submit = async () => {
    if (!entry.execution) return;
    if (feedback.trim().length < 3) {
      setError('Record what happened — this becomes the organization’s memory of the action.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await recordFeesOutcome(entry.execution.id, result, feedback.trim(), {
        before: numeric(before),
        after: numeric(after),
        accountsAffected: numeric(accounts),
      });
      onRecorded();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to record the outcome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Record outcome"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">Record what happened</h3>
            <p className="mt-0.5 text-[12.5px] text-slate-500">{entry.recommendation.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Outcome</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {([
                ['success', 'Resolved'],
                ['partial', 'Partially resolved'],
                ['failed', 'Not reached'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setResult(value)}
                  aria-pressed={result === value}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition ${
                    result === value
                      ? 'border-[#5846EA] bg-indigo-50 text-[#5846EA]'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="outcome-feedback" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              What happened
            </label>
            <textarea
              id="outcome-feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={3}
              placeholder="What was done, who was reached, and what came of it."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-[#5846EA] focus:ring-2 focus:ring-[#5846EA]/20"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Measured change <span className="font-medium normal-case tracking-normal text-slate-400">— optional</span>
            </p>
            <p className="mt-0.5 text-[11.5px] leading-4 text-slate-500">
              Leave blank if you did not measure it. A blank stays blank; it is never recorded as zero.
            </p>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label className="block">
                <span className="text-[11.5px] font-semibold text-slate-600">Outstanding before</span>
                <input
                  inputMode="decimal"
                  value={before}
                  onChange={(event) => setBefore(event.target.value)}
                  placeholder="₹"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px] tabular-nums text-slate-800 outline-none focus:border-[#5846EA] focus:ring-2 focus:ring-[#5846EA]/20"
                />
              </label>
              <label className="block">
                <span className="text-[11.5px] font-semibold text-slate-600">Outstanding after</span>
                <input
                  inputMode="decimal"
                  value={after}
                  onChange={(event) => setAfter(event.target.value)}
                  placeholder="₹"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px] tabular-nums text-slate-800 outline-none focus:border-[#5846EA] focus:ring-2 focus:ring-[#5846EA]/20"
                />
              </label>
              <label className="block">
                <span className="text-[11.5px] font-semibold text-slate-600">Accounts affected</span>
                <input
                  inputMode="numeric"
                  value={accounts}
                  onChange={(event) => setAccounts(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[13px] tabular-nums text-slate-800 outline-none focus:border-[#5846EA] focus:ring-2 focus:ring-[#5846EA]/20"
                />
              </label>
            </div>
          </div>

          {error ? (
            <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5846EA] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#4B3AD6] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Record outcome
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================== 7b. ledger quality */

/**
 * Data quality as measured facts, not a score.
 *
 * Each row is a count somebody can go and fix. A composite "health score" would
 * be a number nobody could act on, so there is not one.
 */
function DataQuality({ data }: { data: FeesIntelligencePayload }) {
  const { dataQuality } = data;

  return (
    <Section
      eyebrow="Ledger"
      title="Data quality"
      description="Checks on the fee ledger itself. Each one is an exact count against this year's records."
    >
      {!dataQuality.available ? (
        <Unavailable title="Ledger checks are unavailable" reason={dataQuality.reason} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dataQuality.checks.map((check) => (
            <Surface key={check.key} className="relative overflow-hidden px-4 py-3.5">
              {check.state === 'attention' ? <SeverityRail tone="medium" /> : null}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{check.label}</p>
                <SeverityChip tone={check.state === 'attention' ? 'medium' : 'positive'}>
                  {check.state === 'attention' ? 'Review' : 'Clear'}
                </SeverityChip>
              </div>
              <p className="mt-1.5 text-[20px] font-bold tabular-nums leading-7 text-slate-900">
                {count(check.value)}
                {check.amount > 0 ? (
                  <span className="ml-2 text-[13px] font-semibold text-slate-500">{money(check.amount)}</span>
                ) : null}
              </p>
              {check.sharePercent !== null ? (
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {percent(check.sharePercent)} of collection
                </p>
              ) : null}
              <p className="mt-1.5 text-[12px] leading-4 text-slate-500">{check.note}</p>
            </Surface>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ====================================================== 8. memory */

function Learning({ data }: { data: FeesIntelligencePayload }) {
  const { learning } = data;

  return (
    <Section
      eyebrow="Memory"
      title="Organizational learning"
      description="What earlier fee decisions actually achieved, carried forward so the next decision is better informed."
    >
      {!learning.available ? (
        <Unavailable title="Nothing learnt yet" reason={learning.reason} />
      ) : (
        <ul className="space-y-3">
          {learning.entries.map((entry, index) => (
            <li key={`${entry.recordedAt}-${index}`}>
              <Surface className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityChip tone={entry.result === 'success' ? 'positive' : entry.result === 'partial' ? 'medium' : 'high'}>
                    {entry.result}
                  </SeverityChip>
                  <span className="text-[12px] text-slate-500">
                    {entry.syear ? `Academic year ${entry.syear}` : 'Year not recorded'}
                    {entry.appliesToThisYear ? ' · this year' : ''}
                  </span>
                </div>
                <h3 className="mt-2 text-[14.5px] font-bold text-slate-900">{entry.action}</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">In response to: {entry.finding}</p>
                {entry.feedback ? (
                  <p className="mt-2 text-[13px] leading-5 text-slate-700">
                    <span className="font-semibold">What happened:</span> {entry.feedback}
                  </p>
                ) : null}
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ================================================== drill-down drawer */

/**
 * The accounts behind the outstanding figure.
 *
 * Paged from the server — the browser never receives the whole roll, which is
 * what keeps this usable on an institute with thousands of students.
 */
function AccountsDrawer({
  title,
  subtitle,
  standardId,
  onClose,
}: {
  title: string;
  subtitle: string;
  standardId?: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState<FeesAccountsPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetching a page of accounts when the offset changes is the "subscribe to an
  // external system" case the rule carves out, and the setState calls it flags
  // are the loading flag and the resolved page — the same shape, and the same
  // exemption, as useBrainResource in app/enterprise-brain/_components.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const result = await fetchFeesAccounts(offset, 25, standardId);
        if (!cancelled) setPage(result);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load the accounts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offset, standardId]);

  const total = page?.total ?? 0;
  const showing = page?.rows.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-[12.5px] leading-5 text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && !page ? (
            <p className="flex items-center gap-2 text-[13px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
            </p>
          ) : error ? (
            <p className="flex items-start gap-1.5 text-[13px] font-medium text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : showing === 0 ? (
            <p className="text-[13px] text-slate-500">No account is in arrears for this academic year.</p>
          ) : (
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="py-2 pr-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Student
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Billed
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Paid
                  </th>
                  <th scope="col" className="py-2 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Outstanding
                  </th>
                </tr>
              </thead>
              <tbody>
                {page?.rows.map((row) => (
                  <tr key={row.studentId} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-semibold text-slate-800">{row.name}</span>
                      <span className="block text-[11.5px] text-slate-500">
                        {[row.className, row.enrollmentNo ? `Enrolment ${row.enrollmentNo}` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{moneyExact(row.demandAmount)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{moneyExact(row.collectedAmount)}</td>
                    <td className="py-2 text-right font-bold tabular-nums text-slate-900">
                      {moneyExact(row.outstandingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
            <p className="text-[12.5px] text-slate-500">
              Showing {offset + 1}–{offset + showing} of {count(total)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(offset - 25, 0))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={offset + showing >= total || loading}
                onClick={() => setOffset(offset + 25)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
