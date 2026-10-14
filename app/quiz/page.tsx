'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, BookOpen, CheckCircle2, Clock, Loader2, Plus } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import {
  buildSessionContext,
  fetchQuizList,
  isStudentRole,
  type QuizSummary,
} from './_lib/quiz-api';

/**
 * Quizzes landing screen.
 *
 * Previously always rendered `ComingSoonPanel` regardless of data. Now backed
 * by `GET /api/quiz` (QuizAttemptApiController@index), which branches
 * teacher vs student server-side. A teacher sees the quizzes they published,
 * with live attempt counts; a student sees quizzes open to their class, with
 * their own last score if they have already taken one.
 */
export default function QuizPage() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStudent, setIsStudent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsStudent(isStudentRole());

    async function load() {
      try {
        const session = buildSessionContext();
        const data = await fetchQuizList(session);
        if (!cancelled) setQuizzes(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load quizzes. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quizzes</h1>
            <p className="text-sm text-gray-500">
              {isStudent ? 'Quizzes your teachers have published for your class.' : 'Quizzes you have published.'}
            </p>
          </div>
          {!isStudent && (
            <Link href="/quiz/create" className={buttonVariants()}>
              <Plus size={16} className="mr-1" /> Create a quiz
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /> Loading quizzes...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={16} /> {error}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
            <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {isStudent ? 'No quizzes have been published for your class yet.' : "You haven't published a quiz yet."}
            </p>
            {!isStudent && (
              <Link href="/quiz/create" className={buttonVariants({ className: 'mt-4 inline-flex' })}>
                <Plus size={16} className="mr-1" /> Create your first quiz
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                  <p className="text-sm text-gray-500">
                    {quiz.subjectName} {quiz.standardName ? `· ${quiz.standardName}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <BookOpen size={14} /> {quiz.totalQuestions} questions
                  </span>
                  {quiz.timeAllowed ? (
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> {quiz.timeAllowed} min
                    </span>
                  ) : null}
                </div>

                {isStudent ? (
                  quiz.myAttemptStatus === 'completed' ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-emerald-700 text-sm font-semibold">
                        <CheckCircle2 size={16} /> Scored {quiz.myScore}/{quiz.myMaxMarks}
                      </span>
                      <Link
                        href={`/quiz/take?id=${quiz.id}&attempt=${quiz.myAttemptId ?? ''}`}
                        className={buttonVariants({ variant: 'outline', className: 'text-sm' })}
                      >
                        Review
                      </Link>
                    </div>
                  ) : (
                    <Link href={`/quiz/take?id=${quiz.id}`} className={buttonVariants({ className: 'w-full' })}>
                      {quiz.myAttemptStatus === 'in_progress' ? 'Resume quiz' : 'Start quiz'}
                    </Link>
                  )
                ) : (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">
                      {quiz.attemptCount ?? 0} attempt{(quiz.attemptCount ?? 0) === 1 ? '' : 's'}
                      {quiz.avgScore != null ? ` · avg ${quiz.avgScore.toFixed(1)}` : ''}
                    </span>
                    <Link href={`/quiz/take?id=${quiz.id}`} className={buttonVariants({ variant: 'outline', className: 'text-sm' })}>
                      Preview
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
