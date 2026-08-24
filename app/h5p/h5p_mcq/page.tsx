'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardList,
  Flag,
  HelpCircle,
  Hourglass,
  Layers,
  Loader2,
  Printer,
  RotateCcw,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import {
  fetchMcqIndex,
  getUserIdentity,
  h5pContextQuery,
  hasH5pContext,
<<<<<<< HEAD
=======
  postH5pXapiStatement,
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  readH5pContext,
  type H5pContext,
  type McqAnswer,
  type McqLevel,
  type McqQuestion,
} from '../data/h5p';
import {
  EmptyState,
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../components/shared';

/**
 * MCQ quiz — mirrors Laravel `GET /h5p/h5p_mcq`
 * (H5PMCQController@index + resources/views/lms/h5p/mcq/index|create.blade.php):
 * a difficulty-level picker, a one-question-at-a-time player with stats and
 * keyboard navigation, and a fully client-side results view with an answer
 * review modal and a printable certificate. Nothing is submitted to the server.
 */

// ---------------------------------------------------------------------------
// Scoring helpers (client-side, exactly like the Blade JS)
// ---------------------------------------------------------------------------

function isCorrectOption(answer: McqAnswer): boolean {
  return Number(answer.correct_answer) === 1;
}

function findCorrectAnswer(options: McqAnswer[] | undefined): McqAnswer | undefined {
  return options?.find(isCorrectOption);
}

/** Score circle color band: >=80 green, >=60 amber, >=40 teal, else red. */
function scoreBandClass(percentage: number): string {
  if (percentage >= 80) return 'bg-gradient-to-br from-emerald-500 to-teal-500';
  if (percentage >= 60) return 'bg-gradient-to-br from-amber-400 to-orange-500';
  if (percentage >= 40) return 'bg-gradient-to-br from-teal-500 to-cyan-600';
  return 'bg-gradient-to-br from-red-500 to-rose-600';
}

/** Certificate copy mirroring the Blade `getCertificateMessage` bands. */
function certificateMessage(
  percentage: number,
  studentName: string,
  standard: string,
  chapter: string
): string {
  const name = studentName || 'Student';
  const where = `${standard || 'this standard'} (Chapter: ${chapter || 'this chapter'})`;
  if (percentage >= 90) {
    return `This is to certify that ${name} has demonstrated exceptional performance in ${where}. With an outstanding score of ${percentage}%, the student has shown mastery of the subject matter and excellent comprehension skills.`;
  }
  if (percentage >= 75) {
    return `This is to certify that ${name} has successfully completed the Knowledge Quiz Challenge for ${where} and passed with distinction. Achieving ${percentage}%, the student has shown strong understanding and commendable performance.`;
  }
  if (percentage >= 60) {
    return `This is to certify that ${name} has successfully completed the Knowledge Quiz Challenge for ${where} in good standing. Scoring ${percentage}%, the student has demonstrated satisfactory knowledge and understanding.`;
  }
  if (percentage >= 40) {
    return `This is to certify that ${name} has participated in and completed the Knowledge Quiz Challenge for ${where}. Achieving ${percentage}%, the student has shown basic understanding of the concepts.`;
  }
  return `This is to certify that ${name} has participated in the Knowledge Quiz Challenge for ${where}. With ${percentage}%, we encourage the student to review the material and try again to improve their understanding.`;
}

function resolveSchoolLogoUrl(logo: string): string {
  const trimmed = logo.trim();
  if (!trimmed || trimmed === 'null') return '';
  if (trimmed.startsWith('http')) return trimmed;
  return `${API_BASE_URL}/admin_dep/images/${trimmed}`;
}

interface UserIdentity {
  name: string;
  schoolName: string;
  schoolLogo: string;
}

// ---------------------------------------------------------------------------
// Stage 1 — level picker
// ---------------------------------------------------------------------------

function LevelPicker({
  levels,
  startingLevelId,
  onStart,
}: {
  levels: McqLevel[];
  startingLevelId: number | null;
  onStart: (level: McqLevel) => void;
}) {
  if (levels.length === 0) {
    return (
      <EmptyState
        title="No MCQ levels available"
        hint="No difficulty levels are configured for multiple choice questions yet."
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Choose your path</h2>
        <p className="text-sm text-slate-500">Select your preferred MCQ level and start</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map((level, index) => (
          <div
            key={level.id}
            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-base font-bold text-[#4f46e5]">
                {level.name ? level.name.charAt(0).toUpperCase() : <HelpCircle className="h-5 w-5" />}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="mt-4 flex-1 text-base font-semibold text-slate-900">{level.name}</h3>
            <button
              type="button"
              onClick={() => onStart(level)}
              disabled={startingLevelId !== null}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startingLevelId === level.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Start
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 2 — quiz player
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof HelpCircle;
  value: number;
  label: string;
}) {
  return (
    <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className="flex items-center justify-center gap-2">
        <Icon className="h-5 w-5 text-[#4f46e5]" />
        <span className="text-2xl font-bold text-slate-900">{value}</span>
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function QuizPlayer({
  questions,
  answersByQuestion,
  currentIndex,
  userAnswers,
  onSelect,
  onNavigate,
  onEnd,
}: {
  questions: McqQuestion[];
  answersByQuestion: Record<string, McqAnswer[]>;
  currentIndex: number;
  userAnswers: Record<number, number>;
  onSelect: (questionId: number, answerId: number) => void;
  onNavigate: (index: number) => void;
  onEnd: () => void;
}) {
  const total = questions.length;
  const attempted = Object.keys(userAnswers).length;
  const remaining = Math.max(0, total - attempted);
  const progressPercent = total > 0 ? Math.round((attempted / total) * 100) : 0;
  const question = questions[currentIndex];
  const options = question ? answersByQuestion[String(question.question_id)] ?? [] : [];
  const isLast = currentIndex === total - 1;

  if (!question) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {/* Stats row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <StatCard icon={HelpCircle} value={total} label="Total Questions" />
        <StatCard icon={CheckCircle2} value={attempted} label="Attempted" />
        <StatCard icon={Hourglass} value={remaining} label="Remaining" />
      </div>

      {/* Progress */}
      <div className="mt-5">
        <p className="text-center text-sm font-medium text-slate-600">
          Question {currentIndex + 1} of {total}
        </p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#4f46e5] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mt-6 border-b-2 border-indigo-100 pb-4">
        <div
          className="text-lg font-semibold text-slate-900"
          // Question titles are stored with HTML entities/tags in the ERP DB.
          dangerouslySetInnerHTML={{ __html: question.question_text }}
        />
      </div>

      {/* Options */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Answer options">
        {options.map((option, index) => {
          const selected = userAnswers[question.question_id] === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(question.question_id, option.id)}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                selected
                  ? 'border-[#4f46e5] bg-[#4f46e5] text-white shadow-md'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-slate-100'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  selected ? 'bg-white text-[#4f46e5]' : 'bg-[#4f46e5] text-white'
                }`}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0" dangerouslySetInnerHTML={{ __html: option.answer }} />
            </button>
          );
        })}
        {options.length === 0 ? (
          <p className="text-sm text-slate-500 md:col-span-2">No answer options found for this question.</p>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            <Flag className="h-4 w-4" />
            End Quiz
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate(currentIndex + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca]"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-400">
        Tip: use the Left / Right arrow keys to move between questions.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review modal
// ---------------------------------------------------------------------------

function ReviewModal({
  questions,
  answersByQuestion,
  userAnswers,
  onClose,
}: {
  questions: McqQuestion[];
  answersByQuestion: Record<string, McqAnswer[]>;
  userAnswers: Record<number, number>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Answer review"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#4f46e5] px-5 py-4 text-white">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="h-5 w-5" />
            Answer Review
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 opacity-80 transition hover:bg-white/10 hover:opacity-100"
            aria-label="Close review"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {questions.map((question, index) => {
            const options = answersByQuestion[String(question.question_id)] ?? [];
            const correct = findCorrectAnswer(options);
            const userAnswerId = userAnswers[question.question_id];
            const userOption =
              userAnswerId !== undefined ? options.find((option) => option.id === userAnswerId) : undefined;
            const isCorrect =
              userAnswerId !== undefined && correct !== undefined && userAnswerId === correct.id;

            return (
              <div
                key={question.question_id}
                className={`rounded-xl border-l-4 p-4 ${
                  isCorrect ? 'border-emerald-500 bg-emerald-50/60' : 'border-red-500 bg-red-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm font-semibold text-slate-900">
                    <span className="mr-1">Question {index + 1}:</span>
                    <span dangerouslySetInnerHTML={{ __html: question.question_text }} />
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-slate-600">
                    <span className="font-semibold">Correct answer:</span>{' '}
                    {correct ? (
                      <span className="text-emerald-700" dangerouslySetInnerHTML={{ __html: correct.answer }} />
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-semibold">Your answer:</span>{' '}
                    {userOption ? (
                      <span
                        className={isCorrect ? 'text-emerald-700' : 'text-red-600'}
                        dangerouslySetInnerHTML={{ __html: userOption.answer }}
                      />
                    ) : (
                      <span className="text-slate-400">Not answered</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results + certificate
// ---------------------------------------------------------------------------

function ResultsView({
  ctx,
  questions,
  answersByQuestion,
  userAnswers,
  identity,
  onRetake,
  onChooseLevel,
}: {
  ctx: H5pContext;
  questions: McqQuestion[];
  answersByQuestion: Record<string, McqAnswer[]>;
  userAnswers: Record<number, number>;
  identity: UserIdentity;
  onRetake: () => void;
  onChooseLevel: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const total = questions.length;
  const points = useMemo(
    () =>
      questions.reduce((count, question) => {
        const correct = findCorrectAnswer(answersByQuestion[String(question.question_id)]);
        return correct !== undefined && userAnswers[question.question_id] === correct.id ? count + 1 : count;
      }, 0),
    [questions, answersByQuestion, userAnswers]
  );
  const percentage = total > 0 ? Math.round((points / total) * 100) : 0;

  const standardName = ctx.standard_name || (ctx.standard_id ? `Standard #${ctx.standard_id}` : '');
  const chapterName = ctx.chapter_name || (ctx.chapter_id ? `Chapter #${ctx.chapter_id}` : '');
  const message = certificateMessage(percentage, identity.name, standardName, chapterName);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const logoUrl = resolveSchoolLogoUrl(identity.schoolLogo);

  return (
    <div className="space-y-5">
      {/* Print only the certificate. */}
      <style>{`@media print { body * { visibility: hidden; } #mcq-certificate, #mcq-certificate * { visibility: visible; } #mcq-certificate { position: fixed; inset: 0; } }`}</style>

      {/* Score card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div
          className={`mx-auto flex h-36 w-36 items-center justify-center rounded-full text-white shadow-lg ${scoreBandClass(percentage)}`}
        >
          <span className="text-4xl font-bold">{percentage}%</span>
        </div>
        <h2 className="mt-5 flex items-center justify-center gap-2 text-lg font-semibold text-slate-900">
          <Trophy className="h-5 w-5 text-amber-500" />
          Quiz Results
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Total points: <span className="text-xl font-bold text-[#4f46e5]">{points}</span>
          <span className="text-slate-400"> / {total}</span>
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4 text-[#4f46e5]" />
            Review Answers
          </button>
          <button
            type="button"
            onClick={onRetake}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca]"
          >
            <RotateCcw className="h-4 w-4" />
            Take Quiz Again
          </button>
          <button
            type="button"
            onClick={onChooseLevel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Layers className="h-4 w-4 text-[#4f46e5]" />
            Choose another level
          </button>
        </div>
      </div>

      {/* Certificate */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div
          id="mcq-certificate"
          className="rounded-2xl border-4 border-double border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-6 text-center sm:p-8"
        >
          <div className="flex items-center justify-center gap-3 border-b-2 border-amber-200 pb-4">
            {logoUrl && !logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="School logo"
                className="h-14 w-auto object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : null}
            <p className="text-lg font-bold text-[#4f46e5]">{identity.schoolName || 'School Name'}</p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <Award className="h-6 w-6 text-amber-500" />
            <h3 className="text-xl font-bold uppercase tracking-widest text-amber-600">
              Certificate of Achievement
            </h3>
            <Award className="h-6 w-6 text-amber-500" />
          </div>
          <p className="mt-1 text-xs text-slate-400">{today}</p>

          <p className="mt-4 text-2xl font-bold uppercase tracking-wide text-[#4f46e5]">
            {identity.name || 'Student'}
          </p>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">{message}</p>

          <div className="mx-auto mt-5 inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-xl bg-[#4f46e5] px-6 py-4 text-white">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Standard</p>
              <p className="mt-0.5 text-sm font-bold">{standardName || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Chapter</p>
              <p className="mt-0.5 text-sm font-bold">{chapterName || '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Score</p>
              <p className="mt-0.5 text-sm font-bold">
                {points} / {total}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Percentage</p>
              <p className="mt-0.5 text-sm font-bold">{percentage}%</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-center border-t-2 border-dashed border-amber-200 pt-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Printer className="h-4 w-4" />
            Print certificate
          </button>
        </div>
      </div>

      {reviewOpen ? (
        <ReviewModal
          questions={questions}
          answersByQuestion={answersByQuestion}
          userAnswers={userAnswers}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type McqView = 'picker' | 'quiz' | 'results';

function McqContent() {
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  const [levels, setLevels] = useState<McqLevel[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [startingLevelId, setStartingLevelId] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<McqLevel | null>(null);
  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, McqAnswer[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [view, setView] = useState<McqView>('picker');
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState<UserIdentity>({ name: '', schoolName: '', schoolLogo: '' });

  // Session identity lives in localStorage — read it after mount only.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIdentity(getUserIdentity());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Stage 1 data: the difficulty levels.
  useEffect(() => {
    let cancelled = false;
    if (!hasH5pContext(ctx)) {
      queueMicrotask(() => {
        if (!cancelled) setLevelsLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) {
        setLevelsLoading(true);
        setError('');
      }
    });
    fetchMcqIndex(ctx)
      .then((payload) => {
        if (!cancelled) setLevels(payload.mcq_levels);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load MCQ levels');
      })
      .finally(() => {
        if (!cancelled) setLevelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  const backToPicker = useCallback(() => {
    setSelectedLevel(null);
    setQuestions([]);
    setAnswersByQuestion({});
    setUserAnswers({});
    setCurrentIndex(0);
    setView('picker');
  }, []);

  const startLevel = useCallback(
    (level: McqLevel) => {
      setStartingLevelId(level.id);
      setError('');
      fetchMcqIndex(ctx, String(level.id))
        .then((payload) => {
          setSelectedLevel(level);
          setQuestions(payload.question_arr);
          setAnswersByQuestion(payload.answer_arr);
          setUserAnswers({});
          setCurrentIndex(0);
          setView('quiz');
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to load quiz questions');
        })
        .finally(() => {
          setStartingLevelId(null);
        });
    },
    [ctx]
  );

<<<<<<< HEAD
  const selectAnswer = useCallback((questionId: number, answerId: number) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: answerId }));
  }, []);
=======
  const selectAnswer = useCallback(
    (questionId: number, answerId: number) => {
      setUserAnswers((prev) => ({ ...prev, [questionId]: answerId }));

      const correct = findCorrectAnswer(answersByQuestion[String(questionId)]);
      void postH5pXapiStatement({
        objectId: `multiple_choice:${questionId}`,
        verb: 'answered',
        ctx,
        success: correct !== undefined && correct.id === answerId,
      });
    },
    [answersByQuestion, ctx]
  );
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const navigateTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= questions.length) return;
      setCurrentIndex(index);
    },
    [questions.length]
  );

  const endQuiz = useCallback(() => {
    setView('results');
<<<<<<< HEAD
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
=======
    for (const questionId of Object.keys(userAnswers)) {
      void postH5pXapiStatement({ objectId: `multiple_choice:${questionId}`, verb: 'completed', ctx });
    }
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [userAnswers, ctx]);
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const retakeQuiz = useCallback(() => {
    setUserAnswers({});
    setCurrentIndex(0);
    setView('quiz');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Keyboard navigation while the quiz is being played (matches the Blade JS:
  // ArrowRight on the last question ends the quiz).
  useEffect(() => {
    if (view !== 'quiz' || questions.length === 0) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          endQuiz();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, currentIndex, questions.length, endQuiz]);

  const contextQuery = h5pContextQuery(ctx);
  const quizIsEmpty = selectedLevel !== null && questions.length === 0;

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Multiple choice questions"
          description={
            selectedLevel && view !== 'picker'
              ? `Level: ${selectedLevel.name}`
              : 'Pick a difficulty level and test your knowledge of this chapter'
          }
          ctx={ctx}
          backHref={`/h5p/html_contents?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {view === 'picker' ? (
              levelsLoading ? (
                <LoadingState label="Loading MCQ levels…" />
              ) : (
                <LevelPicker levels={levels} startingLevelId={startingLevelId} onStart={startLevel} />
              )
            ) : quizIsEmpty ? (
              <EmptyState
                title="No questions available for this level"
                hint="Try a different difficulty level for this chapter."
                action={
                  <button
                    type="button"
                    onClick={backToPicker}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca]"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Choose another level
                  </button>
                }
              />
            ) : view === 'quiz' ? (
              <QuizPlayer
                questions={questions}
                answersByQuestion={answersByQuestion}
                currentIndex={currentIndex}
                userAnswers={userAnswers}
                onSelect={selectAnswer}
                onNavigate={navigateTo}
                onEnd={endQuiz}
              />
            ) : (
              <ResultsView
                ctx={ctx}
                questions={questions}
                answersByQuestion={answersByQuestion}
                userAnswers={userAnswers}
                identity={identity}
                onRetake={retakeQuiz}
                onChooseLevel={backToPicker}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function McqPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading multiple choice questions…" />}>
      <McqContent />
    </Suspense>
  );
}
