'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  BookOpen,
  Briefcase,
  ChevronRight,
  Compass,
  FlaskConical,
  Loader2,
  Map,
  RefreshCw,
  Rocket,
  Star,
  Target,
  X,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchCareerQuestState,
  fetchCareerPathways,
  fetchPathwaySkills,
  fetchCareerQuestSummary,
  declareCareerInterest,
  recordCareerActivity,
  type StageDefinition,
  type CareerPathway,
  type PathwayWithSkills,
} from '@/app/pal/data/cq-api';
import type { CareerQuestState } from '@/app/pal/data/cq-types';
import { isStudentSession } from '@/app/pal/data/pal-lookups';

type Tab = 'explorer' | 'skill_builder' | 'pathway_seeker' | 'career_builder';

const TABS: { key: Tab; label: string; icon: ReactNode; description: string }[] = [
  { key: 'explorer', label: 'Explorer', icon: <Compass className="h-4 w-4" />, description: 'Explore new domains and build curiosity.' },
  { key: 'skill_builder', label: 'Skill Builder', icon: <Zap className="h-4 w-4" />, description: 'Grow your skill tree and discover interests.' },
  { key: 'pathway_seeker', label: 'Pathway Seeker', icon: <Map className="h-4 w-4" />, description: 'Discover career pathways that fit you.' },
  { key: 'career_builder', label: 'Career Builder', icon: <Briefcase className="h-4 w-4" />, description: 'Build your career preparation plan.' },
];

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  explorer: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  skill_builder: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  pathway_seeker: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  career_builder: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

interface CareerQuestShellProps {
  initialTab: Tab;
}

