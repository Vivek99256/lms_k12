'use client';

// ---------------------------------------------------------------------------
// The printed sheet.
//
// Everything on this page comes from the blueprint (layout) or the selected
// question paper (content). There is no sample text, no placeholder school and
// no invented question: if a field is empty it is because the school left it
// empty, and it simply does not print.
//
// The outer element carries `question-paper-sheet`, which the Exam page's
// print stylesheet isolates so Ctrl+P prints the paper alone.
// ---------------------------------------------------------------------------

import RichText from '@/app/components/questionBank/RichText';
import { optionColumnCount } from '@/lib/question-paper/options';
import { splitSectionsByContent } from '@/lib/question-paper/sections';
import { formatMarks, instructionMarker, numberLabel } from './resolve';
import type {
  BlueprintPage,
  PlacedQuestion,
  ResolvedPaper,
  ResolvedSection,
} from './types';

const RULE_CLASS: Record<string, string> = {
  none: '',
  single: 'border-b border-black',
  double: 'border-b-4 border-double border-black',
  dashed: 'border-b border-dashed border-black',
};

function QuestionOptions({ placed }: { placed: PlacedQuestion }) {
  const { options } = placed.question;

  if (options.length === 0) return null;

  // The one place this paper uses columns, and only while every option is
  // short enough to sit on a line. The questions themselves always run
  // straight down the page.
  const columns = optionColumnCount(options);

  return (
    <div
      className={`mt-1.5 ${columns === 2 ? 'grid grid-cols-2 gap-x-6 gap-y-1' : 'space-y-1'}`}
    >
      {options.map((option, index) => (
        <div key={option.id} className="flex gap-1.5 leading-snug">
          <span className="shrink-0">({numberLabel(index, 1, 'lower-alpha')})</span>
          <RichText value={option.text} as="span" allowImages />
        </div>
      ))}
    </div>
  );
}

function AnswerSpace({ section }: { section: ResolvedSection['section'] }) {
  const { mode, lines } = section.answerSpace;

  if (mode === 'none' || lines <= 0) return null;

  if (mode === 'box') {
    return (
      <div
        className="mt-2 w-full border border-black"
        style={{ height: `${Math.max(1, lines) * 1.6}rem` }}
      />
    );
  }

  if (mode === 'grid') {
    return (
      <div
        className="mt-2 w-full border border-black"
        style={{
          height: `${Math.max(1, lines) * 1.6}rem`,
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0 1.55rem, #cbd5e1 1.55rem 1.6rem), repeating-linear-gradient(to right, transparent 0 1.55rem, #e2e8f0 1.55rem 1.6rem)',
        }}
      />
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="border-b border-dotted border-slate-400" />
      ))}
    </div>
  );
}

function QuestionBlock({
  placed,
  section,
  compact,
}: {
  placed: PlacedQuestion;
  section: ResolvedSection['section'];
  compact: boolean;
}) {
  const { question } = placed;

  return (
    <article data-pdf-block className="question-block break-inside-avoid">
      <div className="flex items-start gap-2">
        {placed.label ? (
          <span className="shrink-0 font-semibold">{placed.label}</span>
        ) : null}

        <div className="min-w-0 flex-1">
          <RichText value={question.question_title} allowImages className="leading-relaxed" />

          {question.description && !compact ? (
            <RichText
              value={question.description}
              allowImages
              className="mt-1 text-[0.92em] italic text-slate-600"
            />
          ) : null}

          <QuestionOptions placed={placed} />

          {section.showQuestionType && question.question_type ? (
            <p className="mt-1 text-[0.8em] uppercase tracking-wide text-slate-500">
              {question.question_type}
            </p>
          ) : null}

          <AnswerSpace section={section} />
        </div>

        {section.showMarks ? (
          <span className="shrink-0 whitespace-nowrap font-semibold">
            [{formatMarks(placed.marks)}]
          </span>
        ) : null}
      </div>
    </article>
  );
}

