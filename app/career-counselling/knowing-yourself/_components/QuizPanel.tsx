'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { RiasecQuestion } from '../../_lib/types';

const EMOJIS = [
  { src: '/images/career-counselling/knowing-yourself/Cold-face.png', label: 'Strongly dislike' },
  { src: '/images/career-counselling/knowing-yourself/Hot-face.png', label: 'Dislike' },
  { src: '/images/career-counselling/knowing-yourself/Diagonal-mouth.png', label: 'Unsure' },
  { src: '/images/career-counselling/knowing-yourself/Heart-eyes.png', label: 'Like' },
  { src: '/images/career-counselling/knowing-yourself/Rofl.png', label: 'Strongly like' },
] as const;

const EMOJI_TONES = [
  'border-destructive/40 bg-destructive/10 data-[selected=true]:bg-destructive/20',
  'border-warning/40 bg-warning/10 data-[selected=true]:bg-warning/20',
  'border-border bg-muted data-[selected=true]:bg-muted-foreground/20',
  'border-primary/40 bg-primary/10 data-[selected=true]:bg-primary/20',
  'border-success/40 bg-success/10 data-[selected=true]:bg-success/20',
];

interface QuizPanelProps {
  questions: RiasecQuestion[];
  selectedOptions: Record<number, number>;
  onSelect: (questionIdx: number, emojiIdx: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function QuizPanel({ questions, selectedOptions, onSelect, onSubmit, onBack }: QuizPanelProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const answeredCount = Object.keys(selectedOptions).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;

  const handleSelect = (questionIdx: number, emojiIdx: number) => {
    onSelect(questionIdx, emojiIdx);
    if (questionIdx === currentQuestion && currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex flex-1 items-center gap-3">
          <span className="text-muted-foreground">Progress</span>
          <Progress value={progress} className="max-w-xs" />
        </div>
        <span className="whitespace-nowrap font-medium">
          {answeredCount} of {questions.length} questions
        </span>
      </div>

      {/* Desktop: full question table */}
      <div className="hidden overflow-y-auto rounded-lg border sm:block sm:max-h-[420px]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-card">
            <tr>
              <th className="border-b px-4 py-3 text-left font-medium text-muted-foreground">
                Select your answer
              </th>
              {EMOJIS.map((emoji) => (
                <th key={emoji.label} className="border-b px-2 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={emoji.src} alt={emoji.label} title={emoji.label} className="mx-auto w-8" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questions.map((question, questionIdx) => {
              const isLocked = questionIdx > currentQuestion;
              return (
                <tr key={questionIdx} className={isLocked ? 'opacity-40' : undefined}>
                  <td className="border-b bg-muted/40 px-4 py-2">
                    {questionIdx + 1}. {question.text}
                  </td>
                  {EMOJIS.map((emoji, emojiIdx) => {
                    const isSelected = selectedOptions[questionIdx] === emojiIdx;
                    return (
                      <td
                        key={emoji.label}
                        data-selected={isSelected}
                        className={`border-b px-2 py-2 text-center ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${EMOJI_TONES[emojiIdx]}`}
                        onClick={() => !isLocked && handleSelect(questionIdx, emojiIdx)}
                      >
                        {isSelected ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src="/images/career-counselling/knowing-yourself/Vector.png"
                            alt="Selected"
                            className="mx-auto w-3.5"
                          />
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: one question at a time */}
      <div className="rounded-lg border p-4 text-center sm:hidden">
        {currentQuestion < questions.length ? (
          <>
            <p className="min-h-[3rem] font-medium">
              {currentQuestion + 1}. {questions[currentQuestion]?.text}
            </p>
            <div className="mt-6 flex justify-around">
              {EMOJIS.map((emoji, emojiIdx) => {
                const isSelected = selectedOptions[currentQuestion] === emojiIdx;
                return (
                  <button
                    key={emoji.label}
                    type="button"
                    data-selected={isSelected}
                    className={`rounded-lg border px-2 py-2 ${EMOJI_TONES[emojiIdx]}`}
                    onClick={() => onSelect(currentQuestion, emojiIdx)}
                    aria-label={emoji.label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={emoji.src} alt={emoji.label} className="w-8" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="font-medium text-muted-foreground">You have completed all the questions.</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion((step) => Math.max(0, step - 1))}
          >
            Previous
          </Button>
          {currentQuestion < questions.length - 1 && (
            <Button
              type="button"
              disabled={selectedOptions[currentQuestion] === undefined}
              onClick={() => setCurrentQuestion((step) => Math.min(questions.length - 1, step + 1))}
            >
              Next question
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={!allAnswered} onClick={onSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
}
