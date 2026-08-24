'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import {
  fetchFlashcard,
  h5pContextQuery,
  hasH5pContext,
  readH5pContext,
  updateFlashcard,
  type FlashcardInput,
} from '@/app/h5p/data/h5p';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '@/app/h5p/components/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Flashcard edit form — mirrors Laravel `GET /h5p/h5p_flashacard/{id}/edit`
 * (flashcard/edit.blade.php): a single card posting `cards[0][field]` via
 * PUT to H5PFlashcardController@update.
 */

interface CardErrors {
  question?: string;
  correct_answer?: string;
}

function FlashcardEditContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const cardId = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  const [card, setCard] = useState<FlashcardInput>({ question: '', content: '', correct_answer: '', hint: '' });
  const [fieldErrors, setFieldErrors] = useState<CardErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const contextQuery = h5pContextQuery(ctx);

  useEffect(() => {
    if (!hasH5pContext(ctx) || !cardId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
    });
    fetchFlashcard(cardId, ctx)
      .then((loaded) => {
        if (cancelled) return;
        setCard({
          question: loaded.question ?? '',
          content: loaded.content ?? '',
          correct_answer: loaded.correct_answer ?? '',
          hint: loaded.hint ?? '',
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load flashcard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cardId, ctx]);

  const updateField = (patch: Partial<FlashcardInput>) => {
    setCard((prev) => ({ ...prev, ...patch }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (patch.question !== undefined) delete next.question;
      if (patch.correct_answer !== undefined) delete next.correct_answer;
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const nextErrors: CardErrors = {};
    if (!card.question.trim()) nextErrors.question = 'Question is required.';
    if (!card.correct_answer.trim()) nextErrors.correct_answer = 'Correct answer is required.';
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError('Please fill in the required fields.');
      return;
    }

    setFieldErrors({});
    setError('');
    setSaving(true);
    try {
      const result = await updateFlashcard(cardId, ctx, card);
      router.push('/h5p/h5p_flashacard?' + h5pContextQuery(ctx, { flash: result.message }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update flashcard');
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Edit flash card"
          description="Update this flash card"
          ctx={ctx}
          backHref={`/h5p/h5p_flashacard?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            {loading ? (
              <LoadingState label="Loading flash card…" />
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} noValidate>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-700">Card details</p>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="card-question" className="text-slate-700">
                          Question <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="card-question"
                          rows={3}
                          value={card.question}
                          onChange={(event) => updateField({ question: event.target.value })}
                          placeholder="Enter the question shown under the card"
                          aria-invalid={fieldErrors.question ? true : undefined}
                        />
                        {fieldErrors.question ? <p className="text-xs text-red-600">{fieldErrors.question}</p> : null}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="card-content" className="text-slate-700">
                          Content / Explanation
                        </Label>
                        <Textarea
                          id="card-content"
                          rows={5}
                          value={card.content}
                          onChange={(event) => updateField({ content: event.target.value })}
                          placeholder="Card body shown to the learner"
                        />
                        <p className="text-xs text-slate-400">Rich HTML supported</p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="card-answer" className="text-slate-700">
                            Correct Answer <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="card-answer"
                            value={card.correct_answer}
                            onChange={(event) => updateField({ correct_answer: event.target.value })}
                            placeholder="Expected answer"
                            aria-invalid={fieldErrors.correct_answer ? true : undefined}
                          />
                          {fieldErrors.correct_answer ? (
                            <p className="text-xs text-red-600">{fieldErrors.correct_answer}</p>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="card-hint" className="text-slate-700">
                            Hint
                          </Label>
                          <Input
                            id="card-hint"
                            value={card.hint}
                            onChange={(event) => updateField({ hint: event.target.value })}
                            placeholder="Optional hint for the learner"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:pointer-events-none disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving…' : 'Update Card'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FlashcardEditPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <FlashcardEditContent />
    </Suspense>
  );
}
