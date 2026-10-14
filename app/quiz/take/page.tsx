'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Flag, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, X, Check, Loader2 } from 'lucide-react';

import {
  buildSessionContext,
  fetchAttemptResult,
  startQuizAttempt,
  submitQuizAttempt,
  type QuizAttemptResult,
  type QuizTakeQuestion,
} from '../_lib/quiz-api';

/**
 * Take-a-quiz screen.
 *
 * Previously a hardcoded 5-question object scored entirely client-side.
 * Now: `?id=<question_paper id>` starts (or resumes) a real attempt via
 * `POST /api/quiz/{id}/attempts`, answers are submitted to
 * `POST /api/quiz/attempts/{attemptId}/submit`, and the score shown is
 * exactly what that endpoint returns -- this component never decides who got
 * what right. `?attempt=<id>` instead opens a completed attempt read-only
 * (the "Review" link from the quiz list).
 */
export default function TakeQuizPage() {
  const searchParams = useSearchParams();
  const quizId = Number(searchParams.get('id') ?? 0);
  const reviewAttemptId = Number(searchParams.get('attempt') ?? 0) || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [timeAllowedMinutes, setTimeAllowedMinutes] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuizTakeQuestion[]>([]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!quizId && !reviewAttemptId) {
        setError('No quiz was specified.');
        setLoading(false);
        return;
      }

      try {
        const session = buildSessionContext();

        if (reviewAttemptId) {
          const data = await fetchAttemptResult(session, reviewAttemptId);
          if (cancelled) return;
          setResult(data);
          setQuizTitle(data.title ?? 'Quiz');
          return;
        }

        const started = await startQuizAttempt(session, quizId);
        if (cancelled) return;
        setAttemptId(started.attemptId);
        setQuizTitle(started.quiz.title);
        setQuestions(started.questions);
        setTimeAllowedMinutes(started.quiz.timeAllowed ?? null);
        if (started.quiz.timeAllowed) setTimeLeft(started.quiz.timeAllowed * 60);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this quiz. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, reviewAttemptId]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return;
    const timer = setInterval(() => setTimeLeft((prev) => (prev === null ? prev : prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, result]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length ? (answeredCount / questions.length) * 100 : 0;

  const handleOptionSelect = (optionId: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  };

  const toggleFlag = () => {
    if (!currentQuestion) return;
    setFlagged((prev) => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(currentQuestionIndex + 1);
  };
  const handlePrev = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(currentQuestionIndex - 1);
  };

  const handleSubmit = async () => {
    if (!attemptId) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = buildSessionContext();
      const data = await submitQuizAttempt(session, attemptId, answers);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit the quiz. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const timeTakenLabel = useMemo(() => {
    if (!timeAllowedMinutes || timeLeft === null) return null;
    return formatTime(timeAllowedMinutes * 60 - timeLeft);
  }, [timeAllowedMinutes, timeLeft]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-gray-500">
        <Loader2 size={18} className="animate-spin" /> Loading quiz...
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-xl mx-auto flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4">
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  if (result) {
    const percentage = result.percentage ?? 0;

    return (
      <div className="flex-1 overflow-y-auto w-full p-8">
        <main className="max-w-4xl mx-auto space-y-6 pb-24">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {result.status === 'completed' ? 'Assessment Complete' : quizTitle}
              </h2>
              <p className="text-gray-500">Review your answers below.</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl text-center min-w-[100px]">
                <div className="text-sm text-gray-500 mb-1">Score</div>
                <div className={`text-2xl font-bold ${percentage >= 60 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result.scoreMarks}/{result.maxMarks} ({percentage}%)
                </div>
              </div>
              {timeTakenLabel && (
                <div className="bg-gray-50 p-4 rounded-2xl text-center min-w-[100px]">
                  <div className="text-sm text-gray-500 mb-1">Time Taken</div>
                  <div className="text-2xl font-bold text-blue-600">{timeTakenLabel}</div>
                </div>
              )}
            </div>
          </div>

          {result.questions.map((q, qIndex) => {
            const isUnanswered = q.given.length === 0;

            return (
              <div key={q.id} className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-6">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Question {qIndex + 1}</span>
                  {isUnanswered ? (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">Unanswered</span>
                  ) : q.isCorrect ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircle2 size={14} /> Correct
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <AlertCircle size={14} /> Incorrect
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-6">{q.text}</h3>
                <div className="space-y-3">
                  {q.options.map((opt, oIndex) => {
                    const isSelected = q.given.includes(opt.id);
                    const letter = String.fromCharCode(65 + oIndex);

                    let style = 'border-gray-100 bg-white';
                    if (opt.isCorrect) style = 'border-emerald-500 bg-emerald-50';
                    else if (isSelected) style = 'border-red-500 bg-red-50';

                    return (
                      <div key={opt.id} className={`flex items-center p-4 rounded-2xl border-2 ${style}`}>
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm mr-4 ${
                            opt.isCorrect
                              ? 'bg-emerald-500 text-white'
                              : isSelected
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {opt.isCorrect ? <Check size={16} strokeWidth={3} /> : isSelected ? <X size={16} strokeWidth={3} /> : letter}
                        </div>
                        <span
                          className={`text-base font-medium ${
                            opt.isCorrect ? 'text-emerald-900' : isSelected ? 'text-red-900' : 'text-gray-700'
                          }`}
                        >
                          {opt.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </main>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-xl mx-auto text-sm text-gray-500">This quiz has no questions yet.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <main className="max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-full">
        <div className="lg:col-span-8 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex justify-between text-sm font-semibold text-gray-500 mb-2">
                <span>
                  {quizTitle} &middot; Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-[#0D6EFD]">{progressPercent.toFixed(0)}% Completed</span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0D6EFD] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            {timeLeft !== null && (
              <div className="ml-4 text-sm font-bold text-gray-600 shrink-0">{formatTime(Math.max(timeLeft, 0))}</div>
            )}
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 flex-1 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[4rem] -mr-10 -mt-10 pointer-events-none" />

            <div className="flex justify-between items-start mb-4 relative">
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-wider">
                Question {currentQuestionIndex + 1}
              </span>
              <button
                onClick={toggleFlag}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${flagged[currentQuestion.id] ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Flag size={16} className={flagged[currentQuestion.id] ? 'fill-orange-600' : ''} />
                {flagged[currentQuestion.id] ? 'Flagged' : 'Flag for review'}
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{currentQuestion.text}</h2>

            <div className="space-y-1 mb-auto">
              {currentQuestion.options.map((option, index) => {
                const isSelected = answers[currentQuestion.id] === option.id;
                const letter = String.fromCharCode(65 + index);

                return (
                  <div
                    key={option.id}
                    onClick={() => handleOptionSelect(option.id)}
                    className={`group flex items-center p-3 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 ${isSelected ? 'border-[#0D6EFD] bg-blue-50/50 shadow-md shadow-blue-500/10' : 'border-gray-100 hover:border-gray-300 bg-white'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs mr-5 transition-colors ${isSelected ? 'bg-[#0D6EFD] text-white shadow-inner' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}
                    >
                      {isSelected ? <Check size={20} strokeWidth={3} /> : letter}
                    </div>
                    <span className={`text-base font-medium transition-colors ${isSelected ? 'text-blue-900' : 'text-gray-700 group-hover:text-gray-900'}`}>
                      {option.text}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-3 pt-4 border-t border-gray-100">
              <button
                onClick={handlePrev}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} /> Previous
              </button>

              {currentQuestionIndex === questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-[#0D6EFD] text-white shadow-md shadow-blue-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-[#0D6EFD] text-white shadow-md shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
                >
                  Next <ChevronRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 sticky top-28">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Quiz Navigator</h3>

            <div className="grid grid-cols-5 gap-3 mb-8">
              {questions.map((q, index) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = currentQuestionIndex === index;
                const isFlagged = flagged[q.id];

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`
                      w-12 h-12 rounded-xl text-sm font-bold flex items-center justify-center relative transition-all duration-300
                      ${isCurrent ? 'ring-4 ring-blue-100 scale-110 z-10' : 'hover:bg-gray-100'}
                      ${isAnswered ? 'bg-[#0D6EFD] text-white shadow-sm' : 'bg-gray-50 text-gray-500 border border-gray-200'}
                      ${isCurrent && isAnswered ? 'bg-blue-700' : ''}
                    `}
                  >
                    {index + 1}
                    {isFlagged && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-4 h-4 rounded bg-[#0D6EFD]" /> Answered
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" /> Unanswered
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-4 h-4 rounded-full bg-orange-500" /> Flagged for Review
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
