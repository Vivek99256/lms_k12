'use client';

/**
 * One question in the question bank.
 *
 * The teacher bank and the student bank show the same question, correct option
 * and model answer; only the teacher gets Edit/Delete. Those come in through
 * `actions` so the read-only student card is the same component with the slot
 * left empty, and the two can never drift apart.
 */
import { CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isLikelyJson, type QuestionBankItem } from '@/app/course-master/data/questionBank';

export function QuestionBankQuestionCard({
  question,
  visibleNumber,
  actions,
}: {
  question: QuestionBankItem;
  visibleNumber: number;
  actions?: React.ReactNode;
}) {
  return (
    <article className="rounded-[8px] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_2px_8px_rgba(15,23,42,0.08)] sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          {/* <span className="shrink-0 pt-0.5 font-mono text-[14px] text-slate-600">
            {question.displayId}
          </span> */}
          <h3 className="min-w-0 text-[18px] font-bold leading-7 text-slate-950">
            {visibleNumber}. {question.question}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start">
          <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#3157ff]">
            {question.type}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
            {question.marks} mark{question.marks === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {question.options ? (
        <div className="mt-4 space-y-2">
          {question.options.map((option) => (
            <div
              key={`${question.id}-${option.label}`}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-[6px] border px-3 text-[16px] transition-colors',
                option.isCorrect
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-900'
              )}
            >
              <span className="shrink-0 font-mono text-sm font-semibold text-slate-600">
                {option.label}.
              </span>
              <span className="min-w-0 flex-1">{option.text}</span>
              {option.isCorrect ? (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {question.modelAnswer && !isLikelyJson(question.modelAnswer) ? (
        <div className="mt-4 rounded-[6px] border border-slate-200 border-l-4 border-l-[#4f46e5] bg-[#f3f7fc] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Model answer
          </p>
          <p className="mt-2 text-[16px] leading-7 text-slate-700">{question.modelAnswer}</p>
        </div>
      ) : null}

      {actions ? (
        <div className="mt-4 flex justify-end gap-3 border-t border-slate-200/80 pt-3">{actions}</div>
      ) : null}
    </article>
  );
}
