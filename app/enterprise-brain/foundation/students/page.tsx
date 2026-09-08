'use client';

import React, { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchStudentProfile, fetchStudents, type BrainStudentProfile } from '@/lib/brain/api';
import { useBrainResource } from '../../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, HeroHeader } from '../../_components/primitives';
import { BarSeries, ChartCard, CompletenessSeries } from '../../_components/charts';
import { Delta, EvidenceStrip, IntelligenceCard, SeverityChip } from '../../_components/IntelligenceCard';

/**
 * The student roll, and the intelligence the Brain has derived from it.
 *
 * THE SIGNALS SIT ABOVE THE TABLE ON PURPOSE. A list of 3,438 students tells an
 * administrator nothing they did not already know; "attendance is recorded for
 * only 33 of them" is the finding they came for. The roll is underneath as the
 * evidence for it, not as the point of the screen.
 *
 * ABSENCE COUNTS ARE JOINED FOR THE ROWS ON THIS PAGE ONLY. Counting absences
 * for the whole roll to display three hundred of them would scan the attendance
 * log for nothing; the query is bounded to the students actually shown.
 */
export default function StudentsPage() {
  const [term, setTerm] = useState('');
  const [applied, setApplied] = useState('');
  const { data, error, loading, refreshing, refresh } = useBrainResource(() => fetchStudents(applied), [applied]);

  // One student's intelligence, loaded on demand. The roll is the index; the
  // profile is the thing worth reading, and loading 300 of them up front to
  // show one would be 300 wasted queries.
  const [profile, setProfile] = useState<BrainStudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const openStudent = useCallback(async (id: string) => {
    setProfileLoading(true);
    setProfile(null);
    try {
      setProfile(await fetchStudentProfile(id));
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  if (loading && !data) return <LoadingState label="Reading the student roll" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  if (!data.available) {
    return (
      <div className="p-6">
        <HeroHeader breadcrumb="Enterprise Brain · Foundation" title="Students" />
        <Card className="p-8">
          <p className="text-sm text-slate-400">This LMS database has no student table, so the Brain has no student roll to read.</p>
        </Card>
      </div>
    );
  }

  const incomplete = data.data.filter((row) => !row.record_complete).length;

  return (
    <div className="p-6">
      <HeroHeader
        breadcrumb="Enterprise Brain · Foundation"
        title="Students"
        description="The LMS's own student roll, reused rather than duplicated, with the signals the Brain has raised about it."
        actions={
          <div className="flex items-center gap-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setApplied(term.trim());
              }}
              className="flex items-center gap-2"
            >
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Name or enrollment no…"
                className="w-56 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-400 placeholder:text-slate-500"
              />
              <button type="submit" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white">
                Search
              </button>
            </form>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      <MetricTiles
        metrics={[
          { key: 'total', label: 'Students', value: data.total },
          { key: 'shown', label: 'Shown', value: data.data.length },
          { key: 'incomplete', label: 'Incomplete on this page', value: incomplete },
          { key: 'signals', label: 'Student signals', value: data.signals.length },
        ]}
      />

      {data.signals.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
            What the Brain has found about these students
          </h2>
          <div className="space-y-3">
            {data.signals.map((signal) => (
              <IntelligenceCard key={signal.id} model={signal} />
            ))}
          </div>
        </section>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ChartCard title="Record completeness">
          <CompletenessSeries data={data.analytics?.recordCompleteness ?? []} />
        </ChartCard>
        <ChartCard title="By admission year">
          <BarSeries data={data.analytics?.byAdmissionYear ?? []} max={20} />
        </ChartCard>
        <ChartCard title="By gender">
          <BarSeries data={data.analytics?.byGender ?? []} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">
              Student roll <span className="font-normal text-slate-400">({data.total.toLocaleString()} total, {data.data.length} shown)</span>
            </p>
            <p className="text-[11px] text-slate-400">Select a student to see their individual intelligence.</p>
          </div>
          <DataTable
            columns={[
              { key: 'enrollment_no', label: 'Enrollment' },
              { key: 'first_name', label: 'First name' },
              { key: 'last_name', label: 'Last name' },
              { key: 'gender', label: 'Gender' },
              { key: 'dob', label: 'Date of birth' },
              { key: 'mobile', label: 'Mobile' },
              { key: 'admission_year', label: 'Admitted' },
              { key: 'absences', label: 'Absences' },
            ]}
            rows={data.data}
            onRowClick={(row) => openStudent(String(row.id))}
            emptyMessage={applied ? `No students matching “${applied}”.` : 'No students on the roll for this organization.'}
            maxHeight="34rem"
          />
        </Card>

        <div>
          {profileLoading && <LoadingState label="Reading this student" />}
          {!profileLoading && !profile && (
            <Card className="flex h-full min-h-[16rem] flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-medium text-slate-500">Select a student</p>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                Their attendance against their class, subject strengths and weaknesses, risks and recommended actions appear
                here &mdash; each traced to the school&apos;s own records.
              </p>
            </Card>
          )}
          {!profileLoading && profile && <StudentProfile profile={profile} />}
        </div>
      </div>
    </div>
  );
}

/**
 * One student, read the way a form tutor would want it.
 *
 * COMPARISONS ARE AGAINST THEIR OWN CLASS, not the school and not a national
 * figure: 76% attendance means something quite different in a class averaging
 * 91% than in one averaging 78%, and only the first is worth a phone call.
 *
 * MISSING DATA IS STATED, NOT ZEROED. A student with no marks recorded shows
 * "no marks recorded", never 0%, because a child who has not been assessed and
 * a child who scored nothing are not the same child.
 */
function StudentProfile({ profile }: { profile: BrainStudentProfile }) {
  if (!profile.available) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">{profile.reason}</p>
      </Card>
    );
  }

  const riskTone =
    profile.risk === 'High'
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : profile.risk === 'Medium'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-200';

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight text-slate-900">{profile.name}</h2>
            <p className="text-[11px] text-slate-400">
              {profile.enrollmentNo || 'No enrolment number'}
              {profile.admissionYear ? ` · admitted ${profile.admissionYear}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${riskTone}`}>
            {profile.risk} risk
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">{profile.summary}</p>

        {profile.metrics.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            {profile.metrics.map((metric) => (
              <div key={metric.key}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{metric.label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{metric.value}</p>
                <Delta change={metric.change} label={metric.changeLabel} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {(profile.strengths.length > 0 || profile.weaknesses.length > 0) && (
        <Card className="p-5">
          {profile.weaknesses.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Weakest subjects</p>
              <div className="space-y-1.5">
                {profile.weaknesses.map((subject) => (
                  <div key={subject.label} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs text-slate-600">{subject.label}</span>
                    <span className="text-xs font-semibold tabular-nums text-rose-600">{subject.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {profile.strengths.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Strongest subjects</p>
              <div className="space-y-1.5">
                {profile.strengths.map((subject) => (
                  <div key={subject.label} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs text-slate-600">{subject.label}</span>
                    <span className="text-xs font-semibold tabular-nums text-emerald-600">{subject.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {profile.risks.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Risks</p>
          <div className="space-y-3">
            {profile.risks.map((risk) => (
              <div key={risk.label}>
                <div className="flex items-center gap-2">
                  <SeverityChip severity={risk.severity} />
                  <p className="text-xs font-semibold text-slate-800">{risk.label}</p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{risk.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {profile.evidence.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Evidence</p>
          <EvidenceStrip evidence={profile.evidence} />
        </Card>
      )}

      {profile.recommendations.length > 0 && (
        <Card className="bg-slate-50 p-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Recommended actions</p>
          <ul className="space-y-1.5">
            {profile.recommendations.map((rec) => (
              <li key={rec} className="text-sm leading-relaxed text-slate-700">• {rec}</li>
            ))}
          </ul>
        </Card>
      )}

      {profile.dataGaps.length > 0 && (
        <Card className="p-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Not recorded</p>
          <ul className="space-y-1">
            {profile.dataGaps.map((gap) => (
              <li key={gap} className="text-xs leading-relaxed text-slate-400">{gap}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
