'use client';

/**
 * One question in the question bank.
 *
 * The teacher bank and the student bank show the same question, correct option
 * and model answer; only the teacher gets Edit/Delete. Those come in through
 * `actions` so the read-only student card is the same component with the slot
 * left empty, and the two can never drift apart.
 *
 * Text goes through RichText rather than straight into dangerouslySetInnerHTML:
 * the bank now holds questions extracted from published books, which carry
 * LaTeX (`$x^2$`) and the occasional HTML table. Raw innerHTML would print the
 * LaTeX verbatim and trust markup that came out of a PDF.
 *
 * Only AI-generated questions wear their Bloom and difficulty tags on the
 * card. For a question taken from a published book those are inferred rather
 * than authored, so they sit behind the info button next to the question type
 * instead of competing with the question itself for attention.
 */
import { useState } from 'react';
import { CheckCircle2, ImageOff, AlertTriangle, Sparkles, Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isLikelyJson, type QuestionBankItem } from '@/app/course-master/data/questionBank';
import RichText from './RichText';

function Pill({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold',
        'border-slate-200 bg-slate-100 text-slate-600',
        className
      )}
    >
      {children}
    </span>
  );
}

/** The metadata that no longer sits on the card face, revealed on hover. */
function DetailsButton({ question }: { question: QuestionBankItem }) {
  const [open, setOpen] = useState(false);

  const rows: Array<[string, string]> = [];
  if (question.bloom) rows.push(['Bloom', question.bloom]);
  if (question.difficulty) rows.push(['Difficulty', question.difficulty]);
  if (question.conceptTitle) rows.push(['Concept', question.conceptTitle]);

  if (rows.length === 0) return null;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Show question details"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-[#4f46e5] hover:text-[#4f46e5]"
      >
        <Info size={13} />
      </button>

      {open ? (
        <span
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-1.5 w-max min-w-[190px] max-w-[300px] rounded-[8px] border border-slate-200 bg-white p-2.5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
        >
          {rows.map(([label, value]) => (
            <span key={label} className="flex justify-between gap-4 py-0.5 text-[11px]">
              <span className="font-medium text-slate-500">{label}</span>
              <span className="font-bold text-slate-800">{value}</span>
            </span>
          ))}
          {question.attribution ? (
            <span className="mt-1.5 block border-t border-slate-100 pt-1.5 text-[10px] leading-snug text-slate-400">
              {question.attribution}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export function QuestionBankQuestionCard({
  question,
  visibleNumber,
  actions,
}: {
  question: QuestionBankItem;
  visibleNumber: number;
  actions?: React.ReactNode;
}) {
  const held = question.status === 0;
  const isAssertionReason = Boolean(question.assertion || question.reason);
  const isAiGenerated = question.source !== 'extracted';

  return (
    <article
      className={cn(
        'rounded-[8px] border bg-white px-5 py-5 shadow-[0_2px_8px_rgba(15,23,42,0.08)] sm:px-6',
        held ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200/90'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <h3 className="min-w-0 text-[18px] font-bold leading-7 text-slate-950">
            <span className="mr-1.5">{visibleNumber}.</span>
            {isAssertionReason ? (
              <span className="text-slate-500">Assertion &amp; Reason</span>
            ) : (
              <RichText
                as="span"
                value={question.question}
                className="inline [&_img]:max-w-full [&_img]:rounded-lg [&_table]:mt-2 [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1"
              />
            )}
          </h3>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-start">
          <span className="inline-flex items-center gap-1.5">
            <Pill className="border-indigo-200 bg-[#eef2ff] text-[#3157ff]">
              {question.typeLabel ?? question.type}
            </Pill>
            <DetailsButton question={question} />
          </span>

          {/* Generated questions wear their tags; a question from a book keeps
              them behind the info button above. */}
          {isAiGenerated ? (
            <>
              <Pill title="Generated by AI; no published source">
                <Sparkles size={11} />
                AI generated
              </Pill>
              {question.bloom && (
                <Pill className="border-blue-200 bg-blue-50 text-blue-700">
                  Bloom: {question.bloom}
                </Pill>
              )}
              {question.difficulty && (
                <Pill className="border-orange-200 bg-orange-50 text-orange-700">
                  Diff: {question.difficulty}
                </Pill>
              )}
            </>
          ) : null}

          <Pill>
            {question.marks} mark{question.marks === 1 ? '' : 's'}
          </Pill>

          {held && (
            <Pill
              className="border-amber-300 bg-amber-100 text-amber-800"
              title={
                question.validationStatus
                  ? `Validator: ${question.validationStatus}`
                  : 'Held for teacher review'
              }
            >
              <AlertTriangle size={11} />
              Held for review
            </Pill>
          )}
        </div>
      </div>

      {isAssertionReason && (
        <div className="mt-3 space-y-2">
          {question.assertion && (
            <div className="rounded-[6px] border-l-4 border-l-sky-400 bg-sky-50/60 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">
                Assertion (A)
              </p>
              <RichText
                value={question.assertion}
                className="mt-1 text-[16px] leading-7 text-slate-800"
              />
            </div>
          )}
          {question.reason && (
            <div className="rounded-[6px] border-l-4 border-l-violet-400 bg-violet-50/60 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
                Reason (R)
              </p>
              <RichText
                value={question.reason}
                className="mt-1 text-[16px] leading-7 text-slate-800"
              />
            </div>
          )}
        </div>
      )}

      {question.subPartLabels && question.subPartLabels.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Sub-parts: {question.subPartLabels.join(', ')}
        </p>
      )}

      <QuestionFigures question={question} />

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
              <RichText
                as="span"
                value={option.text}
                className="min-w-0 flex-1 [&_img]:max-w-full [&_img]:rounded-lg [&_p]:inline"
              />
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
          <RichText
            value={question.modelAnswer}
            className="mt-2 text-[16px] leading-7 text-slate-700 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:mt-2 [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1"
          />
        </div>
      ) : null}

      {actions ? (
        <div className="mt-4 flex justify-end gap-3 border-t border-slate-200/80 pt-3">{actions}</div>
      ) : null}
    </article>
  );
}

function QuestionFigures({ question }: { question: QuestionBankItem }) {
  const figures = question.figures ?? [];

  if (figures.length === 0) {
    if (!question.figureRequired) return null;
    return (
      <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-dashed border-amber-300 px-3 py-2 text-xs text-amber-700">
        <ImageOff size={14} />
        This question refers to a figure that was not captured during extraction.
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {figures.map((figure, i) => (
        <QuestionFigure key={figure.sha256 ?? i} figure={figure} question={question} />
      ))}
    </div>
  );
}

/**
 * One figure, which may not load.
 *
 * Some rows still carry a URL from the machine that produced them, and a few
 * point at files that no longer exist. Rendering those as a broken-image icon
 * tells the reader nothing; the caption and the text OCR'd out of the figure
 * usually carry the data the question needs, so they are shown instead.
 */
function QuestionFigure({
  figure,
  question,
}: {
  figure: NonNullable<QuestionBankItem['figures']>[number];
  question: QuestionBankItem;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(figure.url) && !failed;

  if (!showImage && !figure.caption && !figure.ocr_text) {
    return (
      <div className="flex items-center gap-2 rounded-[6px] border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
        <ImageOff size={14} />
        Figure unavailable.
      </div>
    );
  }

  return (
    <figure className="overflow-hidden rounded-[6px] border border-slate-200 bg-white">
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={figure.url as string}
          alt={figure.caption || `Figure for question ${question.displayId}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="max-h-56 w-auto max-w-full object-contain"
        />
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-500">
          <ImageOff size={13} />
          Figure could not be loaded
        </div>
      )}
      {(figure.caption || figure.ocr_text) && (
        <figcaption className="max-w-[280px] space-y-0.5 px-2 py-1 text-[11px] leading-snug text-slate-500">
          {figure.caption && <span className="block">{figure.caption}</span>}
          {figure.ocr_text && (
            <span
              className={failed ? 'block text-slate-600' : 'block line-clamp-3 text-slate-400'}
              title={figure.ocr_text}
            >
              Read from image: {figure.ocr_text}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
