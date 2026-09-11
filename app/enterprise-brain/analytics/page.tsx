'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAnalytics, type BrainPoint } from '@/lib/brain/api';
import { useBrainResource } from '../_components/useBrainResource';
import { ErrorState, LoadingState, MetricTiles, HeroHeader } from '../_components/primitives';
import { BarSeries, ChartCard, CompletenessSeries, EmptySeries, TrendSeries } from '../_components/charts';

/**
 * Analytics over the live LMS database.
 *
 * EVERY CHART IS A GROUP BY AGAINST vivek_erp, scoped to this institute, run at
 * the moment the page loaded — there is no summary table between the school's
 * data and this screen, so a department renamed this morning appears under its
 * new name here this afternoon.
 *
 * SECTIONS WITH NO DATA SAY SO RATHER THAN DRAWING A ZERO. An institute that has
 * never recorded a mark should see "no marks recorded", not a flat line that
 * looks like measured failure. That distinction is the difference between a
 * reporting gap and a performance problem, and it is the single most common way
 * a dashboard misleads.
 */
export default function AnalyticsPage() {
  const { data, error, loading, refreshing, refresh } = useBrainResource(fetchAnalytics, []);

  if (loading && !data) return <LoadingState label="Computing analytics from the LMS database" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  const intel = data.intelligence ?? {};

  return (
    <div className="p-6">
      <HeroHeader
        breadcrumb="Enterprise Brain · Analytics"
        title="Analytics"
        // `data.source` is the database name. It belongs in the tooltip an
        // administrator may want, not in a sentence a principal reads.
        description={`Read live from the LMS at ${new Date(data.generatedAt).toLocaleString()}. Every figure is an aggregate over this institute's own records — nothing is cached or estimated.`}
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <MetricTiles metrics={data.headline} />

      <Section title="Organization">
        <ChartCard title="Staff by department" subtitle="Headcount per department, largest first">
          <BarSeries data={data.organization?.staffByDepartment ?? []} unit="" />
        </ChartCard>
        <ChartCard title="Department completeness" subtitle="How much of the structure is actually defined">
          <CompletenessSeries data={data.organization?.departmentCompleteness ?? []} />
        </ChartCard>
      </Section>

      <Section title="People">
        <ChartCard title="Staff record completeness">
          <CompletenessSeries data={data.people?.recordCompleteness ?? []} />
        </ChartCard>
        <ChartCard title="Staff by status">
          <BarSeries data={data.people?.byStatus ?? []} />
        </ChartCard>
        <ChartCard title="Staff by gender">
          <BarSeries data={data.people?.byGender ?? []} />
        </ChartCard>
      </Section>

      <Section title="Students">
        <ChartCard title="Student record completeness">
          <CompletenessSeries data={data.students?.recordCompleteness ?? []} />
        </ChartCard>
        <ChartCard title="Students by admission year">
          <BarSeries data={data.students?.byAdmissionYear ?? []} max={20} />
        </ChartCard>
        <ChartCard title="Students by gender">
          <BarSeries data={data.students?.byGender ?? []} />
        </ChartCard>
      </Section>

      <Section title="Attendance">
        <ChartCard title="Student attendance by code" subtitle="Every mark recorded for this institute">
          <BarSeries data={data.attendance?.studentByCode ?? []} />
        </ChartCard>
        <ChartCard title="Student attendance trend" subtitle="Marks per month; hover a column for the attendance rate">
          {data.attendance?.studentMonthlyTrend?.length ? (
            <TrendSeries data={data.attendance.studentMonthlyTrend} valueLabel=" marks" />
          ) : (
            <EmptySeries reason="No dated student attendance recorded." />
          )}
        </ChartCard>
        <ChartCard title="Staff attendance trend" subtitle="Punch records per month">
          {data.attendance?.staffMonthlyTrend?.length ? (
            <TrendSeries data={data.attendance.staffMonthlyTrend} valueLabel=" punches" />
          ) : (
            <EmptySeries reason="No staff attendance recorded." />
          )}
        </ChartCard>
      </Section>

      <Section title="Academics">
        <ChartCard title="Attainment bands" subtitle="Against this institute's own pass mark">
          <BarSeries data={data.academics?.attainmentBands ?? []} />
        </ChartCard>
        <ChartCard title="Mean score by subject">
          {data.academics?.bySubject?.length ? (
            <BarSeries data={data.academics.bySubject} unit="%" />
          ) : (
            <EmptySeries reason="Marks are recorded without a subject name, so no per-subject mean can be computed." />
          )}
        </ChartCard>
        <ChartCard title="Homework completion">
          <BarSeries data={data.academics?.homeworkCompletion ?? []} />
        </ChartCard>
      </Section>

      <Section title="Finance">
        <ChartCard title="Collection totals">
          <BarSeries data={data.finance?.totals ?? []} />
        </ChartCard>
        <ChartCard title="Receipts by payment mode">
          <BarSeries data={data.finance?.byPaymentMode ?? []} />
        </ChartCard>
        <ChartCard title="Collection trend" subtitle="Amount collected per month (INR)">
          {data.finance?.monthlyTrend?.length ? (
            <TrendSeries data={data.finance.monthlyTrend} valueLabel=" INR" />
          ) : (
            <EmptySeries reason="No dated fee receipts recorded." />
          )}
        </ChartCard>
      </Section>

      <Section title="Intelligence">
        <ChartCard title="Loop stages" subtitle="How far the data has travelled through the loop">
          <BarSeries data={(intel.loopStages ?? []) as BrainPoint[]} max={9} />
        </ChartCard>
        <ChartCard title="Signals by severity">
          <BarSeries data={(intel.signalsBySeverity ?? []) as BrainPoint[]} bySeverity />
        </ChartCard>
        <ChartCard title="Root-cause families">
          <BarSeries data={(intel.rootCauseFamilies ?? []) as BrainPoint[]} max={12} />
        </ChartCard>
        <ChartCard title="Findings by area of the school" subtitle="Where in the school's records each finding came from">
          <BarSeries data={(intel.signalsByArea ?? []) as BrainPoint[]} max={12} />
        </ChartCard>
        <ChartCard title="Recommendations by category">
          <BarSeries data={(intel.recommendationsByCategory ?? []) as BrainPoint[]} />
        </ChartCard>
        <ChartCard title="Recommendation confidence" subtitle="Computed from evidence, never asserted">
          <BarSeries data={(intel.confidenceDistribution ?? []) as BrainPoint[]} />
        </ChartCard>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
