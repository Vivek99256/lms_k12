'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  buildQuizStartQuery,
  fetchMisconceptions,
  fetchPalLanding,
  fetchPedagogySuggestedContent,
  generateMisconceptionContent,
  incrementContentVisit,
  type MisconceptionQuestion,
  type PalChapter,
  type PalChapterContext,
  type PalContentCategory,
  type PalLandingData,
  type PalSubject,
  type PedagogyContentItem,
  type PedagogyResult,
} from '@/app/pal/data/pal';

type ModalKind = 'pedagogy' | 'misconception';

interface ActiveModal {
  kind: ModalKind;
  context: PalChapterContext;
  chapterName: string;
  subjectName: string;
}

const CATEGORY_STYLES: Record<PalContentCategory, { label: string; badge: string }> = {
  remediation: { label: 'Remediation', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  practice: { label: 'Practice', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  enrichment: { label: 'Enrichment', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  misconception: { label: 'Misconception', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
};

export default function PalEntryPage() {
  const router = useRouter();
  const [data, setData] = useState<PalLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ActiveModal | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPalLanding(controller.signal);
        setData(result);
        // Expand the first subject by default for immediate context.
        if (result.subjects[0]) {
          setOpenSubjects({ [result.subjects[0].id]: true });
        }
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load PAL subjects.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const toggleSubject = (subjectId: string) =>
    setOpenSubjects((prev) => ({ ...prev, [subjectId]: !prev[subjectId] }));

  const chapterContext = useCallback(
    (chapter: PalChapter, subject: PalSubject): PalChapterContext => ({
      gradeId: data?.student.gradeId ?? '',
      subjectId: subject.id,
      chapterId: chapter.id,
      standardId: data?.student.standardId ?? '',
      enrollmentNo: data?.student.enrollmentNo,
    }),
    [data]
  );

  const startQuiz = (chapter: PalChapter, subject: PalSubject) => {
    router.push(`/pal/exam?${buildQuizStartQuery(chapterContext(chapter, subject))}`);
  };

  const openModal = (kind: ModalKind, chapter: PalChapter, subject: PalSubject) => {
    setModal({
      kind,
      context: chapterContext(chapter, subject),
      chapterName: chapter.name,
      subjectName: subject.name,
    });
  };

  const totalChapters = useMemo(
    () => data?.subjects.reduce((sum, subject) => sum + subject.chapters.length, 0) ?? 0,
    [data]
  );

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">PAL Subjects</h1>
              <p className="text-sm text-slate-500">
                Personalized Adaptive Learning &mdash; launch adaptive quizzes and review
                pedagogy insights per chapter.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            onClick={() => router.push('/pal/intelligence')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Intelligence
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading PAL subjects...
          </div>
        ) : !data || data.subjects.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-700">No PAL subjects found.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              PAL lists the signed-in student&rsquo;s subjects for the selected academic year. This
              is empty for staff/admin accounts, or for a student with no enrollment or PAL activity
              in this year.
            </p>
          </div>
        ) : (
          <>
            <div className="text-xs font-medium text-slate-500">
              {data.subjects.length} subject{data.subjects.length === 1 ? '' : 's'} &middot;{' '}
              {totalChapters} chapter{totalChapters === 1 ? '' : 's'}
            </div>
            <div className="space-y-3">
              {data.subjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  expanded={Boolean(openSubjects[subject.id])}
                  onToggle={() => toggleSubject(subject.id)}
                  attemptsByChapter={data.attemptsByChapter}
                  onStartQuiz={(chapter) => startQuiz(chapter, subject)}
                  onOpenModal={(kind, chapter) => openModal(kind, chapter, subject)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modal?.kind === 'pedagogy' && (
        <PedagogyModal modal={modal} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'misconception' && (
        <MisconceptionModal modal={modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subject / chapter accordion
// ---------------------------------------------------------------------------

function SubjectCard({
  subject,
  expanded,
  onToggle,
  attemptsByChapter,
  onStartQuiz,
  onOpenModal,
}: {
  subject: PalSubject;
  expanded: boolean;
  onToggle: () => void;
  attemptsByChapter: PalLandingData['attemptsByChapter'];
  onStartQuiz: (chapter: PalChapter) => void;
  onOpenModal: (kind: ModalKind, chapter: PalChapter) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <BookOpen className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">{subject.name}</span>
            <span className="block text-xs text-slate-500">
              {subject.chapters.length} chapter{subject.chapters.length === 1 ? '' : 's'}
            </span>
          </span>
        </span>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {subject.chapters.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">No chapters mapped for this subject.</p>
          ) : (
            subject.chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                attempts={attemptsByChapter[chapter.id] ?? []}
                onStartQuiz={() => onStartQuiz(chapter)}
                onOpenModal={(kind) => onOpenModal(kind, chapter)}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function ChapterRow({
  chapter,
  attempts,
  onStartQuiz,
  onOpenModal,
}: {
  chapter: PalChapter;
  attempts: PalLandingData['attemptsByChapter'][string];
  onStartQuiz: () => void;
  onOpenModal: (kind: ModalKind) => void;
}) {
  const hasAttempts = chapter.quizCount > 0;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">{chapter.name}</span>
            {hasAttempts && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {chapter.quizCount} quiz{chapter.quizCount === 1 ? '' : 'zes'}
              </span>
            )}
          </div>

          {attempts.length > 0 && (
            <div className="mt-3 space-y-2">
              {attempts.map((attempt, index) => (
                <div key={`${chapter.id}-${index}`} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs font-medium text-slate-500">
                    Quiz {attempts.length - index}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${attempt.percent}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-600">
                    {attempt.total > 0 ? `${attempt.totalRight}/${attempt.total}` : 'Not attempted'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {hasAttempts && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenModal('pedagogy')}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Suggested content
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenModal('misconception')}
                className="border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Misconception
              </Button>
            </>
          )}
          <Button size="sm" onClick={onStartQuiz}>
            <Play className="h-3.5 w-3.5" />
            {hasAttempts ? 'Next quiz' : 'Start quiz'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

function ModalShell({
  title,
  subtitle,
  icon,
  onClose,
  headerAction,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onClose: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              {icon}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  if (!level) return null;
  const normalized = level.toLowerCase();
  const style =
    normalized === 'hard'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : normalized === 'medium'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-sky-50 text-sky-700 border-sky-200';
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}>
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pedagogy Engine modal
// ---------------------------------------------------------------------------

function PedagogyModal({ modal, onClose }: { modal: ActiveModal; onClose: () => void }) {
  const [result, setResult] = useState<PedagogyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setResult(await fetchPedagogySuggestedContent(modal.context, controller.signal));
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load suggested content.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [modal.context]);

  const handleContentClick = (item: PedagogyContentItem) => {
    void incrementContentVisit({
      contentId: item.id,
      standardId: modal.context.standardId,
      subjectId: modal.context.subjectId,
      chapterId: modal.context.chapterId,
    });
  };

  const summary = result?.masterySummary;

  return (
    <ModalShell
      title="Pedagogy Engine"
      subtitle={`${modal.subjectName} · ${modal.chapterName}`}
      icon={<Sparkles className="h-5 w-5" />}
      onClose={onClose}
      headerAction={result?.studentLevel ? <LevelBadge level={result.studentLevel} /> : null}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analyzing your learning profile...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : !result ? null : (
        <div className="space-y-5">
          {(result.studentProfile.learningStyle ||
            result.studentProfile.learningPace ||
            result.studentProfile.preferredContentTypes.length > 0) && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Student profile
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.studentProfile.learningStyle && (
                  <ProfileChip label="Learning style" value={result.studentProfile.learningStyle} />
                )}
                {result.studentProfile.learningPace && (
                  <ProfileChip label="Pace" value={result.studentProfile.learningPace} />
                )}
                {result.studentProfile.preferredContentTypes.map((type) => (
                  <ProfileChip key={type} label="Prefers" value={type} />
                ))}
              </div>
            </section>
          )}

          {summary && summary.totalConcepts > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Mastery summary
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MasteryStat label="Mastered" value={summary.mastered} tone="emerald" />
                <MasteryStat label="Developing" value={summary.developing} tone="amber" />
                <MasteryStat label="Needs practice" value={summary.needsPractice} tone="rose" />
                <MasteryStat label="Not started" value={summary.dueForReview} tone="slate" />
              </div>
            </section>
          )}

          {result.recommendations.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Pedagogy recommendations
              </h3>
              <div className="space-y-2">
                {result.recommendations.map((rec, index) => (
                  <div
                    key={`${rec.label}-${index}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800">{rec.label}</span>
                      {rec.cognitiveLoad && (
                        <span className="text-[11px] font-medium text-slate-500">
                          {rec.cognitiveLoad}
                        </span>
                      )}
                    </div>
                    {rec.reason && <p className="mt-1 text-xs text-slate-600">{rec.reason}</p>}
                    {rec.tip && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-indigo-700">
                        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {rec.tip}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {result.teacherInsights.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Teacher insights
              </h3>
              <div className="space-y-2">
                {result.teacherInsights.map((insight, index) => (
                  <div
                    key={`${insight.title}-${index}`}
                    className={`rounded-lg border px-4 py-3 ${
                      insight.priority.toLowerCase() === 'high'
                        ? 'border-rose-200 bg-rose-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-800">{insight.title}</div>
                    {insight.description && (
                      <p className="mt-1 text-xs text-slate-600">{insight.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Suggested content
            </h3>
            {result.content.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No suggested content available for this chapter yet.
              </p>
            ) : (
              <div className="space-y-2">
                {result.content.map((item, index) => (
                  <PedagogyContentCard
                    key={`${item.category}-${item.id}-${index}`}
                    item={item}
                    onOpen={() => handleContentClick(item)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </ModalShell>
  );
}

function ProfileChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
      <span className="text-slate-400">{label}: </span>
      <span className="font-medium capitalize text-slate-700">{value}</span>
    </span>
  );
}

function MasteryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const toneStyles: Record<typeof tone, string> = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    slate: 'text-slate-700',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
      <div className={`text-lg font-bold ${toneStyles[tone]}`}>{value}</div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

function PedagogyContentCard({
  item,
  onOpen,
}: {
  item: PedagogyContentItem;
  onOpen: () => void;
}) {
  const category = CATEGORY_STYLES[item.category];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${category.badge}`}>
              {category.label}
            </span>
            {item.studentLevel && <LevelBadge level={item.studentLevel} />}
            {item.pedagogyType && (
              <span className="text-[11px] font-medium text-slate-500">{item.pedagogyType}</span>
            )}
          </div>
          <div className="mt-1.5 text-sm font-medium text-slate-900">{item.title || 'Untitled content'}</div>
          {item.description && <p className="mt-1 text-xs text-slate-600">{item.description}</p>}
          {item.learningTips.length > 0 && (
            <ul className="mt-2 space-y-1">
              {item.learningTips.map((tip, index) => (
                <li key={index} className="flex items-start gap-1 text-xs text-indigo-700">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
          {item.mapping.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.mapping.map((map, index) => (
                <span
                  key={index}
                  className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  title={map.typeName}
                >
                  {map.valueName || map.typeName}
                </span>
              ))}
            </div>
          )}
        </div>
        {item.contentUrl && (
          <a
            href={item.contentUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            Open
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misconception modal
// ---------------------------------------------------------------------------

function MisconceptionModal({ modal, onClose }: { modal: ActiveModal; onClose: () => void }) {
  const [questions, setQuestions] = useState<MisconceptionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        setQuestions(await fetchMisconceptions(modal.context.chapterId, signal));
      } catch (reason) {
        if (signal?.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load misconceptions.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [modal.context.chapterId]
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch loader, matches repo report pages
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setNotice(null);
    setError(null);
    try {
      const result = await generateMisconceptionContent(modal.context.chapterId);
      setNotice(
        result.message ||
          `Generated ${result.generated}, skipped ${result.skipped}.`
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to generate content.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ModalShell
      title="Misconceptions"
      subtitle={`${modal.subjectName} · ${modal.chapterName}`}
      icon={<AlertTriangle className="h-5 w-5" />}
      onClose={onClose}
      headerAction={
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || loading || questions.length === 0}
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Generate content
        </Button>
      }
    >
      {notice && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading misconceptions...
        </div>
      ) : questions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-500">
          <GraduationCap className="h-8 w-8 text-slate-300" />
          No wrong questions found for this chapter.
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((question) => (
            <div
              key={question.questionId}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="min-w-0 text-sm text-slate-800 [&_img]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: question.question }}
                />
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    {question.wrongCount} wrong
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      question.contentGenerated
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {question.contentGenerated ? 'Generated' : 'Pending'}
                  </span>
                </div>
              </div>
              {question.mapping.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {question.mapping.map((map, index) => (
                    <span
                      key={index}
                      className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                      title={map.typeName}
                    >
                      {map.typeName}: {map.valueName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
