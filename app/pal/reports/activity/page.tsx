'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Brain, ClipboardList, Download, Loader2, Sparkles, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RecordTable, type RecordColumn } from '@/components/erp/RecordTable';
import { buildSessionContext } from '@/lib/erp-client';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import { getViewAsStudent, setViewAsStudent } from '@/app/pal/data/pal-view-as';
import StudentPicker from '@/app/pal/_components/StudentPicker';
import ViewAsBanner from '@/app/pal/_components/ViewAsBanner';
import type { PalStudentSelection } from '@/app/pal/data/pal';
import {
  fetchActivityReportDocx,
  fetchStudentActivityReport,
  type ActivityMasteryByChapter,
  type ActivityTopMisconception,
  type StudentActivityReport,
} from '@/app/pal/data/pal-activity-report';
import ActivityMasteryChart from '@/app/pal/reports/_components/ActivityMasteryChart';
import ActivityDiagnosticTrendChart from '@/app/pal/reports/_components/ActivityDiagnosticTrendChart';
import ActivityMisconceptionChart from '@/app/pal/reports/_components/ActivityMisconceptionChart';
import EngagementPlaceholderCard from '@/app/pal/reports/_components/EngagementPlaceholderCard';
import LearningIntelligenceSection from '@/app/pal/reports/_components/LearningIntelligenceSection';
import Reveal from '@/app/pal/reports/_components/Reveal';
import CountUpNumber from '@/app/pal/reports/_components/CountUpNumber';

/**
 * PAL Student Activity & Performance Report — one learner.
 *
 * Mirrors app/pal/reports/attainment/page.tsx's own shape (Suspense wrapper,
 * syear from buildSessionContext(), amber empty/error cards) and app/pal's
 * self vs. teacher-review gate (isStudentSession() + StudentPicker +
 * ViewAsBanner + pal-view-as.ts). Never recomputes anything: every number on
 * this page is read straight from the backend's JSON, including the
 * "insufficient data" flags on engagement/gamification.
 */