export default function CareerQuestShell({ initialTab }: CareerQuestShellProps) {
  const router = useRouter();
  const isStaff = !isStudentSession();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [state, setState] = useState<CareerQuestState | null>(null);
  const [stages, setStages] = useState<StageDefinition[]>([]);
  const [grade, setGrade] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathways, setPathways] = useState<CareerPathway[]>([]);
  const [selectedPathway, setSelectedPathway] = useState<PathwayWithSkills | null>(null);
  const [summary, setSummary] = useState<{ activityCount: number; interestCount: number; masteredSkillCount: number; totalSkillCount: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [interestForm, setInterestForm] = useState({ interestType: 'riasec' as string, interestValue: '' });
  const [activityForm, setActivityForm] = useState({ activityType: 'exploration' as string, activityName: '' });

  const currentStage = state?.currentStage ?? 'explorer';
  const colors = STAGE_COLORS[currentStage] || STAGE_COLORS.explorer;

  const loadState = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [stateResult, summaryResult] = await Promise.all([
        fetchCareerQuestState(signal),
        fetchCareerQuestSummary(signal).catch(() => null),
      ]);
      setState(stateResult.state);
      setStages(stateResult.stages);
      setGrade(stateResult.grade);
      setActiveTab(stateResult.state.currentStage);
      if (summaryResult) {
        setSummary({
          activityCount: summaryResult.activityCount,
          interestCount: summaryResult.interestCount,
          masteredSkillCount: summaryResult.masteredSkillCount,
          totalSkillCount: summaryResult.totalSkillCount,
        });
      }
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load career quest data.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const loadPathways = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchCareerPathways(true, signal);
      setPathways(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch loader, matches repo PAL pages
    void loadState(controller.signal);
    void loadPathways(controller.signal);
    return () => controller.abort();
  }, [loadState, loadPathways]);

  const handleStageChange = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedPathway(null);
    router.push(`/pal/career-quest/${tab.replace('_', '-')}`);
  };

  const handleViewPathway = useCallback(async (pathwayId: number) => {
    setSelectedPathway(null);
    try {
      const data = await fetchPathwaySkills(pathwayId);
      setSelectedPathway(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load pathway details.');
    }
  }, []);

  const handleInterestDeclare = useCallback(async () => {
    if (!interestForm.interestValue.trim()) return;
    setSubmitting(true);
    try {
      await declareCareerInterest({
        interestType: interestForm.interestType,
        interestValue: interestForm.interestValue.trim(),
      });
      setInterestForm({ interestType: 'riasec', interestValue: '' });
      void loadState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save interest.');
    } finally {
      setSubmitting(false);
    }
  }, [interestForm, loadState]);

  const handleActivityComplete = useCallback(async () => {
    if (!activityForm.activityName.trim()) return;
    setSubmitting(true);
    try {
      await recordCareerActivity({
        activityType: activityForm.activityType,
        activityName: activityForm.activityName.trim(),
      });
      setActivityForm({ activityType: 'exploration', activityName: '' });
      void loadState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to record activity.');
    } finally {
      setSubmitting(false);
    }
  }, [activityForm, loadState]);

  const isStageLocked = (stage: Tab): boolean => {
    if (!grade) return false;
    const order: Tab[] = ['explorer', 'skill_builder', 'pathway_seeker', 'career_builder'];
    const currentIndex = order.indexOf(activeTab);
    const targetIndex = order.indexOf(stage);
    return targetIndex > currentIndex;
  };

  const stageDef = stages.find((s) => s.stage === activeTab) || stages[0];

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Rocket className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Career Quest</h1>
              <p className="text-sm text-slate-500">
                {state ? `${stageDef?.label || 'Career Quest'} — Grade ${grade ?? 'N/A'}` : 'Your personalized career exploration journey.'}
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
              <RefreshCw className="h-3.5 w-3.5" />
              Back to PAL
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => loadState()} className="border-rose-200 text-rose-700 hover:bg-rose-100">
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading career quest...
          </div>
        ) : !state ? (
          <EmptyState onRetry={() => loadState()} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => {
                const locked = isStageLocked(tab.key);
                const active = activeTab === tab.key;
                const tabColors = STAGE_COLORS[tab.key] || STAGE_COLORS.explorer;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => !locked && handleStageChange(tab.key)}
                    disabled={locked}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? `${tabColors.border} ${tabColors.bg} ${tabColors.text}`
                        : locked
                          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {locked && <X className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-5">
                {activeTab === 'explorer' && (
                  <ExplorerStage
                    onRecordActivity={handleActivityComplete}
                    activityForm={activityForm}
                    setActivityForm={setActivityForm}
                    submitting={submitting}
                  />
                )}
                {activeTab === 'skill_builder' && (
                  <SkillBuilderStage
                    state={state}
                    onDeclareInterest={handleInterestDeclare}
                    interestForm={interestForm}
                    setInterestForm={setInterestForm}
                    submitting={submitting}
                  />
                )}
                {activeTab === 'pathway_seeker' && (
                  <PathwaySeekerStage
                    state={state}
                    pathways={pathways}
                    selectedPathway={selectedPathway}
                    onViewPathway={handleViewPathway}
                  />
                )}
                {activeTab === 'career_builder' && (
                  <CareerBuilderStage
                    state={state}
                    pathways={pathways}
                    selectedPathway={selectedPathway}
                    onViewPathway={handleViewPathway}
                  />
                )}
              </div>

              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase">Current Stage</h2>
                  <div className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${colors.bg} ${colors.text} ${colors.border}`}>
                    {TABS.find((t) => t.key === currentStage)?.icon}
                    <span className="text-sm font-semibold">{stageDef?.label || currentStage}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{stageDef?.description}</p>
                  <p className="mt-1 text-xs text-slate-400">{stageDef?.gradeRange}</p>
                </div>

                {isStaff && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-indigo-700 uppercase">Teacher View</h2>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-indigo-600">Current Stage</p>
                        <p className="text-sm font-bold text-indigo-900">{stageDef?.label || currentStage}</p>
                        <p className="text-xs text-indigo-600">{stageDef?.gradeRange}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-indigo-600">Grade</p>
                        <p className="text-sm font-bold text-indigo-900">{grade ?? 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-indigo-600">Activities Completed</p>
                        <p className="text-sm font-bold text-indigo-900">{summary?.activityCount ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-indigo-600">Interest Signals</p>
                        <p className="text-sm font-bold text-indigo-900">
                          {summary?.interestCount ?? 0} declared
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-indigo-600">Pathway Progress</p>
                        <p className="text-sm font-bold text-indigo-900">
                          {summary?.masteredSkillCount ?? 0} / {summary?.totalSkillCount ?? 0} skills
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-indigo-600">
                      Student data is isolated to the current learner.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center">
      <Rocket className="h-12 w-12 text-slate-300" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Career Quest not started</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Your career exploration journey will appear here once you begin. Complete activities to unlock pathways.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
    </div>
  );
}

function ExplorerStage({
  onRecordActivity,
  activityForm,
  setActivityForm,
  submitting,
}: {
  onRecordActivity: () => void;
  activityForm: { activityType: string; activityName: string };
  setActivityForm: (form: { activityType: string; activityName: string }) => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Explorer</h2>
            <p className="text-sm text-slate-500">Discover new domains and build curiosity. No forced career choices here.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ExplorerCard title="HPC Domain Exploration" description="Explore high-potential career domains through interactive content." icon={<FlaskConical className="h-4 w-4" />} />
          <ExplorerCard title="Curiosity Badges" description="Earn badges for exploring new topics and content types." icon={<Award className="h-4 w-4" />} />
          <ExplorerCard title="Content Discovery" description="Find subjects and chapters that spark your interest." icon={<BookOpen className="h-4 w-4" />} />
          <ExplorerCard title="Learning Patterns" description="Understand how you learn best through exploration." icon={<BookOpen className="h-4 w-4" />} />
        </div>

        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Record Exploration Activity</h3>
          <p className="mt-1 text-xs text-slate-500">Log an exploration activity to track your curiosity journey.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <select
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={activityForm.activityType}
              onChange={(e) => setActivityForm({ ...activityForm, activityType: e.target.value })}
            >
              <option value="exploration">Exploration</option>
              <option value="skill_builder">Skill Builder</option>
              <option value="pathway_discovery">Pathway Discovery</option>
            </select>
            <input
              type="text"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Activity name..."
              value={activityForm.activityName}
              onChange={(e) => setActivityForm({ ...activityForm, activityName: e.target.value })}
            />
            <Button size="sm" onClick={onRecordActivity} disabled={submitting || !activityForm.activityName.trim()}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
              Record
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 uppercase">Progress</h3>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Exploration activities</span>
              <span className="font-medium text-slate-900">0 completed</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-sky-500" style={{ width: '0%' }} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Keep exploring — every new discovery counts!</p>
      </section>
    </div>
  );
}

function ExplorerCard({ title, description, icon }: { title: string; description: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sky-600">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

function SkillBuilderStage({
  state,
  onDeclareInterest,
  interestForm,
  setInterestForm,
  submitting,
}: {
  state: CareerQuestState;
  onDeclareInterest: () => void;
  interestForm: { interestType: string; interestValue: string };
  setInterestForm: (form: { interestType: string; interestValue: string }) => void;
  submitting: boolean;
}) {
  const interestDeclaration = state.interestDeclaration || {};
  const interestEntries = Object.entries(interestDeclaration);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Skill Builder</h2>
            <p className="text-sm text-slate-500">Grow your skill tree and explore introductory career interests.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SkillCard title="Skill Tree Growth" description="Track your developing skills across subjects." progress={65} />
          <SkillCard title="Career Signals" description="Early indicators of your career interests." progress={40} />
          <SkillCard title="Interest Exploration" description="Non-binding interest declarations to guide your journey." progress={interestEntries.length > 0 ? 50 : 0} />
          <SkillCard title="LearningStreak" description="Build consistent learning habits." progress={30} />
        </div>

        <div className="mt-5 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-800">Non-Binding Interest Declaration</h3>
          <p className="mt-1 text-xs text-amber-700">
            This is an exploratory tool, not a permanent career decision. You can update or remove your interests at any time.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <select
              className="block w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
              value={interestForm.interestType}
              onChange={(e) => setInterestForm({ ...interestForm, interestType: e.target.value })}
            >
              <option value="riasec">RIASEC Interest</option>
              <option value="pathway">Career Pathway</option>
              <option value="skill">Skill Area</option>
              <option value="cluster">Career Cluster</option>
            </select>
            <input
              type="text"
              className="block w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="e.g., Technology, Science, Arts..."
              value={interestForm.interestValue}
              onChange={(e) => setInterestForm({ ...interestForm, interestValue: e.target.value })}
            />
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={onDeclareInterest} disabled={submitting || !interestForm.interestValue.trim()}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
              Declare Interest
            </Button>
          </div>

          {interestEntries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {interestEntries.map(([key, value]) => (
                <span key={key} className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                  {String(value)}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SkillCard({ title, description, progress }: { title: string; description: string; progress: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        <span className="text-xs font-medium text-slate-500">{progress}%</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    </div>
  );
}

function PathwaySeekerStage({
  state,
  pathways,
  selectedPathway,
  onViewPathway,
}: {
  state: CareerQuestState;
  pathways: CareerPathway[];
  selectedPathway: PathwayWithSkills | null;
  onViewPathway: (id: number) => void;
}) {
  const hasInsufficientData = pathways.length === 0;
  const interestEntries = state.interestDeclaration ? Object.entries(state.interestDeclaration) : [];
  const topPathways = pathways.slice(0, 3);

  const getRecommendationReason = (pathway: CareerPathway): string => {
    if (interestEntries.length === 0) return 'Explore to discover your fit';
    const matchCount = interestEntries.filter(([, value]) =>
      pathway.pathwayName.toLowerCase().includes(String(value).toLowerCase()) ||
      pathway.category?.toLowerCase().includes(String(value).toLowerCase())
    ).length;
    if (matchCount > 0) return `Matches ${matchCount} of your interest signals`;
    return 'Explore to discover your fit';
  };

  return (
    <div className="space-y-5">
      {hasInsufficientData ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <Map className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Keep exploring</h3>
          <p className="mt-1 max-w-md mx-auto text-sm text-slate-500">
            Your career profile will become clearer as you complete more activities. Continue exploring to unlock personalized pathway suggestions.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Map className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Pathway Seeker</h2>
                <p className="text-sm text-slate-500">Discover career pathways that match your interests and skills.</p>
              </div>
            </div>

            {interestEntries.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Your Signals</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {interestEntries.map(([key, value]) => (
                    <span key={key} className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                      {String(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Suggested Pathways</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topPathways.map((pathway) => (
                  <button
                    key={pathway.id}
                    type="button"
                    onClick={() => onViewPathway(pathway.id)}
                    className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:shadow-md"
                  >
                    <p className="text-sm font-semibold text-slate-900">{pathway.pathwayName}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{pathway.description}</p>
                    {pathway.category && (
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {pathway.category}
                      </span>
                    )}
                    {pathway.riasecCodes && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pathway.riasecCodes.split(',').map((code) => (
                          <span key={code.trim()} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {code.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-500">{getRecommendationReason(pathway)}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-indigo-600">
                      <ChevronRight className="h-3 w-3" />
                      Explore pathway
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {selectedPathway && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-500 uppercase">Pathway Skills Progress</h3>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{selectedPathway.pathway.pathwayName}</span>
                <span className="text-sm font-bold text-slate-900">{selectedPathway.masteredCount} / {selectedPathway.totalCount} skills</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(selectedPathway.progressPercentage, 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{selectedPathway.progressPercentage}% complete</p>

              <div className="mt-4 space-y-2">
                {selectedPathway.skills.map((skill) => {
                  const progress = selectedPathway.studentProgress.find((p) => p.skillId === skill.id);
                  const mastered = progress?.masteryState === 'mastered';
                  return (
                    <div key={skill.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{skill.skillLabel}</p>
                        <p className="text-xs text-slate-500">{skill.description}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${mastered ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {mastered ? 'Mastered' : 'Not started'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CareerBuilderStage({
  state,
  pathways,
  selectedPathway,
  onViewPathway,
}: {
  state: CareerQuestState;
  pathways: CareerPathway[];
  selectedPathway: PathwayWithSkills | null;
  onViewPathway: (id: number) => void;
}) {
  const primaryPathway = state.primaryPathwayId ? pathways.find((p) => p.id === state.primaryPathwayId) : null;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Career Builder</h2>
            <p className="text-sm text-slate-500">Build your career pathway report and prepare for the future.</p>
          </div>
        </div>

        {primaryPathway ? (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Selected Pathway</h3>
            <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-indigo-900">{primaryPathway.pathwayName}</p>
              <p className="mt-1 text-xs text-indigo-700">{primaryPathway.description}</p>
              {primaryPathway.category && (
                <span className="mt-2 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                  {primaryPathway.category}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Select a Pathway</h3>
            <p className="mt-1 text-xs text-slate-500">Choose a career pathway to build your preparation plan.</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {pathways.slice(0, 4).map((pathway) => (
                <button
                  key={pathway.id}
                  type="button"
                  onClick={() => onViewPathway(pathway.id)}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-slate-900">{pathway.pathwayName}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{pathway.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPathway && (
          <div className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Skills Progress</h3>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{selectedPathway.pathway.pathwayName}</span>
              <span className="text-sm font-bold text-slate-900">{selectedPathway.masteredCount} / {selectedPathway.totalCount} skills</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(selectedPathway.progressPercentage, 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{selectedPathway.progressPercentage}% complete</p>

            <div className="mt-4 space-y-2">
              {selectedPathway.skills.map((skill) => {
                const progress = selectedPathway.studentProgress.find((p) => p.skillId === skill.id);
                const mastered = progress?.masteryState === 'mastered';
                return (
                  <div key={skill.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{skill.skillLabel}</p>
                      <p className="text-xs text-slate-500">{skill.description}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${mastered ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {mastered ? 'Mastered' : 'Not started'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              <p className="text-sm font-semibold text-slate-800">Subject Recommendations</p>
            </div>
            <p className="mt-1 text-xs text-slate-600">Subjects aligned with your selected pathway.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-indigo-600" />
              <p className="text-sm font-semibold text-slate-800">NSQF Progress</p>
            </div>
            <p className="mt-1 text-xs text-slate-600">Track your vocational skill certifications.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
