'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import {
  createFlashcards,
  h5pContextQuery,
  hasH5pContext,
  readH5pContext,
  type FlashcardInput,
} from '@/app/h5p/data/h5p';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '@/app/h5p/components/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Flashcard create form — mirrors Laravel `GET /h5p/h5p_flashacard/create`
 * (flashcard/create.blade.php): a card repeater posting `cards[N][field]`
 * to H5PFlashcardController@store.
 */

interface CardErrors {
  question?: string;
  correct_answer?: string;
}

function emptyCard(): FlashcardInput {
  return { question: '', content: '', correct_answer: '', hint: '' };
}

function FlashcardCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  const [cards, setCards] = useState<FlashcardInput[]>([emptyCard()]);
  const [errors, setErrors] = useState<Record<number, CardErrors>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const contextQuery = h5pContextQuery(ctx);

  const updateCard = (index: number, patch: Partial<FlashcardInput>) => {
    setCards((prev) => prev.map((card, i) => (i === index ? { ...card, ...patch } : card)));
    setErrors((prev) => {
      const cardErrors = prev[index];
      if (!cardErrors) return prev;
      const next = { ...cardErrors };
      if (patch.question !== undefined) delete next.question;
      if (patch.correct_answer !== undefined) delete next.correct_answer;
      return { ...prev, [index]: next };
    });
  };

  const addCardAfter = (index: number) => {
    setCards((prev) => [...prev.slice(0, index + 1), emptyCard(), ...prev.slice(index + 1)]);
    setErrors({});
  };

  const removeCard = (index: number) => {
    setCards((prev) => prev.filter((_, i) => i !== index));
    setErrors({});
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const nextErrors: Record<number, CardErrors> = {};
    cards.forEach((card, index) => {
      const cardErrors: CardErrors = {};
      if (!card.question.trim()) cardErrors.question = 'Question is required.';
      if (!card.correct_answer.trim()) cardErrors.correct_answer = 'Correct answer is required.';
      if (Object.keys(cardErrors).length > 0) nextErrors[index] = cardErrors;
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setError('Please fill in the required fields on every card.');
      return;
    }

    setErrors({});
    setError('');
    setSaving(true);
    try {
      const result = await createFlashcards(ctx, cards);
      router.push('/h5p/h5p_flashacard?' + h5pContextQuery(ctx, { flash: result.message }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create flashcards');
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Add flash cards"
          description="Create one or more flash cards for this chapter"
          ctx={ctx}
          backHref={`/h5p/h5p_flashacard?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            <form onSubmit={(event) => void handleSubmit(event)} noValidate>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="space-y-4">
                  {cards.map((card, index) => {
                    const cardErrors = errors[index] ?? {};
                    return (
                      <div key={index} className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Card {index + 1}</p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => addCardAfter(index)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-[#4f46e5] transition hover:bg-indigo-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add card
                            </button>
                            {cards.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeCard(index)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove card ${index + 1}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label htmlFor={`card-${index}-question`} className="text-slate-700">
                              Question <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              id={`card-${index}-question`}
                              rows={3}
                              value={card.question}
                              onChange={(event) => updateCard(index, { question: event.target.value })}
                              placeholder="Enter the question shown under the card"
                              aria-invalid={cardErrors.question ? true : undefined}
                            />
                            {cardErrors.question ? (
                              <p className="text-xs text-red-600">{cardErrors.question}</p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`card-${index}-content`} className="text-slate-700">
                              Content / Explanation
                            </Label>
                            <Textarea
                              id={`card-${index}-content`}
                              rows={5}
                              value={card.content}
                              onChange={(event) => updateCard(index, { content: event.target.value })}
                              placeholder="Card body shown to the learner"
                            />
                            <p className="text-xs text-slate-400">Rich HTML supported</p>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor={`card-${index}-answer`} className="text-slate-700">
                                Correct Answer <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`card-${index}-answer`}
                                value={card.correct_answer}
                                onChange={(event) => updateCard(index, { correct_answer: event.target.value })}
                                placeholder="Expected answer"
                                aria-invalid={cardErrors.correct_answer ? true : undefined}
                              />
                              {cardErrors.correct_answer ? (
                                <p className="text-xs text-red-600">{cardErrors.correct_answer}</p>
                              ) : null}
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor={`card-${index}-hint`} className="text-slate-700">
                                Hint
                              </Label>
                              <Input
                                id={`card-${index}-hint`}
                                value={card.hint}
                                onChange={(event) => updateCard(index, { hint: event.target.value })}
                                placeholder="Optional hint for the learner"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save Cards'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function FlashcardCreatePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <FlashcardCreateContent />
    </Suspense>
  );
}
