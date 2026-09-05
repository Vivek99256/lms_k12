'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CircleAlert, Compass, LoaderCircle, RefreshCw, RotateCcw, Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { loadInterestQuestions, loadInterestResults } from '../../_lib/api';
import type { RiasecQuestion, RiasecResultItem } from '../../_lib/types';
import { IntroBanner } from './IntroBanner';
import { QuizPanel } from './QuizPanel';
import { RiasecDoughnutChart } from './RiasecDoughnutChart';
import { RiasecResultModal } from './RiasecResultModal';
import { getAreaMeta } from './riasecMeta';

const TOTAL_STEPS = 6;

const INTRO_STEPS = [
  {
    title: 'Welcome to the RIASEC Interest Profiler',
    body: [
      'The Interest Profiler helps you find out what your interests are and how they relate to the world of work. You get to decide what you like to do.',
      'It helps you find out what kinds of careers you might want to explore.',
    ],
  },
  {
    title: "Here's how it works",
    body: [
      'The Interest Profile has 60 questions about work activities that some people do on their jobs.',
      'Read each question carefully and decide how you would feel about doing each type of work.',
    ],
  },
  {
    title: 'As you answer the questions',
    body: [
      "Try not to think about whether you have enough education or training to do the work, or how much money you would make doing it.",
      'Just think about whether you would like or dislike doing the work.',
    ],
  },
  {
    title: 'There are no right or wrong answers',
    body: [
      'Please take your time answering the questions — there is no need to rush. You are learning about your interests, so you can explore work you might find rewarding.',
      'Answer each question in order before continuing. You can change your answers at any time using the Back button.',
    ],
  },
] as const;

function encodeAnswers(selectedOptions: Record<number, number>, questionCount: number): string {
  const answeredIndexes = Object.keys(selectedOptions).map(Number);
  if (!answeredIndexes.length) return '';
  const lastAnsweredIndex = Math.max(...answeredIndexes);
  const digits: string[] = [];
  for (let i = 0; i <= lastAnsweredIndex && i < questionCount; i++) {
    digits.push(selectedOptions[i] !== undefined ? String(selectedOptions[i] + 1) : '');
  }
  return digits.join('');
}

function decodeAnswers(answers: string): Record<number, number> {
  const restored: Record<number, number> = {};
  Array.from(answers).forEach((digitChar, index) => {
    restored[index] = Number(digitChar) - 1;
  });
  return restored;
}

function CenterMessage({
  title, description, retry,
}: { title: string; description?: string; retry: () => void }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
      <CircleAlert className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      <Button variant="outline" size="sm" className="mt-1" onClick={retry}><RefreshCw />Try again</Button>
    </div>
  );
}

function ScoreTile({ item, onClick }: { item: RiasecResultItem; maxScore: number; onClick: () => void }) {
  const meta = getAreaMeta(item.area);
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50"
    >
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.area}</p>
        <p className="text-xs text-muted-foreground">Tap to learn more</p>
      </div>
      <p className="text-xl font-semibold">{item.score}</p>
    </button>
  );
}

