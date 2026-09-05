'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Compass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { loadInterestQuestions, loadInterestResults } from '../../_lib/api';
import type { RiasecQuestion, RiasecResultItem } from '../../_lib/types';
import { IntroBanner } from './IntroBanner';
import { QuizPanel } from './QuizPanel';
import { RIASEC_COLORS, RiasecDoughnutChart } from './RiasecDoughnutChart';
import { RiasecResultModal } from './RiasecResultModal';

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
      setQuestionsError('Could not load the interest profile questions. Please try again.');
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
      setResultsError('Could not load your interest profile results. Please try again.');
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
              The RISEC Interest Profiler helps you find out what your interests are and how they
              relate to the world of work.
            </p>
          </div>
          <Badge variant="secondary">Step {step} of {TOTAL_STEPS}</Badge>
        </div>
      </header>

      <IntroBanner />

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
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Loading questions…
              </div>
            ) : questionsError ? (
              <p className="py-10 text-center text-sm text-destructive">{questionsError}</p>
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
        <Card>
          <CardHeader>
            <CardTitle>Here are your Interest Profiler results</CardTitle>
            <CardDescription>
              Click any interest area below to learn more about what it means.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resultsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Loading your results…
              </div>
            ) : resultsError ? (
              <p className="py-10 text-center text-sm text-destructive">{resultsError}</p>
            ) : (
              <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
                <div className="mx-auto w-full max-w-[220px] sm:mx-0">
                  <RiasecDoughnutChart result={result ?? []} />
                </div>
                <ul className="flex-1 divide-y">
                  {(result ?? []).map((item, index) => (
                    <li key={item.area} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left text-primary underline-offset-4 hover:underline"
                        onClick={() => setActiveItem(item)}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: RIASEC_COLORS[index] }}
                        />
                        {item.area}
                      </button>
                      <span className="font-semibold">{item.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between bg-transparent px-(--card-spacing) pb-(--card-spacing)">
            <Button type="button" variant="outline" onClick={() => setStep(5)}>
              Back to quiz
            </Button>
            <Button type="button" variant="outline" onClick={handleRetake}>
              Retake assessment
            </Button>
          </CardFooter>
        </Card>
      )}

      <RiasecResultModal item={activeItem} onOpenChange={(open) => !open && setActiveItem(null)} />
    </div>
  );
}
