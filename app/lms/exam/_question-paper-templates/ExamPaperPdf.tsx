'use client';

// ---------------------------------------------------------------------------
// The Exams tab's PDF affordances: a template picker beside the toolbar
// buttons, and a per-row action that turns that exam into a question paper.
//
// This is the same engine the Question paper templates tab uses -- the chosen
// blueprint, the exam's own questions from the ERP, and the signed-in school's
// letterhead. Nothing about the paper is typed in or stubbed here.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileDown, Loader2 } from 'lucide-react';
import { fetchPaperContext, fetchTemplateIndex, readSchoolBranding } from './api';
import { generateQuestionPaperPdf } from './pdf';
import type { QuestionPaperTemplate } from './types';

function templateKey(template: QuestionPaperTemplate): string {
  return template.is_preset ? `preset:${template.preset_key}` : `template:${template.id}`;
}

export type ExamPaperPdfController = ReturnType<typeof useExamPaperPdf>;

/**
 * Loads the school's templates once for the Exams tab and exposes the one
 * action the table needs: turn paper `paperId` into a PDF.
 */
export function useExamPaperPdf() {
  const [templates, setTemplates] = useState<QuestionPaperTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
  const [busyPaperId, setBusyPaperId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const index = await fetchTemplateIndex();

        if (cancelled) return;

        // The school's own templates first, then the built-in examples, so a
        // school that has saved one lands on it by default.
        const all = [...index.templates, ...index.presets];
        setTemplates(all);
        setSelectedKey((current) => current || (all[0] ? templateKey(all[0]) : ''));
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load question paper templates.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    queueMicrotask(() => void load());

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => templateKey(template) === selectedKey) ?? templates[0] ?? null,
    [templates, selectedKey]
  );

  const generate = useCallback(
    async (paperId: number, examName: string) => {
      if (!selectedTemplate || !paperId) return;

      setBusyPaperId(paperId);
      setError('');

      try {
        const context = await fetchPaperContext(paperId);

        if (context.questions.length === 0) {
          throw new Error(
            'This exam has no questions on file, so there is nothing to put on a question paper.'
          );
        }

        await generateQuestionPaperPdf({
          blueprint: selectedTemplate.blueprint,
          context,
          branding: readSchoolBranding(),
          fileName: examName || context.paper.paper_name || 'question-paper',
        });
      } catch (pdfError) {
        setError(
          pdfError instanceof Error ? pdfError.message : 'Unable to generate the question paper.'
        );
      } finally {
        setBusyPaperId(null);
      }
    },
    [selectedTemplate]
  );

  return {
    templates,
    loading,
    selectedKey: selectedTemplate ? templateKey(selectedTemplate) : '',
    setSelectedKey,
    selectedTemplate,
    generate,
    busyPaperId,
    error,
    dismissError: () => setError(''),
  };
}

/** Which layout the row-level PDF action will use. */
export function QuestionPaperTemplateSelect({
  controller,
}: {
  controller: ExamPaperPdfController;
}) {
  const { templates, loading, selectedKey, setSelectedKey } = controller;

  return (
    <div className="relative">
      <select
        value={selectedKey}
        onChange={(event) => setSelectedKey(event.target.value)}
        disabled={loading || templates.length === 0}
        aria-label="Question paper template"
        title="Layout used by the PDF action on each exam"
        className="h-10 min-w-[200px] appearance-none rounded-[10px] border border-[#CFD9E6] bg-white px-3.5 pr-9 text-[14px] text-[#24324A] outline-none focus:border-[#7C6CF4] disabled:opacity-60"
      >
        {loading ? <option value="">Loading templates…</option> : null}
        {!loading && templates.length === 0 ? (
          <option value="">No paper templates</option>
        ) : null}
        {templates.map((template) => (
          <option key={templateKey(template)} value={templateKey(template)}>
            {template.name}
            {template.is_preset ? ' (example)' : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8798]" />
    </div>
  );
}

/** The per-row action: this exam, the chosen template, as a PDF. */
export function ExamPdfButton({
  controller,
  paperId,
  examName,
}: {
  controller: ExamPaperPdfController;
  paperId: number;
  examName: string;
}) {
  const busy = controller.busyPaperId === paperId;
  const disabled = busy || !controller.selectedTemplate || !paperId;

  return (
    <button
      type="button"
      onClick={() => void controller.generate(paperId, examName)}
      disabled={disabled}
      title={
        controller.selectedTemplate
          ? `Question paper PDF using "${controller.selectedTemplate.name}"`
          : 'Choose a question paper template first'
      }
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[#CFD9E6] bg-white px-3 text-[12px] font-semibold text-[#5846EA] transition hover:border-[#5846EA] hover:bg-[#F5F4FF] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
      PDF
    </button>
  );
}

/** Surfaces a failed export without disturbing the table. */
export function ExamPdfNotice({ controller }: { controller: ExamPaperPdfController }) {
  if (!controller.error) return null;

  return (
    <div className="flex items-start justify-between gap-3 rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[14px] text-[#B91C1C]">
      <span>{controller.error}</span>
      <button
        type="button"
        onClick={controller.dismissError}
        className="shrink-0 text-[13px] font-semibold underline"
      >
        Dismiss
      </button>
    </div>
  );
}
