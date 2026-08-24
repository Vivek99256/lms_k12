'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    Award,
    BarChart3,
    CheckCircle2,
    Flame,
    Lightbulb,
    Loader2,
    RefreshCw,
    Sparkles,
    Target,
    TrendingUp,
    type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchSessionSummary, type SessionSummary } from '@/app/pal/data/pal';

type TabId = 'overview' | 'progress' | 'praise' | 'upcoming' | 'streak';

interface TabDef {
    id: TabId;
    label: string;
    icon: LucideIcon;
}

const TABS: TabDef[] = [
    { id: 'overview', label: 'Session Summary', icon: Sparkles },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'praise', label: 'Praise', icon: Lightbulb },
    { id: 'upcoming', label: 'Upcoming', icon: Target },
    { id: 'streak', label: 'Streak', icon: Flame },
];

export default function PalSessionSummaryPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading session summary...
                </div>
            }
        >
            <PalSessionSummaryContent />
        </Suspense>
    );
}

function PalSessionSummaryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const questionPaperId = searchParams?.get('id') || searchParams?.get('session_id') || '';

    const [summary, setSummary] = useState<SessionSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    const overviewRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const praiseRef = useRef<HTMLDivElement>(null);
    const upcomingRef = useRef<HTMLDivElement>(null);
    const streakRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!questionPaperId) return;
        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchSessionSummary(questionPaperId, controller.signal);
                setSummary(data);
            } catch (reason) {
                if (controller.signal.aborted) return;
                setError(reason instanceof Error ? reason.message : 'Unable to load session summary.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [questionPaperId]);

    const backToPal = useCallback(() => {
        router.push('/pal');
    }, [router]);

    const nextQuiz = useCallback(() => {
        router.push('/pal');
    }, [router]);

    const scrollTo = useCallback((tab: TabId) => {
        setActiveTab(tab);
        const refs: Record<TabId, React.RefObject<HTMLDivElement | null>> = {
            overview: overviewRef,
            progress: progressRef,
            praise: praiseRef,
            upcoming: upcomingRef,
            streak: streakRef,
        };
        refs[tab].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    if (!questionPaperId || error || (!loading && !summary)) {
        return (
            <div className="mx-auto max-w-2xl p-6">
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <p className="text-sm text-slate-600">
                        {!questionPaperId ? 'Missing session reference.' : error || 'Session summary unavailable.'}
                    </p>
                    <Button variant="outline" className="mt-4" onClick={backToPal}>
                        <ArrowLeft className="h-4 w-4" />
                        Back to PAL
                    </Button>
                </div>
            </div>
        );
    }

    if (loading || !summary) {
        return (
            <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading session summary...
            </div>
        );
    }

    const totalMarks = summary.totalMarks || 1;
    const scorePercent = Math.round((summary.obtainMarks / totalMarks) * 100);
    const hasCelebration = scorePercent >= 70 || summary.conceptsWorkedOn.some((c) => c.masteryChange > 0);

    return (
        <div className="min-h-screen p-4 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Session Summary</h1>
                        <p className="text-sm text-slate-500">
                            {summary.sessionStart ? new Date(summary.sessionStart).toLocaleString() : 'Session completed'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={backToPal}>
                            <ArrowLeft className="h-4 w-4" />
                            Back to PAL
                        </Button>
                        <Button onClick={nextQuiz}>
                            <RefreshCw className="h-4 w-4" />
                            Next quiz
                        </Button>
                    </div>
                </div>

                {/* Five-section menu */}
                <nav className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Session summary sections">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => scrollTo(tab.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                    isActive
                                        ? 'border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Overview section */}
                <div ref={overviewRef} className="scroll-mt-4">
                    {hasCelebration && (
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                            <Sparkles className="mx-auto h-8 w-8 text-emerald-600" />
                            <h2 className="mt-2 text-lg font-semibold text-emerald-900">Great work this session!</h2>
                            <p className="mt-1 text-sm text-emerald-800">
                                You made real progress. Keep it up!
                            </p>
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard
                            icon={<Award className="h-5 w-5" />}
                            label="Score"
                            value={`${summary.obtainMarks}/${summary.totalMarks}`}
                            tone="indigo"
                        />
                        <StatCard
                            icon={<CheckCircle2 className="h-5 w-5" />}
                            label="Accuracy"
                            value={`${summary.accuracy}%`}
                            tone="emerald"
                        />
                        <StatCard
                            icon={<Target className="h-5 w-5" />}
                            label="Concepts"
                            value={String(summary.totalConcepts)}
                            tone="amber"
                        />
                        <StatCard
                            icon={<TrendingUp className="h-5 w-5" />}
                            label="Progress"
                            value={`${scorePercent}%`}
                            tone="violet"
                        />
                    </div>

                    {summary.careerQuestUpdate && (
                        <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 px-5 py-4">
                                <h2 className="text-base font-semibold text-slate-900">Career Quest</h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    {summary.careerQuestUpdate.stageLabel} — {summary.careerQuestUpdate.stageDescription}
                                </p>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-sm text-slate-700">
                                    {summary.careerQuestUpdate.masteredSkillCount} of {summary.careerQuestUpdate.totalSkillCount} skills mastered
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {summary.careerQuestUpdate.activityCount} activities completed
                                </p>
                            </div>
                        </section>
                    )}

                    {summary.badgesEarned.length > 0 && (
                        <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 px-5 py-4">
                                <h2 className="text-base font-semibold text-slate-900">Badges earned</h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {summary.badgesEarned.map((badge, idx) => (
                                    <div key={idx} className="flex items-start gap-3 px-5 py-4">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                            <Award className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{badge.badgeName}</p>
                                            <p className="mt-0.5 text-xs text-slate-600">{badge.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Progress section */}
                <div ref={progressRef} className="scroll-mt-4">
                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="text-base font-semibold text-slate-900">Today you worked on</h2>
                            <p className="mt-1 text-xs text-slate-500">
                                {summary.conceptsWorkedOn.length > 0
                                    ? summary.conceptsWorkedOn.map((c) => c.conceptName).join(', ')
                                    : 'No concepts recorded for this session.'}
                            </p>
                        </div>
                        {summary.conceptsWorkedOn.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[560px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                                            <th className="px-5 py-3 font-semibold">Concept</th>
                                            <th className="px-5 py-3 font-semibold">Before</th>
                                            <th className="px-5 py-3 font-semibold">After</th>
                                            <th className="px-5 py-3 font-semibold">Change</th>
                                            <th className="px-5 py-3 font-semibold">Accuracy</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {summary.conceptsWorkedOn.map((concept) => (
                                            <tr key={concept.conceptName} className="hover:bg-slate-50/60">
                                                <td className="px-5 py-3 font-medium text-slate-900">{concept.conceptName}</td>
                                                <td className="px-5 py-3">
                                                    <ProgressBar value={concept.masteryBefore} tone="slate" />
                                                </td>
                                                <td className="px-5 py-3">
                                                    <ProgressBar value={concept.masteryAfter} tone="indigo" />
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`text-xs font-semibold ${concept.masteryChange > 0 ? 'text-emerald-700' : concept.masteryChange < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                                                        {concept.masteryChange > 0 ? '+' : ''}{concept.masteryChange}%
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-sm tabular-nums text-slate-600">{concept.accuracy}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-5 py-8 text-center text-sm text-slate-500">
                                No concepts recorded for this session.
                            </div>
                        )}
                    </section>
                </div>

                {/* Praise section */}
                <div ref={praiseRef} className="scroll-mt-4">
                    {summary.specificPraise.length > 0 ? (
                        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                            <div className="flex items-start gap-3">
                                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-amber-900">Specific praise</h3>
                                    {summary.specificPraise.map((praise, idx) => (
                                        <div key={idx} className="rounded-lg border border-amber-100 bg-white px-4 py-3">
                                            <p className="text-sm text-amber-800">{praise.praiseText}</p>
                                            {praise.reason && (
                                                <p className="mt-1 text-xs text-amber-700">{praise.reason}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                            No specific praise for this session.
                        </div>
                    )}
                </div>

                {/* Upcoming section */}
                <div ref={upcomingRef} className="scroll-mt-4">
                    {summary.upcoming.length > 0 ? (
                        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 px-5 py-4">
                                <h2 className="text-base font-semibold text-slate-900">Upcoming</h2>
                                <p className="mt-1 text-xs text-slate-500">Recommended next steps</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {summary.upcoming.map((item, idx) => (
                                    <div key={idx} className="px-5 py-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{item.conceptName}</p>
                                                {item.reason && (
                                                    <p className="mt-1 text-xs text-slate-600">{item.reason}</p>
                                                )}
                                            </div>
                                            {item.expectedTiming && (
                                                <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                                                    {item.expectedTiming}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                            No upcoming concepts recommended yet. Keep learning to unlock your next steps!
                        </div>
                    )}
                </div>

                {/* Streak section */}
                <div ref={streakRef} className="scroll-mt-4">
                    {summary.streak ? (
                        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
                            <div className="flex items-center gap-3">
                                <Flame className="h-6 w-6 text-rose-600" />
                                <div>
                                    <p className="text-sm font-semibold text-rose-900">
                                        Day {summary.streak.currentStreak} — see you tomorrow
                                    </p>
                                    <p className="text-xs text-rose-700">
                                        Longest streak: {summary.streak.longestStreak} days
                                    </p>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                            No streak data yet. Complete a session every day to build your streak!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    tone: 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet';
}) {
    const toneStyles: Record<typeof tone, string> = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        rose: 'bg-rose-50 text-rose-600',
        amber: 'bg-amber-50 text-amber-600',
        violet: 'bg-violet-50 text-violet-600',
    };
    return (
        <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneStyles[tone]}`}>{icon}</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
        </article>
    );
}

function ProgressBar({ value, tone }: { value: number; tone: 'slate' | 'indigo' | 'emerald' | 'rose' | 'amber' }) {
    const toneStyles: Record<typeof tone, string> = {
        slate: 'bg-slate-500',
        indigo: 'bg-indigo-500',
        emerald: 'bg-emerald-500',
        rose: 'bg-rose-500',
        amber: 'bg-amber-500',
    };
    return (
        <div className="flex items-center gap-2">
            <div className="h-2.5 w-28 overflow-hidden rounded-full bg-slate-100">
                <div
                    className={`h-full rounded-full ${toneStyles[tone]}`}
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-600">{Math.round(value)}%</span>
        </div>
    );
}
