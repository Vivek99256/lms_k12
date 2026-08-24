'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  BookOpen,
  CircleHelp,
  ClipboardList,
  Compass,
  Flame,
  Loader2,
  Lightbulb,
  RefreshCw,
  Route,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchBadgeSummary,
  evaluateBadges,
  type BadgeApiDefinition,
  type BadgeApiAward,
} from '@/app/pal/data/pal-badge-api';

const CATEGORIES = [
  { key: 'Mastery', label: 'Mastery', icon: <Target className="h-4 w-4" />, color: 'emerald' },
  { key: 'Fluency', label: 'Fluency', icon: <TrendingUp className="h-4 w-4" />, color: 'sky' },
  { key: 'Persistence', label: 'Persistence', icon: <Flame className="h-4 w-4" />, color: 'orange' },
  { key: 'Curiosity', label: 'Curiosity', icon: <Sparkles className="h-4 w-4" />, color: 'purple' },
  { key: 'Social', label: 'Social', icon: <Users className="h-4 w-4" />, color: 'cyan' },
  { key: 'Career', label: 'Career', icon: <Compass className="h-4 w-4" />, color: 'teal' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

function resolveIcon(iconName: string | null): ReactNode {
  const map: Record<string, ReactNode> = {
    Target: <Target className="h-6 w-6" />,
    Star: <Star className="h-6 w-6" />,
    Zap: <Zap className="h-6 w-6" />,
    CheckCircle2: <Target className="h-6 w-6" />,
    TrendingUp: <TrendingUp className="h-6 w-6" />,
    Footprints: <Target className="h-6 w-6" />,
    Flame: <Flame className="h-6 w-6" />,
    BookOpen: <BookOpen className="h-6 w-6" />,
    ClipboardList: <ClipboardList className="h-6 w-6" />,
    CircleHelp: <CircleHelp className="h-6 w-6" />,
    Users: <Users className="h-6 w-6" />,
    Lightbulb: <Lightbulb className="h-6 w-6" />,
    Compass: <Compass className="h-6 w-6" />,
    ClipboardCheck: <ClipboardList className="h-6 w-6" />,
    Route: <Route className="h-6 w-6" />,
  };
  return map[iconName || ''] || <Award className="h-6 w-6" />;
}

export default function PalBadgesPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<CategoryKey | 'all'>('all');
  const [data, setData] = useState<{ summary: { totalBadges: number; categories: Record<string, number>; recentBadges: Array<{ id: number; badgeCode: string; badgeName: string; category: string; description: string; icon: string | null; color: string | null; earnedAt: string; evidence: Record<string, unknown> | null }> }; badges: BadgeApiDefinition[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBadges, setNewBadges] = useState<BadgeApiAward[]>([]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBadgeSummary(signal);
      setData(result);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load badge data.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch loader, matches repo PAL pages
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleEvaluate = useCallback(async () => {
    try {
      const result = await evaluateBadges({});
      if (result.awarded.length > 0) {
        setNewBadges((prev) => [...result.awarded.map((a) => ({
          id: Date.now() + Math.random(),
          userId: '',
          subInstituteId: '',
          syear: '',
          badgeId: 0,
          badgeCode: a.badgeCode,
          badgeName: a.badgeName,
          category: a.category,
          description: a.reason,
          icon: null,
          color: null,
          earnedAt: new Date().toISOString(),
          evidence: a.evidence,
        })), ...prev]);
      }
      void load();
    } catch {
      // silent
    }
  }, [load]);

  const filteredBadges = activeCategory === 'all'
    ? data?.badges ?? []
    : data?.badges.filter((b) => b.category === activeCategory) ?? [];

  const earnedCount = data?.badges.filter((b) => b.earned).length ?? 0;
  const totalCount = data?.badges.length ?? 0;

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Milestones & Badges</h1>
              <p className="text-sm text-slate-500">Your learning achievements and milestones.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={handleEvaluate}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Check for new badges
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={() => router.push('/pal/visibility')}
            >
              <Shield className="h-3.5 w-3.5" />
              Visibility & Access
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={() => router.push('/pal')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Back to PAL
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => load()} className="border-rose-200 text-rose-700 hover:bg-rose-100">
              Retry
            </Button>
          </div>
        )}

        {newBadges.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">New Badges Earned!</h2>
            {newBadges.map((badge) => (
              <div key={badge.id} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">{badge.badgeName}</p>
                  <p className="mt-0.5 text-xs text-amber-800">{badge.description}</p>
                  <p className="mt-1 text-[11px] text-amber-600">{new Date(badge.earnedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading badges...
          </div>
        ) : totalCount === 0 ? (
          <EmptyState onRetry={() => load()} />
        ) : (
          <>
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Total badges" value={earnedCount} sub={`of ${totalCount}`} icon={<Award className="h-5 w-5" />} tone="indigo" />
              <SummaryCard label="Mastery" value={data?.badges.filter((b) => b.category === 'Mastery' && b.earned).length ?? 0} sub={`of ${data?.badges.filter((b) => b.category === 'Mastery').length}`} icon={<Target className="h-5 w-5" />} tone="emerald" />
              <SummaryCard label="Fluency" value={data?.badges.filter((b) => b.category === 'Fluency' && b.earned).length ?? 0} sub={`of ${data?.badges.filter((b) => b.category === 'Fluency').length}`} icon={<TrendingUp className="h-5 w-5" />} tone="sky" />
              <SummaryCard label="Persistence" value={data?.badges.filter((b) => b.category === 'Persistence' && b.earned).length ?? 0} sub={`of ${data?.badges.filter((b) => b.category === 'Persistence').length}`} icon={<Flame className="h-5 w-5" />} tone="orange" />
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  activeCategory === 'all'
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat.key;
                const cls = cat.color === 'emerald' ? { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' } :
                  cat.color === 'sky' ? { border: 'border-sky-200', bg: 'bg-sky-50', text: 'text-sky-700' } :
                  cat.color === 'orange' ? { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-700' } :
                  cat.color === 'purple' ? { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700' } :
                  cat.color === 'cyan' ? { border: 'border-cyan-200', bg: 'bg-cyan-50', text: 'text-cyan-700' } :
                  cat.color === 'teal' ? { border: 'border-teal-200', bg: 'bg-teal-50', text: 'text-teal-700' } :
                  { border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-700' };
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      active ? `${cls.border} ${cls.bg} ${cls.text}` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat.icon}
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Badge grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBadges.map((badge) => {
                const colors = COLOR_MAP[badge.color || ''] || COLOR_MAP.slate;
                return (
                  <div
                    key={badge.badgeCode}
                    className={`rounded-xl border p-4 transition ${
                      badge.earned
                        ? `${colors.bg} ${colors.border}`
                        : 'border-slate-200 bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${badge.earned ? colors.bg : 'bg-slate-100'} text-slate-500`}>
                        {resolveIcon(badge.icon)}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${badge.earned ? colors.text : 'text-slate-600'}`}>
                          {badge.badgeName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{badge.category}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-600 line-clamp-2">{badge.description}</p>
                    {badge.earned && badge.progress && Object.keys(badge.progress).length > 0 && (
                      <div className="mt-2 rounded-lg bg-white/60 p-2">
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Evidence</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {Object.entries(badge.progress)
                            .filter(([, v]) => v !== null && v !== undefined && v !== '')
                            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'number' ? Math.round(v as number) : String(v)}`)
                            .join(' · ')}
                        </p>
                      </div>
                    )}
                    {badge.earned && (
                      <p className="mt-2 text-[11px] text-slate-400">Earned</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, icon, tone }: { label: string; value: number; sub: string; icon: ReactNode; tone: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-600' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
  };
  const colors = colorMap[tone] || colorMap.indigo;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.bg} ${colors.text}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-[11px] text-slate-400">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center">
      <Award className="h-12 w-12 text-slate-300" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">No badges yet</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        You haven&apos;t earned a milestone badge yet. Keep learning — your first milestone is waiting.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
    </div>
  );
}