export default function StudentActivityReportPage() {
  return (
    <Suspense fallback={<Centered><Loader2 className="h-5 w-5 animate-spin" /></Centered>}>
      <StudentActivityReportView />
    </Suspense>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center text-slate-500">{children}</div>;
}

function StudentActivityReportView() {
  const [hydrated, setHydrated] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<PalStudentSelection | null>(null);

  const syear = useMemo(() => buildSessionContext().syear, []);
  const selfId = useMemo(() => buildSessionContext().userId, []);

  const [subjectId, setSubjectId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [report, setReport] = useState<StudentActivityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // Resolve role and any persisted "view as student" choice on mount.
  useEffect(() => {
    queueMicrotask(() => {
      const student = isStudentSession();
      setIsStudent(student);
      if (!student) {
        const viewing = getViewAsStudent();
        if (viewing) setSelectedStudent(viewing);
      }
      setHydrated(true);
    });
  }, []);

  const targetStudentId = isStudent ? selfId : selectedStudent?.studentId || '';

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!targetStudentId || !syear) return;
      setLoading(true);
      setError('');
      try {
        setReport(
          await fetchStudentActivityReport(targetStudentId, syear, {
            subjectId: subjectId || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            signal,
          })
        );
      } catch (caught) {
        if ((caught as Error)?.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : 'Couldn’t load the activity report.');
        setReport(null);
      } finally {
        setLoading(false);
      }
    },
    [targetStudentId, syear, subjectId, fromDate, toDate]
  );

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      void load(controller.signal);
    });
    return () => controller.abort();
  }, [hydrated, load]);

  const enterStudentView = (student: PalStudentSelection) => {
    setSelectedStudent(student);
    setViewAsStudent(student);
  };
  const exitStudentView = () => {
    setSelectedStudent(null);
    setViewAsStudent(null);
    setReport(null);
  };

  const download = async () => {
    if (!targetStudentId || !syear) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const blob = await fetchActivityReportDocx('student', targetStudentId, syear, {
        subjectId: subjectId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pal-activity-report-${targetStudentId}.docx`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (caught) {
      setDownloadError(caught instanceof Error ? caught.message : 'Couldn’t prepare the document.');
    } finally {
      setDownloading(false);
    }
  };

  if (!hydrated) {
    return (
      <Centered>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Centered>
    );
  }

  if (!syear) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">Academic year missing</CardTitle>
            <CardDescription className="text-amber-800">
              Your session is missing academic year information. Please sign in again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const needsStudent = !isStudent && !selectedStudent;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-wrap items-start justify-between gap-3 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-5 py-5 shadow-sm"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-indigo-200/30 blur-2xl"
        />
        <div className="relative space-y-1">
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">PAL · Reports</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Activity &amp; performance report</h1>
          <p className="text-sm text-slate-600">
            Diagnostic and practice activity, mastery and common mistakes — {syear}
          </p>
        </div>
        {!needsStudent && (
          <div className="relative flex flex-col items-end gap-1">
            <Button onClick={() => void download()} disabled={downloading} className="shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98]">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? 'Preparing document…' : 'Download .docx'}
            </Button>
            {downloadError && <p className="text-xs text-amber-700">{downloadError}</p>}
          </div>
        )}
      </motion.header>

      {!isStudent && !selectedStudent && <StudentPicker audience="Teacher" onSelect={enterStudentView} />}

      {!isStudent && selectedStudent && (
        <ViewAsBanner student={selectedStudent} audience="Teacher" onExit={exitStudentView} />
      )}

      {!needsStudent && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Subject ID</span>
              <Input
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                placeholder="All subjects"
                className="h-9 w-40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">From</span>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">To</span>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9" />
            </label>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Centered>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </Centered>
      )}

      {!loading && error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base text-amber-900">Report unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-800">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && needsStudent && (
        <p className="text-sm text-slate-500">Pick a student above to see their activity report.</p>
      )}

      {!loading && !error && report && <StudentReportBody report={report} />}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon: typeof Target;
  accent: string;
}) {
  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`h-1 w-full bg-gradient-to-r ${accent}`} aria-hidden />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <Icon className="h-4 w-4 text-slate-400 transition-colors group-hover:text-indigo-500" />
        </div>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function StudentReportBody({ report }: { report: StudentActivityReport }) {
  const {
    scope,
    masteryOverview,
    diagnosticPerformance,
    adaptivePerformance,
    misconceptionAnalysis,
    gamification,
    engagement,
    recommendations,
    intelligence,
  } = report;

  const chapterColumns: Array<RecordColumn<ActivityMasteryByChapter>> = [
    { key: 'chapterName', label: 'Chapter', value: (row) => row.chapterName || String(row.chapterId) },
    { key: 'mastered', label: 'Mastered', align: 'right', value: (row) => String(row.mastered) },
    { key: 'learning', label: 'Learning', align: 'right', value: (row) => String(row.learning) },
    { key: 'unseen', label: 'Unseen', align: 'right', value: (row) => String(row.unseen) },
  ];

  const misconceptionColumns: Array<RecordColumn<ActivityTopMisconception>> = [
    { key: 'tag', label: 'Misconception', value: (row) => row.tag },
    { key: 'description', label: 'Description', value: (row) => row.description },
    { key: 'correctiveAction', label: 'Corrective action', value: (row) => row.correctiveAction },
    { key: 'detectionCount', label: 'Detected', align: 'right', value: (row) => String(row.detectionCount) },
  ];

  const scopeLabel =
    [scope.learnerName, scope.standardName, scope.sectionName, scope.subjectName].filter(Boolean).join(' · ') ||
    'This student';

  return (
    <div className="space-y-6">
      <Reveal>
        <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-transparent">
          <CardHeader className="pb-2">
            <CardDescription>Scope</CardDescription>
            <CardTitle className="text-base">{scopeLabel}</CardTitle>
          </CardHeader>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryStat
            label="Nodes mastered"
            icon={Target}
            accent="from-emerald-400 to-emerald-500"
            value={
              <>
                <CountUpNumber value={masteryOverview.mastered} /> / {masteryOverview.nodesTotal}
              </>
            }
          />
          <SummaryStat
            label="Diagnostic attempts"
            icon={ClipboardList}
            accent="from-sky-400 to-sky-500"
            value={<CountUpNumber value={diagnosticPerformance.attemptsCount} />}
          />
          <SummaryStat
            label="Adaptive accuracy"
            icon={Brain}
            accent="from-indigo-400 to-indigo-500"
            value={<CountUpNumber value={adaptivePerformance.accuracy ?? 0} suffix="%" />}
          />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mastery by chapter</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityMasteryChart data={masteryOverview.byChapter} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Diagnostic performance over time</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityDiagnosticTrendChart data={diagnosticPerformance.trend} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top misconceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityMisconceptionChart data={misconceptionAnalysis.topMisconceptions} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mastery by chapter — detail</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordTable
              rows={masteryOverview.byChapter}
              columns={chapterColumns}
              getRowKey={(row, index) => `${row.chapterId}-${index}`}
              exportFilename="activity-report-by-chapter"
              exportTitle="Mastery by chapter"
              exportSubtitle={scopeLabel}
              emptyTitle="No chapter mastery recorded yet."
            />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Misconceptions — detail</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordTable
              rows={misconceptionAnalysis.topMisconceptions}
              columns={misconceptionColumns}
              getRowKey={(row, index) => `${row.tag}-${index}`}
              exportFilename="activity-report-misconceptions"
              exportTitle="Misconceptions"
              exportSubtitle={scopeLabel}
              emptyTitle="No misconceptions flagged."
            />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <EngagementPlaceholderCard engagement={engagement} gamification={gamification} />
      </Reveal>

      <Reveal>
        <LearningIntelligenceSection intelligence={intelligence} />
      </Reveal>

      {recommendations.length > 0 && (
        <Reveal>
          <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {recommendations.map((rec, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    • {rec}
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      )}
    </div>
  );
}
