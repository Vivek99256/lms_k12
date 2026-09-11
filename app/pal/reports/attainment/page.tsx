'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Loader2, Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buildSessionContext } from '@/lib/erp-client';
import { fetchClassStudents } from '@/app/pal/data/pal-lookups';
import { fetchAttainmentReport, type AttainmentReport } from '@/app/pal/data/pal-eso';

/**
 * Curriculum Coverage and Student Attainment — two reports, side by side.
 *
 * The gap between them is the finding. "92% of the curriculum is covered, 66%
 * of it has been demonstrated" tells a principal WHERE to intervene in a way no
 * single blended score can, so this screen never averages the two together.
 *
 * Three states are kept visually distinct because a school responds to each
 * differently:
 *
 *   not taught          — a content gap. Nobody failed anything.
 *   taught, no evidence — the class has not reached it yet.
 *   taught, low mastery — they are struggling. This is the one to act on.
 */
export default function AttainmentReportPage() {
  return (
    <Suspense fallback={<Centered><Loader2 className="h-5 w-5 animate-spin" /></Centered>}>
      <AttainmentReportView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center text-slate-500">{children}</div>;
}

interface StandardOption {
  id: string;
  name: string;
}

function AttainmentReportView() {
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [standardId, setStandardId] = useState('');
  const [report, setReport] = useState<AttainmentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const syear = useMemo(() => buildSessionContext().syear, []);

  // The classes this user can see. Derived from the student list rather than a
  // separate lookup because these carry real standard ids — the content-model
  // facets expose grade numbers, which are not the same thing and would query
  // the wrong class.
  useEffect(() => {
    const controller = new AbortController();

    fetchClassStudents({}, controller.signal)
      .then((students) => {
        const seen = new Map<string, string>();
        students.forEach((s) => {
          if (s.standardId && !seen.has(s.standardId)) {
            seen.set(s.standardId, s.standardName || s.standardId);
          }
        });
        setStandards(Array.from(seen, ([id, name]) => ({ id, name })));
      })
      .catch(() => setStandards([]));

    return () => controller.abort();
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!standardId || !syear) return;

      setLoading(true);
      setError('');
      try {
        setReport(await fetchAttainmentReport(standardId, syear, undefined, signal));
      } catch (caught) {
        if ((caught as Error)?.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : 'Could not load the report.');
        setReport(null);
      } finally {
        setLoading(false);
      }
    },
    [standardId, syear]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred to a microtask so setLoading/setError inside load() don't fire
    // synchronously within the effect body — same convention as
    // app/dashboard/StudentDashboard.tsx and app/pal/eso/page.tsx.
    queueMicrotask(() => {
      void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Coverage and attainment</h1>
        <p className="text-sm text-slate-600">
          What has been taught, and what students have actually demonstrated — {syear}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="standard" className="text-sm text-slate-600">
          Class
        </label>
        <select
          id="standard"
          value={standardId}
          onChange={(e) => setStandardId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Select a class…</option>
          {standards.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {standardId && (
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        )}
      </div>

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

      {!loading && !error && !standardId && (
        <p className="text-sm text-slate-500">Choose a class to see its coverage and attainment.</p>
      )}

      {!loading && !error && standardId && report && <ReportBody report={report} />}
    </div>
  );
}

function ReportBody({ report }: { report: AttainmentReport }) {
  const strugglingConcepts = report.concepts.filter(
    (c) => c.taught && c.studentsAttempted > 0 && (c.attainmentPct ?? 0) < 50
  );
  const untaught = report.concepts.filter((c) => !c.taught);

  return (
    <>
      {/* Two headline numbers, deliberately never combined. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-500" />
              <CardDescription>Curriculum coverage</CardDescription>
            </div>
            <CardTitle className="text-3xl">{report.coverage.coveragePct}%</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {report.coverage.conceptsTaught} of {report.coverage.conceptsTotal} concepts have teachable
            material, across {report.coverage.chaptersTotal} chapters.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-500" />
              <CardDescription>Student attainment</CardDescription>
            </div>
            <CardTitle className="text-3xl">
              {report.attainment.meanAttainmentPct === null
                ? '—'
                : `${report.attainment.meanAttainmentPct}%`}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {report.attainment.meanAttainmentPct === null ? (
              <>Nothing has been measured yet for this class.</>
            ) : (
              <>
                Average share of {report.studentCount} students who have demonstrated mastery, across the{' '}
                {report.attainment.conceptsMeasured} concepts that were actually taught.
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Said explicitly, because the two numbers above are easy to read as one
          score with a discrepancy rather than as two different measurements. */}
      <p className="text-xs text-slate-500">
        Coverage counts the whole curriculum. Attainment is measured only against concepts that were
        taught — a concept with no material has not been failed by anyone.
      </p>

      {strugglingConcepts.length > 0 && (
        <Section
          title="Where to intervene"
          description="Taught, attempted, and fewer than half the class has demonstrated it."
        >
          {strugglingConcepts.map((c) => (
            <Row
              key={c.conceptId}
              name={c.name}
              chapter={c.chapterName}
              right={`${c.attainmentPct}% · ${c.studentsAttempted} attempted`}
              tone="warn"
            />
          ))}
        </Section>
      )}

      {report.attainment.taughtButUnevidenced.length > 0 && (
        <Section
          title="Taught, but not started"
          description="Material exists and nobody has attempted it yet. Not the same problem as low attainment."
        >
          {report.attainment.taughtButUnevidenced.map((c) => (
            <Row key={c.conceptId} name={c.name} chapter={null} right="no attempts" tone="muted" />
          ))}
        </Section>
      )}

      {untaught.length > 0 && (
        <Section
          title="No teachable material"
          description="A content gap, not a teaching one. These are excluded from the attainment figure above."
        >
          {untaught.map((c) => (
            <Row key={c.conceptId} name={c.name} chapter={c.chapterName} right="not taught" tone="muted" />
          ))}
        </Section>
      )}
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">{children}</CardContent>
    </Card>
  );
}

function Row({
  name,
  chapter,
  right,
  tone,
}: {
  name: string;
  chapter: string | null;
  right: string;
  tone: 'warn' | 'muted';
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
      <div className="min-w-0">
        <span className="text-sm text-slate-800">{name}</span>
        {chapter && <span className="ml-2 text-xs text-slate-400">{chapter}</span>}
      </div>
      <Badge variant="outline" className={tone === 'warn' ? 'border-amber-300 text-amber-800' : 'text-slate-500'}>
        {right}
      </Badge>
    </div>
  );
}