export function KnowingYourselfHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const answers = searchParams.get('answers') ?? '';

  const [step, setStep] = useState<number>(1); // 1-4 intro, 5 quiz, 6 results
  const [questions, setQuestions] = useState<RiasecQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});

  const [result, setResult] = useState<RiasecResultItem[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [activeItem, setActiveItem] = useState<RiasecResultItem | null>(null);

  useEffect(() => {
    // Deep-link / resume: a shared or bookmarked URL with ?answers= jumps
    // straight to the results step, same as the source app's query-param
    // driven navigation.
    if (answers) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOptions(decodeAnswers(answers));
      setStep(TOTAL_STEPS);
    }
    // Only run this once on mount for the initial URL — later answers
    // changes are driven by handleSubmit below, not by re-reading the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    setQuestionsError('');
    try {
      const data = await loadInterestQuestions();
      setQuestions(data);
    } catch {
      setQuestionsError('Could not load the interest profile questions.');
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshQuestions();
  }, [refreshQuestions]);

  const refreshResults = useCallback(async (currentAnswers: string) => {
    if (!currentAnswers) return;
    setResultsLoading(true);
    setResultsError('');
    try {
      const data = await loadInterestResults(currentAnswers);
      setResult(data);
    } catch {
      setResultsError('Could not load your interest profile results.');
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === TOTAL_STEPS && answers) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refreshResults(answers);
    }
  }, [step, answers, refreshResults]);

  const introStep = useMemo(() => INTRO_STEPS[Math.min(step, 4) - 1], [step]);

  const topArea = useMemo(() => {
    if (!result?.length) return null;
    return result.reduce((best, item) => (item.score > best.score ? item : best), result[0]);
  }, [result]);

  const maxScore = useMemo(
    () => (result?.length ? Math.max(...result.map((item) => item.score)) : 0),
    [result]
  );

  const handleSelect = (questionIdx: number, emojiIdx: number) => {
    setSelectedOptions((prev) => ({ ...prev, [questionIdx]: emojiIdx }));
  };

  const handleSubmit = () => {
    const nextAnswers = encodeAnswers(selectedOptions, questions.length);
    router.replace(`${pathname}?answers=${nextAnswers}`);
    setStep(TOTAL_STEPS);
  };

  const handleRetake = () => {
    router.replace(pathname);
    setSelectedOptions({});
    setResult(null);
    setStep(1);
  };

  return (
    <div className="space-y-5 p-1 md:p-2">
      <header className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Compass className="size-4" />
              Career counselling
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Knowing yourself</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              The RIASEC Interest Profiler helps you find out what your interests are and how they
              relate to the world of work.
            </p>
          </div>
          <Badge variant="secondary">Step {step} of {TOTAL_STEPS}</Badge>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[#4F46E5] transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      {step <= 4 && <IntroBanner />}

      {step <= 4 && (
        <Card>
          <CardHeader>
            <CardTitle>{introStep.title}</CardTitle>
            <CardDescription>Step {step} of 4</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {introStep.body.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </CardContent>
          <CardFooter className="flex justify-between bg-transparent p-0 px-(--card-spacing) pb-(--card-spacing)">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep((current) => Math.max(1, current - 1))}
            >
              Back
            </Button>
            <Button type="button" onClick={() => setStep((current) => Math.min(5, current + 1))}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Answer all 60 questions</CardTitle>
            <CardDescription>
              Select how you would feel about doing each type of work, from strongly dislike to strongly like.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {questionsLoading ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Loading questions…
              </div>
            ) : questionsError ? (
              <CenterMessage title="Unable to load questions" description={questionsError} retry={() => void refreshQuestions()} />
            ) : (
              <QuizPanel
                questions={questions}
                selectedOptions={selectedOptions}
                onSelect={handleSelect}
                onSubmit={handleSubmit}
                onBack={() => setStep(4)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {step === TOTAL_STEPS && (
        <>
          {resultsLoading ? (
            <Card>
              <CardContent className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Loading your results…
              </CardContent>
            </Card>
          ) : resultsError ? (
            <Card>
              <CardContent>
                <CenterMessage title="Unable to load your results" description={resultsError} retry={() => void refreshResults(answers)} />
              </CardContent>
            </Card>
          ) : (
            <>
              {topArea && (
                <Card className="border-indigo-200 bg-indigo-50/60">
                  <CardContent className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[#4F46E5]">
                      <Trophy className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your strongest interest area</p>
                      <p className="text-lg font-semibold text-[#4F46E5]">{topArea.area}</p>
                      <p className="text-sm text-muted-foreground">Score {topArea.score} — tap any area below to learn what it means.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Your RIASEC interest profile</CardTitle>
                  <CardDescription>
                    Your interests are the work you like to do. The more a career meets your interests,
                    the more likely it is to be satisfying and rewarding to you.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr] lg:items-center">
                    <div className="mx-auto w-full max-w-[220px]">
                      <RiasecDoughnutChart result={result ?? []} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(result ?? []).map((item) => (
                        <ScoreTile key={item.area} item={item} maxScore={maxScore} onClick={() => setActiveItem(item)} />
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-between bg-transparent px-(--card-spacing) pb-(--card-spacing)">
                  <Button type="button" variant="outline" onClick={() => setStep(5)}>
                    Back to quiz
                  </Button>
                  <Button type="button" variant="outline" onClick={handleRetake}>
                    <RotateCcw />
                    Retake assessment
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}
        </>
      )}

      <RiasecResultModal item={activeItem} onOpenChange={(open) => !open && setActiveItem(null)} />
    </div>
  );
}
