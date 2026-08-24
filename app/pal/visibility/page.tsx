'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Award,
    Brain,
    Flame,
    Info,
    Loader2,
    Rocket,
    Shield,
    Sparkles,
    Target,
    Trophy,
    Users,
    Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

type Domain = {
    key: string;
    label: string;
    icon: React.ReactNode;
    description: string;
};

const DOMAINS: Domain[] = [
    { key: 'mastery', label: 'Mastery', icon: <Target className="h-4 w-4" />, description: 'Concept mastery levels and progress' },
    { key: 'badges', label: 'Milestone Badges', icon: <Award className="h-4 w-4" />, description: 'Achievement badges and milestones' },
    { key: 'streak', label: 'Streak', icon: <Flame className="h-4 w-4" />, description: 'Learning streak data' },
    { key: 'personal_best', label: 'Personal Best', icon: <Trophy className="h-4 w-4" />, description: 'Personal best records and PBs' },
    { key: 'career_quest', label: 'Career Quest', icon: <Rocket className="h-4 w-4" />, description: 'Career exploration and pathways' },
    { key: 'team_challenge', label: 'Team Challenges', icon: <Users className="h-4 w-4" />, description: 'Team challenge progress' },
    { key: 'challenge_mode', label: 'Challenge Mode', icon: <Zap className="h-4 w-4" />, description: 'Challenge mode scores and leaderboard' },
    { key: 'notifications', label: 'Notifications', icon: <Sparkles className="h-4 w-4" />, description: 'Gamification notifications and alerts' },
];

const ACCESS_LEVEL_LABELS: Record<string, { label: string; tone: string; description: string }> = {
    full: { label: 'Full Access', tone: 'emerald', description: 'Complete personal data visible' },
    aggregate: { label: 'Aggregate Only', tone: 'sky', description: 'Class/institution aggregates only' },
    milestone: { label: 'Milestones Only', tone: 'amber', description: 'Milestone/career signals only' },
    summary: { label: 'Summary', tone: 'indigo', description: 'Summary-level data only' },
    current: { label: 'Current Value', tone: 'violet', description: 'Current value only (e.g., streak)' },
    none: { label: 'No Access', tone: 'rose', description: 'This data is not accessible' },
    count_only: { label: 'Count Only', tone: 'orange', description: 'Count/statistics only' },
    per_student: { label: 'Per Student', tone: 'teal', description: 'Per-student breakdown available' },
    own_plus_optin_top5: { label: 'Own + Opt-in Top 5', tone: 'purple', description: 'Own data plus opted-in top 5' },
    opt_in_only: { label: 'Opt-in Only', tone: 'cyan', description: 'Only visible if user opts in' },
    same_aggregate: { label: 'Same Aggregate', tone: 'slate', description: 'Class aggregate shared with classmates' },
};

const ROLE_DESCRIPTIONS: Record<string, { label: string; tone: string; description: string }> = {
    student: { label: 'Student', tone: 'indigo', description: 'You can only see your own personal gamification data.' },
    teacher: { label: 'Teacher', tone: 'emerald', description: 'You can see authorized students\' data in your classes.' },
    parent: { label: 'Parent', tone: 'amber', description: 'You can see your child\'s permitted milestones and career signals.' },
    admin: { label: 'Admin', tone: 'slate', description: 'You have limited aggregate access to institutional data.' },
};

