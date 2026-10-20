'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Lightbulb, Sparkles, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  ActivityIntelligence,
  ActivityPlateau,
  ActivityRegression,
  ActivityRiskAssessment,
  ActivityRiskKind,
  ActivityVelocity,
} from '@/app/pal/data/pal-activity-report';
import CountUpNumber from '@/app/pal/reports/_components/CountUpNumber';
import Reveal from '@/app/pal/reports/_components/Reveal';

const RISK_LABEL: Record<ActivityRiskKind, string> = {
  disengagement: 'Disengagement',
  failure: 'Failure',
  burnout: 'Burnout',
};

const RISK_KINDS: ActivityRiskKind[] = ['disengagement', 'failure', 'burnout'];

/**
 * Rose/amber/emerald threshold convention, lifted from
 * app/pal/intelligence/page.tsx's own RiskCard (≥70 rose, ≥40 amber, else
 * emerald) so a risk score reads the same way on both screens.
 */
function riskBarClass(pct: number): string {
  if (pct >= 70) return 'bg-rose-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-emerald-500';
}

/**
 * Amber "insufficient data" placeholder, styled exactly like
 * EngagementPlaceholderCard.tsx's own empty state — never a new pattern, and
 * never a 0%-wide bar standing in for "never measured".
 */
function InsufficientDataCard({ title, note }: { title: string; note: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <CardTitle className="text-sm text-amber-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-amber-800">{note}</CardContent>
    </Card>
  );
}

function RiskCard({ kind, risk }: { kind: ActivityRiskKind; risk: ActivityRiskAssessment }) {
  const label = `${RISK_LABEL[kind]} risk`;

  if (!risk.hasData || risk.riskScore === null) {
    return (
      <InsufficientDataCard
        title={label}
        note="Not enough data is captured yet to score this risk honestly."
      />
    );
  }

  const pct = Math.round(risk.riskScore * (risk.riskScore <= 1 ? 100 : 1));
  const clampedPct = Math.min(100, Math.max(0, pct));

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
        {risk.riskLevel && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
            {risk.riskLevel}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold text-slate-900 tabular-nums">
          <CountUpNumber value={pct} suffix="%" />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className={`h-full rounded-full ${riskBarClass(pct)}`}
            initial={{ width: 0 }}
            animate={{ width: `${clampedPct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          />
        </div>
        {risk.signals.length > 0 && (
          <div className="space-y-1 border-t border-slate-100 pt-2">
            {risk.signals.map((signal) => (
              <div key={signal.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{signal.label}</span>
                <span className="font-medium tabular-nums text-slate-700">{signal.value}</span>
              </div>
            ))}
          </div>
        )}
        {risk.recommendedActions.length > 0 && (
          <ul className="space-y-1 border-t border-slate-100 pt-2 text-xs text-indigo-700">
            {risk.recommendedActions.map((action, index) => (
              <li key={index}>• {action}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function VelocitySummary({ velocity }: { velocity: ActivityVelocity }) {
  if (!velocity.hasData) {
    return (
      <InsufficientDataCard
        title="Velocity"
        note="Not enough recent activity to measure learning pace yet."
      />
    );
  }
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <TrendingUp className="h-4 w-4 text-slate-500" />
        <CardTitle className="text-sm">Velocity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs">
        <Row label="Concepts mastered" value={velocity.conceptsMastered} />
        <Row label="Pace" value={velocity.velocity} />
        <Row label="Cohort percentile" value={velocity.velocityPercentile} suffix="th" />
        {velocity.classification && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-500">Classification</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
              {velocity.classification}
            </span>
          </div>
        )}
        {velocity.asOf && (
          <p className="pt-1 text-[11px] text-slate-400">
            As of {velocity.asOf.slice(0, 10)}
            {velocity.daysSinceEvidence !== null && velocity.daysSinceEvidence > 0
              ? ` (${velocity.daysSinceEvidence} days ago)`
              : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlateauSummary({ plateau }: { plateau: ActivityPlateau }) {
  if (!plateau.hasData || plateau.isPlateau === null) {
    return (
      <InsufficientDataCard
        title="Plateau"
        note="Not enough history to tell whether progress has stalled."
      />
    );
  }
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">Plateau</CardTitle>
        <StatusBadge active={plateau.isPlateau} activeLabel="Plateau" idleLabel="Progressing" />
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {plateau.daysInPlateau !== null && <Row label="Days in plateau" value={plateau.daysInPlateau} />}
        {plateau.recommendedActions.length > 0 && (
          <ul className="space-y-1 border-t border-slate-100 pt-2 text-indigo-700">
            {plateau.recommendedActions.map((action, index) => (
              <li key={index}>• {action}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RegressionSummary({ regression }: { regression: ActivityRegression }) {
  if (!regression.hasData || regression.isRegressing === null) {
    return (
      <InsufficientDataCard
        title="Regression"
        note="Not enough history to tell whether mastery has declined."
      />
    );
  }
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">Regression</CardTitle>
        <StatusBadge active={regression.isRegressing} activeLabel="Regressing" idleLabel="Stable" />
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {regression.declinePercent !== null && (
          <Row label="Decline" value={regression.declinePercent} suffix="%" />
        )}
        {regression.recommendedActions.length > 0 && (
          <ul className="space-y-1 border-t border-slate-100 pt-2 text-indigo-700">
            {regression.recommendedActions.map((action, index) => (
              <li key={index}>• {action}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, suffix = '' }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-700">
        {value === null ? '—' : `${value}${suffix}`}
      </span>
    </div>
  );
}

function StatusBadge({
  active,
  activeLabel,
  idleLabel,
}: {
  active: boolean;
  activeLabel: string;
  idleLabel: string;
}): ReactNode {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        active ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {active ? activeLabel : idleLabel}
    </span>
  );
}

/**
 * Learning Intelligence section for the per-student activity report.
 *
 * Consumes the `intelligence` key a parallel backend task is adding to this
 * same JSON — present only on the student report (the class report has no
 * cohort-level version of these engines, see pal-activity-report.ts). Renders
 * nothing when it is absent, so older responses (or the class report, if
 * this were ever mistakenly reused there) fall through cleanly.
 *
 * Follows the same honesty convention as EngagementPlaceholderCard.tsx: a
 * `hasData: false` dimension gets the amber placeholder, never a fabricated
 * or zero-valued chart.
 */
export default function LearningIntelligenceSection({
  intelligence,
}: {
  intelligence?: ActivityIntelligence;
}) {
  if (!intelligence) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Learning intelligence</h2>
          {intelligence.stalenessNote && (
            <p className="mt-0.5 text-xs text-slate-500">{intelligence.stalenessNote}</p>
          )}
        </div>
      </div>

      <Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          {RISK_KINDS.map((kind) => (
            <RiskCard key={kind} kind={kind} risk={intelligence.risk[kind]} />
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="grid gap-3 sm:grid-cols-3">
          <VelocitySummary velocity={intelligence.velocity} />
          <PlateauSummary plateau={intelligence.plateau} />
          <RegressionSummary regression={intelligence.regression} />
        </div>
      </Reveal>

      {intelligence.remediation && (
        <Reveal delay={0.12}>
          <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <Lightbulb className="h-4 w-4" />
              </span>
              <div>
                <CardDescription>Top misconception</CardDescription>
                <CardTitle className="text-sm capitalize">
                  {intelligence.remediation.tag.replace(/_/g, ' ')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-700">
              {intelligence.remediation.contentExcerpt}
            </CardContent>
          </Card>
        </Reveal>
      )}
    </div>
  );
}