function SectionBlock({ resolved }: { resolved: ResolvedSection }) {
  const { section } = resolved;
  const isTable = section.layout === 'table';
  const spacing = section.layout === 'compact' ? 'space-y-2.5' : 'space-y-4';
  const hasHeading = Boolean(
    resolved.title || resolved.subtitle || resolved.marksLabel || resolved.groupLabel
  );

  return (
    <section className="question-paper-section">
      {hasHeading ? (
        <header data-pdf-block className="mb-2 mt-5 break-after-avoid">
          {resolved.title || resolved.groupLabel ? (
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[1.05em] font-bold uppercase tracking-wide">
                {resolved.groupLabel ? (
                  <span className="mr-2 normal-case">{resolved.groupLabel}</span>
                ) : null}
                {resolved.title}
              </h2>
              {resolved.marksLabel ? (
                <span className="shrink-0 font-semibold">{resolved.marksLabel}</span>
              ) : null}
            </div>
          ) : null}

          {resolved.subtitle ? (
            <p className="mt-0.5 text-[0.95em] italic">{resolved.subtitle}</p>
          ) : null}

          {resolved.note ? <p className="mt-0.5 text-[0.92em]">{resolved.note}</p> : null}

          {resolved.optionalLabel ? (
            <p className="mt-0.5 text-[0.92em] italic">({resolved.optionalLabel})</p>
          ) : null}

          {resolved.instructions.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-[0.92em]">
              {resolved.instructions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : null}
        </header>
      ) : null}

      {isTable ? (
        <table data-pdf-block className="w-full table-fixed border-collapse">
          <tbody>
            {resolved.questions.map((placed) => (
              <tr key={placed.question.id} className="break-inside-avoid align-top">
                <td className="w-16 border border-black px-2 py-1.5 font-semibold">
                  {placed.label}
                </td>
                <td className="border border-black px-2 py-1.5">
                  <RichText value={placed.question.question_title} allowImages />
                  <QuestionOptions placed={placed} />
                </td>
                {section.showMarks ? (
                  <td className="w-16 border border-black px-2 py-1.5 text-center font-semibold">
                    {formatMarks(placed.marks)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // One question below the next, in blueprint order. Never columns:
        // side-by-side questions make the numbering read down one column and
        // back up the other, which is unusable on a printed paper.
        <div className={spacing}>
          {resolved.questions.map((placed) => (
            <QuestionBlock
              key={placed.question.id}
              placed={placed}
              section={section}
              compact={section.layout === 'compact'}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function QuestionPaperSheet({
  paper,
  page,
}: {
  paper: ResolvedPaper;
  page: BlueprintPage;
}) {
  const { header } = paper;
  // A section that matched no question prints no heading. The teacher is told
  // about the mismatch in the preview chrome instead, where it is actionable.
  const { printable: sections } = splitSectionsByContent(paper.sections);
  const hasMeta = header.metaLeft.length > 0 || header.metaRight.length > 0;
  const titleAlign = header.align === 'left' ? 'text-left' : 'text-center';
  const brandAlign = header.align === 'left' ? 'justify-start' : 'justify-center';

  return (
    <div
      className="question-paper-sheet mx-auto w-full bg-white text-black"
      style={{
        fontFamily:
          page.fontFamily === 'sans'
            ? 'ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif'
            : 'ui-serif, Georgia, "Times New Roman", serif',
        fontSize: `${page.fontSize}pt`,
        lineHeight: 1.5,
      }}
    >
      <header data-pdf-block className={header.title || header.schoolName ? 'mb-3' : ''}>
        {header.logoUrl || header.schoolName ? (
          <div className={`flex items-center gap-3 ${brandAlign}`}>
            {header.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={header.logoUrl}
                alt=""
                className="h-12 w-12 shrink-0 object-contain"
              />
            ) : null}

            {header.schoolName ? (
              <p className="text-[1.25em] font-bold uppercase tracking-wide">
                {header.schoolName}
              </p>
            ) : null}
          </div>
        ) : null}

        {header.title ? (
          <h1 className={`mt-1.5 text-[1.15em] font-bold ${titleAlign}`}>{header.title}</h1>
        ) : null}

        {header.subtitle ? (
          <p className={`mt-0.5 text-[1em] font-semibold ${titleAlign}`}>{header.subtitle}</p>
        ) : null}

        {hasMeta ? (
          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-1">
            <div className="space-y-0.5">
              {header.metaLeft.map((field, index) => (
                <p key={index} className="font-semibold">
                  {field.label ? `${field.label}: ` : ''}
                  {field.value}
                </p>
              ))}
            </div>

            <div className="space-y-0.5 text-right">
              {header.metaRight.map((field, index) => (
                <p key={index} className="font-semibold">
                  {field.label ? `${field.label}: ` : ''}
                  {field.value}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {header.studentFields.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {header.studentFields.map((field, index) => (
              <div key={index} className="flex min-w-[180px] flex-1 items-end gap-2">
                <span className="shrink-0">{field}:</span>
                <span className="flex-1 border-b border-dotted border-black" />
              </div>
            ))}
          </div>
        ) : null}
      </header>

      {header.rule !== 'none' ? (
        <div data-pdf-block className={`mt-2 ${RULE_CLASS[header.rule] ?? RULE_CLASS.single}`} />
      ) : null}

      {paper.instructions.items.length > 0 ? (
        <div data-pdf-block className="mt-3 break-inside-avoid">
          {paper.instructions.title ? (
            <p className="font-bold">{paper.instructions.title}</p>
          ) : null}

          <ul className="mt-1 space-y-0.5">
            {paper.instructions.items.map((item, index) => {
              const marker = instructionMarker(index, paper.instructions.numbering);

              return (
                <li key={index} className="flex gap-2">
                  {marker ? <span className="shrink-0">{marker}</span> : null}
                  <span>{item}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {sections.map((resolved) => (
        <SectionBlock key={resolved.section.id} resolved={resolved} />
      ))}

      {paper.footer.text ? (
        <p data-pdf-block className="mt-8 text-center font-semibold tracking-widest">{paper.footer.text}</p>
      ) : null}
    </div>
  );
}