export default function VisibilityPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<
        Array<{
            domain: string;
            granted: boolean;
            accessLevel: string;
            canViewPersonal: boolean;
            canViewAggregate: boolean;
            canViewMilestone: boolean;
            canViewFull: boolean;
        }>
    >([]);

    useEffect(() => {
        const session = buildSessionContext();
        if (!session.token) {
            router.push('/login');
        }
    }, [router]);

    const loadPermissions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const session = buildSessionContext();
            const url = new URL('/api/pal/gamification/visibility/permissions', window.location.origin);
            url.searchParams.set('user_id', session.userId);
            url.searchParams.set('sub_institute_id', session.subInstituteId);
            url.searchParams.set('syear', session.syear);
            const res = await fetch(url.toString(), {
                headers: {
                    ...createAuthHeaders(session),
                    Accept: 'application/json',
                },
                cache: 'no-store',
            });
            const payload = await res.json().catch(() => ({}));
            const record = payload && typeof payload === 'object' ? payload : {};
            if (String(record.status) !== '1') {
                throw new Error(String(record.message || 'Unable to load visibility permissions.'));
            }
            const data = record.data && typeof record.data === 'object' ? record.data : {};
            setRole(data.actor?.role || null);
            setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        } catch (reason) {
            if (reason instanceof Error) {
                setError(reason.message);
            } else {
                setError('Unable to load visibility data.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch loader, matches repo PAL pages
        void loadPermissions();
    }, [loadPermissions]);

    const getToneClass = (tone: string) => {
        const map: Record<string, { bg: string; text: string; border: string }> = {
            emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
            sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
            amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
            indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
            violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
            rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
            orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
            teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
            purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
            cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
            slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
        };
        return map[tone] || map.slate;
    };

    const grantedCount = permissions.filter((p) => p.granted).length;
    const totalCount = permissions.length;

    return (
        <div className="min-h-full px-4 py-5 sm:px-6">
            <div className="mx-auto w-full max-w-[1100px] space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                            <Shield className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Visibility & Access</h1>
                            <p className="text-sm text-slate-500">
                                Your gamification access scope and privacy controls.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => router.push('/pal')}
                        >
                            <Brain className="h-3.5 w-3.5" />
                            Back to PAL
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                        <Button size="sm" variant="outline" onClick={loadPermissions} className="ml-3 border-rose-200 text-rose-700 hover:bg-rose-100">
                            Retry
                        </Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading visibility data...
                    </div>
                ) : role ? (
                    <>
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ROLE_DESCRIPTIONS[role]?.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' : ROLE_DESCRIPTIONS[role]?.tone === 'amber' ? 'bg-amber-50 text-amber-600' : ROLE_DESCRIPTIONS[role]?.tone === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                                        <Shield className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-semibold text-slate-900">
                                            Logged in as: <span className="capitalize">{role}</span>
                                        </h2>
                                        <p className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[role]?.description}</p>
                                    </div>
                                </div>
                                <div className="text-xs font-medium text-slate-500">
                                    {grantedCount} of {totalCount} gamification areas accessible
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {DOMAINS.map((domain) => {
                                const perm = permissions.find((p) => p.domain === domain.key);
                                const granted = perm?.granted ?? false;
                                const accessLevel = perm?.accessLevel || 'none';
                                const accessInfo = ACCESS_LEVEL_LABELS[accessLevel] || ACCESS_LEVEL_LABELS.none;
                                const tone = accessInfo.tone;
                                const colors = getToneClass(tone);

                                return (
                                    <div
                                        key={domain.key}
                                        className={`rounded-xl border p-4 transition ${
                                            granted ? `${colors.bg} ${colors.border}` : 'border-slate-200 bg-white opacity-70'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${granted ? colors.bg : 'bg-slate-100'} text-slate-500`}>
                                                {domain.icon}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-semibold ${granted ? colors.text : 'text-slate-600'}`}>
                                                    {domain.label}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500">{domain.description}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 space-y-1">
                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${granted ? colors.border + ' ' + colors.bg + ' ' + colors.text : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                                {granted ? accessInfo.label : 'No Access'}
                                            </span>
                                            <p className="text-[11px] text-slate-500">{accessInfo.description}</p>
                                        </div>
                                        {granted && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {perm?.canViewPersonal && (
                                                    <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Personal</span>
                                                )}
                                                {perm?.canViewAggregate && (
                                                    <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Aggregate</span>
                                                )}
                                                {perm?.canViewMilestone && (
                                                    <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Milestone</span>
                                                )}
                                                {perm?.canViewFull && (
                                                    <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Full</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                                <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold text-slate-900">About Visibility Governance</h3>
                                <p className="text-xs text-slate-600">
                                    Row 7 enforces backend visibility rules so that you only see gamification data you are authorized to access.
                                    Students see only their own data. Teachers see data for students in their authorized classes.
                                    Parents see only their child&apos;s permitted milestones and career signals.
                                </p>
                                    <p className="text-xs text-slate-600">
                                        These rules are enforced on the server. Even if a URL is manipulated, unauthorized access is blocked.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                        <Shield className="mx-auto h-12 w-12 text-slate-300" />
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">No visibility data</h3>
                        <p className="mt-1 max-w-md text-sm text-slate-500">
                            Unable to determine your role. Please ensure you are signed in.
                        </p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={loadPermissions}>
                            Retry
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
