'use client';

import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAnalytics, type BrainPoint } from '@/lib/brain/api';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import { toWidgetId, type DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';
import { useBrainResource } from '../_components/useBrainResource';
import { ErrorState, LoadingState, MetricTiles, HeroHeader } from '../_components/primitives';
import { BarSeries, ChartCard, CompletenessSeries, EmptySeries, TrendSeries } from '../_components/charts';

/**
 * Everything on this dashboard a user can hide for themselves, besides the
 * headline tiles (keyed from `data.headline`). Ids are stored per user — don't rename them.
 */
const ANALYTICS_WIDGETS = [
  { id: 'chart.organization.staff_by_department', label: 'Staff by department', group: 'chart' },
  { id: 'chart.organization.department_completeness', label: 'Department completeness', group: 'chart' },
  { id: 'chart.people.record_completeness', label: 'Staff record completeness', group: 'chart' },
  { id: 'chart.people.by_status', label: 'Staff by status', group: 'chart' },
  { id: 'chart.people.by_gender', label: 'Staff by gender', group: 'chart' },
  { id: 'chart.students.record_completeness', label: 'Student record completeness', group: 'chart' },
  { id: 'chart.students.by_admission_year', label: 'Students by admission year', group: 'chart' },
  { id: 'chart.students.by_gender', label: 'Students by gender', group: 'chart' },
  { id: 'chart.attendance.student_by_code', label: 'Student attendance by code', group: 'chart' },
  { id: 'chart.attendance.student_monthly_trend', label: 'Student attendance trend', group: 'chart' },
  { id: 'chart.attendance.staff_monthly_trend', label: 'Staff attendance trend', group: 'chart' },
  { id: 'chart.academics.attainment_bands', label: 'Attainment bands', group: 'chart' },
  { id: 'chart.academics.by_subject', label: 'Mean score by subject', group: 'chart' },
  { id: 'chart.academics.homework_completion', label: 'Homework completion', group: 'chart' },
  { id: 'chart.finance.totals', label: 'Collection totals', group: 'chart' },
  { id: 'chart.finance.by_payment_mode', label: 'Receipts by payment mode', group: 'chart' },
  { id: 'chart.finance.monthly_trend', label: 'Collection trend', group: 'chart' },
  { id: 'chart.intelligence.loop_stages', label: 'Loop stages', group: 'chart' },
  { id: 'chart.intelligence.signals_by_severity', label: 'Signals by severity', group: 'chart' },
  { id: 'chart.intelligence.root_cause_families', label: 'Root-cause families', group: 'chart' },
  { id: 'chart.intelligence.signals_by_area', label: 'Findings by area of the school', group: 'chart' },
  { id: 'chart.intelligence.recommendations_by_category', label: 'Recommendations by category', group: 'chart' },
  { id: 'chart.intelligence.confidence_distribution', label: 'Recommendation confidence', group: 'chart' },
] as const satisfies readonly DashboardWidget[];

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
  const widgets = useMemo(
    (): DashboardWidget[] => [
      ...(data?.headline ?? []).map((metric) => ({ id: toWidgetId('kpi', metric.key), label: metric.label, group: 'kpi' as const })),
      ...ANALYTICS_WIDGETS,
    ],
    [data],
  );
  const prefs = useDashboardPreferences('brain.analytics', widgets);
  const show: (id: (typeof ANALYTICS_WIDGETS)[number]['id']) => boolean = prefs.isVisible;

  // Wait for the user's layout too, so hidden widgets never flash in.
  if ((loading && !data) || !prefs.ready) return <LoadingState label="Computing analytics from the LMS database" />;
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <CustomizeDashboard
              widgets={widgets}
              {...prefs.customizeProps}
              className="h-auto rounded-xl border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white"
            />
          </div>
        }
      />

      {!prefs.hasVisible() && <AllWidgetsHiddenNotice />}

      <MetricTiles metrics={data.headline.filter((metric) => prefs.isVisible(toWidgetId('kpi', metric.key)))} />

      <Section title="Organization">
        {show('chart.organization.staff_by_department') && (
          <ChartCard title="Staff by department" subtitle="Headcount per department, largest first">
            <BarSeries data={data.organization?.staffByDepartment ?? []} unit="" />
          </ChartCard>
        )}
        {show('chart.organization.department_completeness') && (
          <ChartCard title="Department completeness" subtitle="How much of the structure is actually defined">
            <CompletenessSeries data={data.organization?.departmentCompleteness ?? []} />
          </ChartCard>
        )}
      </Section>

      <Section title="People">
        {show('chart.people.record_completeness') && (
          <ChartCard title="Staff record completeness">
            <CompletenessSeries data={data.people?.recordCompleteness ?? []} />
          </ChartCard>
        )}
        {show('chart.people.by_status') && (
          <ChartCard title="Staff by status">
            <BarSeries data={data.people?.byStatus ?? []} />
          </ChartCard>
        )}
        {show('chart.people.by_gender') && (
          <ChartCard title="Staff by gender">
            <BarSeries data={data.people?.byGender ?? []} />
          </ChartCard>
        )}
      </Section>

      <Section title="Students">
        {show('chart.students.record_completeness') && (
          <ChartCard title="Student record completeness">
            <CompletenessSeries data={data.students?.recordCompleteness ?? []} />
          </ChartCard>
        )}
        {show('chart.students.by_admission_year') && (
          <ChartCard title="Students by admission year">
            <BarSeries data={data.students?.byAdmissionYear ?? []} max={20} />
          </ChartCard>
        )}
        {show('chart.students.by_gender') && (
          <ChartCard title="Students by gender">
            <BarSeries data={data.students?.byGender ?? []} />
          </ChartCard>
        )}
      </Section>

      <Section title="Attendance">
        {show('chart.attendance.student_by_code') && (
          <ChartCard title="Student attendance by code" subtitle="Every mark recorded for this institute">
            <BarSeries data={data.attendance?.studentByCode ?? []} />
          </ChartCard>
        )}
        {show('chart.attendance.student_monthly_trend') && (
          <ChartCard title="Student attendance trend" subtitle="Marks per month; hover a column for the attendance rate">
            {data.attendance?.studentMonthlyTrend?.length ? (
              <TrendSeries data={data.attendance.studentMonthlyTrend} valueLabel=" marks" />
            ) : (
              <EmptySeries reason="No dated student attendance recorded." />
            )}
          </ChartCard>
        )}
        {show('chart.attendance.staff_monthly_trend') && (
          <ChartCard title="Staff attendance trend" subtitle="Punch records per month">
            {data.attendance?.staffMonthlyTrend?.length ? (
              <TrendSeries data={data.attendance.staffMonthlyTrend} valueLabel=" punches" />
            ) : (
              <EmptySeries reason="No staff attendance recorded." />
            )}
          </ChartCard>
        )}
      </Section>

      <Section title="Academics">
        {show('chart.academics.attainment_bands') && (
          <ChartCard title="Attainment bands" subtitle="Against this institute's own pass mark">
            <BarSeries data={data.academics?.attainmentBands ?? []} />
          </ChartCard>
        )}
        {show('chart.academics.by_subject') && (
          <ChartCard title="Mean score by subject">
            {data.academics?.bySubject?.length ? (
              <BarSeries data={data.academics.bySubject} unit="%" />
            ) : (
              <EmptySeries reason="Marks are recorded without a subject name, so no per-subject mean can be computed." />
            )}
          </ChartCard>
        )}
        {show('chart.academics.homework_completion') && (
          <ChartCard title="Homework completion">
            <BarSeries data={data.academics?.homeworkCompletion ?? []} />
          </ChartCard>
        )}
      </Section>

      <Section title="Finance">
        {show('chart.finance.totals') && (
          <ChartCard title="Collection totals">
            <BarSeries data={data.finance?.totals ?? []} />
          </ChartCard>
        )}
        {show('chart.finance.by_payment_mode') && (
          <ChartCard title="Receipts by payment mode">
            <BarSeries data={data.finance?.byPaymentMode ?? []} />
          </ChartCard>
        )}
        {show('chart.finance.monthly_trend') && (
          <ChartCard title="Collection trend" subtitle="Amount collected per month (INR)">
            {data.finance?.monthlyTrend?.length ? (
              <TrendSeries data={data.finance.monthlyTrend} valueLabel=" INR" />
            ) : (
              <EmptySeries reason="No dated fee receipts recorded." />
            )}
          </ChartCard>
        )}
      </Section>

      <Section title="Intelligence">
        {show('chart.intelligence.loop_stages') && (
          <ChartCard title="Loop stages" subtitle="How far the data has travelled through the loop">
            <BarSeries data={(intel.loopStages ?? []) as BrainPoint[]} max={9} />
          </ChartCard>
        )}
        {show('chart.intelligence.signals_by_severity') && (
          <ChartCard title="Signals by severity">
            <BarSeries data={(intel.signalsBySeverity ?? []) as BrainPoint[]} bySeverity />
          </ChartCard>
        )}
        {show('chart.intelligence.root_cause_families') && (
          <ChartCard title="Root-cause families">
            <BarSeries data={(intel.rootCauseFamilies ?? []) as BrainPoint[]} max={12} />
          </ChartCard>
        )}
        {show('chart.intelligence.signals_by_area') && (
          <ChartCard title="Findings by area of the school" subtitle="Where in the school's records each finding came from">
            <BarSeries data={(intel.signalsByArea ?? []) as BrainPoint[]} max={12} />
          </ChartCard>
        )}
        {show('chart.intelligence.recommendations_by_category') && (
          <ChartCard title="Recommendations by category">
            <BarSeries data={(intel.recommendationsByCategory ?? []) as BrainPoint[]} />
          </ChartCard>
        )}
        {show('chart.intelligence.confidence_distribution') && (
          <ChartCard title="Recommendation confidence" subtitle="Computed from evidence, never asserted">
            <BarSeries data={(intel.confidenceDistribution ?? []) as BrainPoint[]} />
          </ChartCard>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  // Every chart in it hidden by the user: drop the heading too rather than leave it over nothing.
  if (!React.Children.toArray(children).length) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
