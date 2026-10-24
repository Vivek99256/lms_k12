'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Flame,
  Award,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { buildSessionContext } from '@/lib/erp-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DashboardError, StatCard } from '@/app/dashboard/_components/DashboardPrimitives';
import {
  defaultLearnerId,
  fetchAutoStudentDashboard,
  fetchChapterDashboard,
  type ChapterDashboard,
  type ChapterSection,
} from '@/app/pal/data/pal-eso';
import {
  fetchPalLanding,
  type PalLandingData,
  type PalChapter,
  type PalSubject,
} from '@/app/pal/data/pal';
import ChapterDashboardView from '@/app/pal/eso/_components/ChapterDashboardView';
import { friendlyError } from '@/lib/user-messages';

type DashboardTab = 'curriculum' | 'sections' | 'combined';

export default function StudentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ChapterDashboard | null>(null);
  const [landing, setLanding] = useState<PalLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingChapter, setSwitchingChapter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('curriculum');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    const learnerId = defaultLearnerId();
    const syear = buildSessionContext().syear || '2022';
    if (!learnerId) {
      setError('Your session is missing academic year information. Please sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // 1. Fetch active ESO chapter dashboard (with fallback to 1014 Metals and Non-metals)
    const esoPromise = fetchAutoStudentDashboard(learnerId, syear, signal)
      .then((result) => {
        if (result.dashboard && result.dashboard.chapterSections.length > 0) {
          setData(result.dashboard);
        } else {
          return fetchChapterDashboard(learnerId, 1014, signal).then(setData);
        }
      })
      .catch(() => {
        if (signal?.aborted) return;
        return fetchChapterDashboard(learnerId, 1014, signal).then(setData);
      });

    // 2. Fetch subject curriculum chapters (Screenshot 1)
    const landingPromise = fetchPalLanding({ signal })
      .then((palData) => {
        setLanding(palData);
        if (palData.subjects.length > 0) {
          setSelectedSubjectId(palData.subjects[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not load PAL subject chapters', err);
      });

    Promise.allSettled([esoPromise, landingPromise])
      .then(() => {
        if (!signal?.aborted) setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!signal?.aborted) {
          setError(friendlyError(reason, "We couldn't load your learning dashboard. Please try again."));
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const handleSelectChapter = async (chapter: PalChapter) => {
    const numericId = Number(chapter.id);
    if (!numericId) return;

    // If already on this chapter, simply open sections tab
    if (isCurrentActive(chapter, data)) {
      setActiveTab('sections');
      return;
    }

    setSwitchingChapter(true);
    try {
      const learnerId = defaultLearnerId();
      const newDash = await fetchChapterDashboard(learnerId, numericId);
      if (newDash && newDash.chapterSections && newDash.chapterSections.length > 0) {
        setData(newDash);
        setActiveTab('sections');
      } else {
        router.push(`/pal/eso/chapter/${numericId}`);
      }
    } catch {
      router.push(`/pal/eso/chapter/${numericId}`);
    } finally {
      setSwitchingChapter(false);
    }
  };

  const activeSubject = landing?.subjects.find((s) => s.id === selectedSubjectId) || landing?.subjects[0];

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 p-6 lg:p-8">
      {loading && (
        <div className="max-w-6xl">
          <h1 className="text-2xl font-bold text-slate-900">Hello, {user?.name || 'student'}</h1>
          <p className="mt-1 text-sm text-slate-500">Loading your learning dashboard and curriculum...</p>
          <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            Loading adaptive path...
          </div>
        </div>
      )}

      {!loading && error && <DashboardError message={error} onRetry={() => load()} />}

      {!loading && !error && data && (
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hello, {user?.name || 'Student'}</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  Welcome to your learning dashboard. Continue your active topic or explore any chapter below.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/pal/eso/learning-path"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Learning Path
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/pal"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100/70"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Full Catalog
                </Link>
              </div>
            </div>

            {/* Quick Badges Row */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-medium text-indigo-800">
                <Sparkles className="h-3 w-3 text-indigo-600" />
                Active Chapter: <strong className="font-semibold">{data.chapterName}</strong>
              </span>
              {data.currentConceptName && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600">
                  Current: {data.currentConceptName}
                </span>
              )}
            </div>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Mastered concepts"
              value={`${data.masteredConcepts} of ${data.totalConceptsInCurriculum || data.chapterSections.length}`}
              icon={ListChecks}
              tone={data.masteredConcepts > 0 ? 'positive' : 'default'}
            />
            <StatCard
              label="Current concept"
              value={data.currentConceptName ?? 'Metals and Non-metals'}
              icon={Target}
            />
            <StatCard
              label="Learning streak"
              value={data.gamification.streakCurrent > 0 ? `${data.gamification.streakCurrent} days` : 'Not started'}
              icon={Flame}
              tone={data.gamification.streakCurrent > 0 ? 'positive' : 'default'}
            />
            <StatCard
              label="Badges earned"
              value={data.gamification.badgesEarned}
              icon={Award}
              tone={data.gamification.badgesEarned > 0 ? 'positive' : 'default'}
            />
          </div>

          {/* Active Learning Hero Card (Screenshot 2 Core: Next Step Diagnostic) */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/60 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    <Zap className="h-3 w-3" />
                    Next Step
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Chapter: {data.chapterName}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                  {data.nextStep?.title || `We need a few responses on ${data.currentConceptName || 'Physical Properties of Metals'} before this step can be personalised.`}
                </h2>
                <p className="text-xs text-slate-600 sm:text-sm">
                  {data.nextStep?.subtitle || `• No responses recorded for ${data.currentConceptName || 'Physical Properties of Metals'}`}
                </p>
                {data.nextStep?.reasons && data.nextStep.reasons.length > 0 && (
                  <ul className="mt-1 space-y-1 text-xs text-slate-500">
                    {data.nextStep.reasons.map((r, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  onClick={() => {
                    const cid = data.currentConceptId || data.chapterSections[0]?.conceptId;
                    if (cid) {
                      router.push(`/pal/eso?conceptId=${cid}&learnerId=${defaultLearnerId()}`);
                    }
                  }}
                  className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                >
                  {data.nextStep?.ctaLabel || 'Start diagnostic'}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWhy((v) => !v)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  See why
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab(activeTab === 'sections' ? 'curriculum' : 'sections')}
                  className="bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200"
                >
                  <Layers className="mr-1.5 h-3.5 w-3.5" />
                  {activeTab === 'sections' ? 'View All Chapters' : `View ${data.chapterSections.length} Sections`}
                </Button>
              </div>
            </div>

            {showWhy && (
              <div className="mt-3 rounded-lg border border-indigo-100 bg-white/90 p-3 text-xs text-slate-700 shadow-sm animate-in fade-in duration-150">
                <strong>Why this step:</strong> Based on your diagnostic status, the engine personalises your learning path by testing this concept first.
              </div>
            )}
          </div>

          {/* Hybrid Navigation Tabs: All Chapters (Screen 1) vs Chapter Sections (Screen 2) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-1 rounded-lg bg-slate-200/60 p-1 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab('curriculum')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all',
                  activeTab === 'curriculum'
                    ? 'bg-white text-indigo-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                All Curriculum Chapters {activeSubject?.chapters ? `(${activeSubject.chapters.length})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sections')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all',
                  activeTab === 'sections'
                    ? 'bg-white text-indigo-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Sections in {data.chapterName} ({data.chapterSections.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('combined')}
                className={cn(
                  'hidden sm:flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all',
                  activeTab === 'combined'
                    ? 'bg-white text-indigo-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Show Both
              </button>
            </div>

            {switchingChapter && (
              <span className="flex items-center gap-1.5 text-xs text-indigo-600 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Switching chapter...
              </span>
            )}
          </div>

          {/* TAB 1: ALL CURRICULUM CHAPTERS (Screenshot 1 Exact Re-creation) */}
          {(activeTab === 'curriculum' || activeTab === 'combined') && (
            <div className="space-y-4">
              {/* Subject selector if multiple subjects exist */}
              {landing && landing.subjects.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {landing.subjects.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubjectId(sub.id)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                        (selectedSubjectId === sub.id || (!selectedSubjectId && sub === landing.subjects[0]))
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Subject Box with Chapters */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100/70 text-violet-700">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {activeSubject?.name || data.subjectName || 'Science'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {activeSubject?.chapters ? `${activeSubject.chapters.length} chapters` : '12 chapters'}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {activeSubject?.chapters && activeSubject.chapters.length > 0 ? (
                    activeSubject.chapters.map((chapter) => {
                      const isCurrent = isCurrentActive(chapter, data);
                      return (
                        <div
                          key={chapter.id}
                          className={cn(
                            'flex flex-col gap-3 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70',
                            isCurrent && 'bg-indigo-50/30'
                          )}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleSelectChapter(chapter)}
                              className="text-left text-sm font-semibold text-slate-900 hover:text-indigo-600 hover:underline underline-offset-2"
                            >
                              {chapter.name}
                            </button>

                            {/* Attempt Badge (Screenshot 1) */}
                            {chapter.hasDiagnostic && (
                              <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 border border-violet-100/80">
                                Already attempted
                                {chapter.diagnosticLevel ? ` · ${chapter.diagnosticLevel}` : ''}
                                {chapter.diagnosticPercentage != null ? ` · ${Math.round(chapter.diagnosticPercentage)}%` : ''}
                              </span>
                            )}

                            {chapter.quizCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {chapter.quizCount} quiz{chapter.quizCount === 1 ? '' : 'zes'}
                              </span>
                            )}

                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
                                <Sparkles className="h-3 w-3" />
                                Current Focus · {data.chapterSections.length} sections
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrent ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setActiveTab('sections')}
                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                              >
                                View {data.chapterSections.length} Sections
                                <ChevronRight className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSelectChapter(chapter)}
                                className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50"
                              >
                                Practice
                                <ChevronRight className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* Fallback default list if subjects API still loading */
                    DEFAULT_SCIENCE_CHAPTERS.map((chap, idx) => {
                      const isCurrent = chap.name.toLowerCase().includes('metals and non-metals');
                      return (
                        <div
                          key={idx}
                          className={cn(
                            'flex flex-col gap-3 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70',
                            isCurrent && 'bg-indigo-50/30'
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-sm font-semibold text-slate-900">{chap.name}</span>
                            {chap.badge && (
                              <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 border border-violet-100/80">
                                {chap.badge}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
                                <Sparkles className="h-3 w-3" />
                                Current Focus
                              </span>
                            )}
                          </div>
                          {isCurrent && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveTab('sections')}
                              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              View 17 Sections
                              <ChevronRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SECTIONS IN THIS CHAPTER (Screenshot 2 Exact Re-creation) */}
          {(activeTab === 'sections' || activeTab === 'combined') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Sections in this chapter ({data.chapterSections.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    This shows every section in {data.chapterName}.
                  </p>
                </div>
                {activeTab === 'sections' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('curriculum')}
                    className="text-xs text-slate-600"
                  >
                    ← Back to All Chapters
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 17 Sections List Panel */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="divide-y divide-slate-100">
                    {data.chapterSections.map((sec) => (
                      <SectionRow
                        key={sec.conceptId}
                        section={sec}
                        onOpen={(cid) => router.push(`/pal/eso?conceptId=${cid}&learnerId=${defaultLearnerId()}`)}
                      />
                    ))}
                  </div>
                </div>

                {/* Evidence / What PAL has seen so far */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-900">What PAL has seen so far</h4>
                  <p className="text-xs text-slate-500">Evidence gathered on your current concept.</p>

                  <div className="mt-4 space-y-3">
                    {data.masterySignals.length > 0 ? (
                      data.masterySignals.map((signal) => {
                        const percent = signal.hasEvidence ? Math.round((signal.value ?? 0) * 100) : 0;
                        return (
                          <div key={signal.key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span className="text-slate-700">{signal.label}</span>
                              <span className="text-slate-500">
                                {signal.hasEvidence ? `${percent}%` : 'No evidence yet'}
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all duration-300',
                                  signal.hasEvidence ? 'bg-indigo-600' : 'bg-slate-300'
                                )}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400">No signals recorded yet for this concept.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Alumni Board */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Alumni</h2>
            <p className="mt-1 text-xs text-slate-600">
              Jobs and internships from people who studied here, and mentors who can guide you.
            </p>
            <Link
              href="/alumni/student"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Open the alumni board
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionRow({
  section,
  onOpen,
}: {
  section: ChapterSection;
  onOpen: (conceptId: number) => void;
}) {
  const isLocked = section.status === 'locked';
  const isMastered = section.status === 'mastered';

  return (
    <div
      onClick={() => !isLocked && onOpen(section.conceptId)}
      className={cn(
        'flex items-center justify-between py-3 transition-colors',
        isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'
      )}
    >
      <div className="flex items-center gap-2.5">
        {isLocked ? (
          <Lock className="h-4 w-4 shrink-0 text-slate-400" />
        ) : isMastered ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-slate-300" />
        )}
        <span className="text-sm font-medium text-slate-900">{section.name}</span>
      </div>

      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
          isLocked && 'bg-slate-100 text-slate-400',
          section.status === 'not_started' && 'bg-slate-100 text-slate-600',
          section.status === 'in_progress' && 'bg-amber-50 text-amber-700',
          isMastered && 'bg-emerald-50 text-emerald-700'
        )}
      >
        {isLocked ? 'Locked' : section.status === 'not_started' ? 'Not started' : isMastered ? 'Mastered' : 'In progress'}
      </span>
    </div>
  );
}

function isCurrentActive(chapter: PalChapter, currentDash: ChapterDashboard | null): boolean {
  if (!currentDash) return false;
  if (Number(chapter.id) === currentDash.chapterId) return true;
  const chap = chapter.name.toLowerCase();
  const active = currentDash.chapterName.toLowerCase();
  return chap.includes(active) || active.includes(chap);
}

const DEFAULT_SCIENCE_CHAPTERS = [
  { name: 'The Ever-Evolving World of Science', badge: 'Already attempted · beginner · 33%' },
  { name: 'Exploring Substances: Acidic, Basic, and Neutral', badge: null },
  { name: 'Electricity: Circuits and their Components', badge: 'Already attempted · beginner · 20%' },
  { name: 'The World of Metals and Non-metals', badge: null },
  { name: 'Changes Around Us: Physical and Chemical', badge: null },
  { name: 'Adolescence: A Stage of Growth and Change', badge: null },
  { name: 'Heat Transfer in Nature', badge: null },
  { name: 'Measurement of Time and Motion', badge: null },
  { name: 'Light, Shadows and Reflections', badge: null },
  { name: 'Water: A Precious Resource', badge: null },
  { name: 'Forests: Our Lifeline', badge: null },
  { name: 'Wastewater Story', badge: null },
];

