'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';

import { SearchDropdown, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import { cn } from '@/lib/utils';
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import {
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import {
  computeAvailability,
  fetchMappingLevels,
  fetchScopeBuckets,
  fetchSubjectChapters,
  generatePaper,
  QUESTION_TYPES,
  saveAiPaper,
  type AvailabilityResult,
  type BucketAvailability,
  type DistributionEntry,
  type ExamChapter,
  type GeneratedSet,
  type MappingLevel,
  type MappingLevels,
  type SaveResult,
  type ScopeBuckets,
  type SectionConfig,
} from '@/app/exam/data/aiPaper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fieldClass =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';

const QUESTION_TYPE_LABEL = new Map(QUESTION_TYPES.map((t) => [t.id, t.label]));

function questionTypeLabel(id: string): string {
  return QUESTION_TYPE_LABEL.get(id) || 'Question';
}

/** Even split summing to exactly 100; remainder handed to the first entries. */
function evenSplit(levels: MappingLevel[]): DistributionEntry[] {
  const count = levels.length;
  if (count === 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return levels.map((level, index) => ({
    id: level.id,
    name: level.name,
    percentage: base + (index < remainder ? 1 : 0),
  }));
}

/** Split totalQuestions across `count` sections (A, B, C…), remainder to first. */
function buildSections(count: number, total: number): SectionConfig[] {
  const safeCount = Math.max(1, count);
  const base = Math.floor(total / safeCount);
  const remainder = total - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) => ({
    name: String.fromCharCode(65 + index),
    questions: Math.max(0, base + (index < remainder ? 1 : 0)),
  }));
}

function singleValue(value: DropdownValue): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}

function parseNum(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOpenDate(value: string): string {
  return value ? `${value} 00:00:00` : '';
}

function formatCloseDate(value: string): string {
  return value ? `${value} 23:59:59` : '';
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

type BannerTone = 'error' | 'success' | 'info';

const BANNER_STYLES: Record<BannerTone, { wrap: string; icon: typeof Info }> = {
  error: { wrap: 'border-rose-200 bg-rose-50 text-rose-700', icon: AlertTriangle },
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-700', icon: Info },
};

function Banner({ tone, children }: { tone: BannerTone; children: React.ReactNode }) {
  const style = BANNER_STYLES[tone];
  const Icon = style.icon;
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm', style.wrap)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SectionCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-600">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function DistributionRow({
  entry,
  availability,
  onChange,
}: {
  entry: DistributionEntry;
  availability: BucketAvailability | undefined;
  onChange: (id: number, percentage: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex w-full items-center justify-between gap-3 sm:w-44 sm:shrink-0">
        <span className="truncate text-sm font-medium text-slate-700">{entry.name}</span>
        {availability ? (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
              availability.short ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            )}
          >
            {availability.available} / need {availability.required}
          </span>
        ) : null}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={entry.percentage}
        onChange={(event) => onChange(entry.id, parseNum(event.target.value, 0))}
        className="h-2 w-full flex-1 cursor-pointer accent-indigo-600"
        aria-label={`${entry.name} percentage`}
      />
      <div className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          value={entry.percentage}
          onChange={(event) => onChange(entry.id, parseNum(event.target.value, 0))}
          className={cn(fieldClass, 'h-9 w-20 px-2 text-center')}
          aria-label={`${entry.name} percentage value`}
        />
        <span className="text-sm text-slate-400">%</span>
      </div>
    </div>
  );
}

function TotalBadge({ total }: { total: number }) {
  const balanced = total === 100;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span
        className={cn(
          'rounded-full px-3 py-1 text-xs font-semibold',
          balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        )}
      >
        Total: {total}%
      </span>
      <span className="text-xs text-slate-500">Must total 100%.</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AiExamPaperPage() {
  const session = useMemo(() => buildSessionContext(), []);

  const [levels, setLevels] = useState<MappingLevels>({ dok: [], bloom: [] });

  // Scope
  const [gradeId, setGradeId] = useState('');
  const [standardId, setStandardId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapters, setChapters] = useState<ExamChapter[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [questionTypeIds, setQuestionTypeIds] = useState<string[]>(
    QUESTION_TYPES.map((type) => type.id)
  );

  // Distributions
  const [dokDistribution, setDokDistribution] = useState<DistributionEntry[]>([]);
  const [bloomDistribution, setBloomDistribution] = useState<DistributionEntry[]>([]);

  // Questions & marks
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [marksPerQuestion, setMarksPerQuestion] = useState(1);

  // Sections & sets
  const [numSections, setNumSections] = useState(1);
  const [sections, setSections] = useState<SectionConfig[]>(() => buildSections(1, 20));
  const [generateSets, setGenerateSets] = useState(1);

  // Exam settings
  const [paperName, setPaperName] = useState('');
  const [paperDesc, setPaperDesc] = useState('');
  const [examType, setExamType] = useState('Online');
  const [timeAllowed, setTimeAllowed] = useState(60);
  const [attemptAllowed, setAttemptAllowed] = useState(1);
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');

  // Preview / results
  const [buckets, setBuckets] = useState<ScopeBuckets | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [sets, setSets] = useState<GeneratedSet[]>([]);
  const [activeSetIndex, setActiveSetIndex] = useState(0);

  // Status
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  // -- Mount: load DOK / Bloom levels and seed the distributions ------------
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetchMappingLevels(controller.signal)
      .then((loaded) => {
        if (cancelled) return;
        setLevels(loaded);
        setDokDistribution(evenSplit(loaded.dok));
        setBloomDistribution(evenSplit(loaded.bloom));
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setErrorText(errorMessage(error));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // -- Chapters when a subject is chosen ------------------------------------
  useEffect(() => {
    let cancelled = false;
    if (!standardId || !subjectId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setChapters([]);
        setChapterIds([]);
        setChaptersLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!cancelled) setChaptersLoading(true);
    });
    fetchSubjectChapters(standardId, subjectId, controller.signal)
      .then((loaded) => {
        if (cancelled) return;
        setChapters(loaded);
        setChapterIds([]);
        setChaptersLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setChapters([]);
        setChaptersLoading(false);
        setErrorText(errorMessage(error));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [standardId, subjectId]);

  // -- Derived --------------------------------------------------------------
  const dokTotal = useMemo(
    () => dokDistribution.reduce((sum, entry) => sum + entry.percentage, 0),
    [dokDistribution]
  );
  const bloomTotal = useMemo(
    () => bloomDistribution.reduce((sum, entry) => sum + entry.percentage, 0),
    [bloomDistribution]
  );
  const sectionsTotal = useMemo(
    () => sections.reduce((sum, section) => sum + section.questions, 0),
    [sections]
  );
  const totalMarks = useMemo(
    () => Math.round(totalQuestions * marksPerQuestion * 100) / 100,
    [totalQuestions, marksPerQuestion]
  );

  const dokAvailabilityById = useMemo(
    () => new Map((availability?.dok ?? []).map((entry) => [entry.id, entry])),
    [availability]
  );
  const bloomAvailabilityById = useMemo(
    () => new Map((availability?.bloom ?? []).map((entry) => [entry.id, entry])),
    [availability]
  );

  const allChaptersSelected = chapters.length > 0 && chapterIds.length === chapters.length;
  const activeSet = sets[activeSetIndex] ?? null;

  const canSave =
    activeSet != null &&
    !saving &&
    dokTotal === 100 &&
    bloomTotal === 100 &&
    !!standardId &&
    !!subjectId &&
    paperName.trim().length > 0;

  // -- Handlers -------------------------------------------------------------
  const setDokPercentage = (id: number, percentage: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
    setDokDistribution((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, percentage: clamped } : entry))
    );
  };
  const setBloomPercentage = (id: number, percentage: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
    setBloomDistribution((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, percentage: clamped } : entry))
    );
  };

  const handleTotalQuestionsChange = (value: string) => {
    const next = Math.max(0, Math.min(200, Math.round(parseNum(value, 0))));
    setTotalQuestions(next);
    setSections(buildSections(numSections, next));
  };

  const handleNumSectionsChange = (value: string) => {
    const next = Math.max(1, Math.min(5, Math.round(parseNum(value, 1))));
    setNumSections(next);
    setSections(buildSections(next, totalQuestions));
  };

  const handleSectionQuestionsChange = (index: number, value: string) => {
    const next = Math.max(0, Math.round(parseNum(value, 0)));
    setSections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, questions: next } : section))
    );
  };

  const toggleChapter = (id: string) => {
    setChapterIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };
  const toggleAllChapters = () => {
    setChapterIds(allChaptersSelected ? [] : chapters.map((chapter) => chapter.id));
  };
  const toggleQuestionType = (id: string) => {
    setQuestionTypeIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const generateConfig = () => ({
    subjectId,
    chapterIds,
    questionTypeIds,
    totalQuestions,
    marksPerQuestion,
    dokDistribution,
    bloomDistribution,
    sections,
    generateSets,
  });

  const handleValidate = async () => {
    setSaveResult(null);
    const problems: string[] = [];
    if (!standardId) problems.push('Select a standard.');
    if (!subjectId) problems.push('Select a subject.');
    if (!paperName.trim()) problems.push('Enter a paper name.');
    if (totalQuestions < 1) problems.push('Total questions must be at least 1.');
    if (dokTotal !== 100) problems.push('DOK distribution must total 100%.');
    if (bloomTotal !== 100) problems.push("Bloom's distribution must total 100%.");
    if (questionTypeIds.length === 0) problems.push('Select at least one question type.');
    if (problems.length > 0) {
      setInfoText('');
      setErrorText(problems.join(' '));
      return;
    }

    setErrorText('');
    setInfoText('');
    setValidating(true);
    try {
      const fetched = await fetchScopeBuckets(
        { subjectId, chapterIds, questionTypeIds },
        dokDistribution.map((entry) => entry.id),
        bloomDistribution.map((entry) => entry.id)
      );
      const result = computeAvailability(fetched, {
        totalQuestions,
        dokDistribution,
        bloomDistribution,
      });
      const generated = generatePaper(fetched, generateConfig());
      setBuckets(fetched);
      setAvailability(result);
      setSets(generated);
      setActiveSetIndex(0);
      if (result.warnings.length > 0) {
        setInfoText(
          `${result.warnings.join(' ')} The generator filled the shortfall from the wider question pool.`
        );
      }
      if (generated.length === 0 || generated[0].totalQuestions === 0) {
        setErrorText('No questions matched the selected scope. Adjust the scope and try again.');
      }
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setValidating(false);
    }
  };

  const handleRegenerate = () => {
    if (!buckets) return;
    const generated = generatePaper(buckets, generateConfig());
    setSets(generated);
    setActiveSetIndex(0);
  };

  const handleSave = async () => {
    if (!activeSet) return;
    setSaving(true);
    setErrorText('');
    setSaveResult(null);
    try {
      const result = await saveAiPaper({
        gradeId,
        standardId,
        subjectId,
        paperName: paperName.trim(),
        paperDesc: paperDesc.trim(),
        examType,
        timeAllowed: Number(timeAllowed),
        attemptAllowed: Number(attemptAllowed),
        openDate: formatOpenDate(openDate),
        closeDate: formatCloseDate(closeDate),
        set: activeSet,
        dokDistribution,
        bloomDistribution,
      });
      setSaveResult(result);
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAnother = () => {
    setSaveResult(null);
    setErrorText('');
    setInfoText('');
    setSets([]);
    setBuckets(null);
    setAvailability(null);
    setActiveSetIndex(0);
    setPaperName('');
    setPaperDesc('');
    setOpenDate('');
    setCloseDate('');
    setDokDistribution(evenSplit(levels.dok));
    setBloomDistribution(evenSplit(levels.bloom));
  };

  const handlePrint = () => {
    if (!activeSet) return;
    const columns: TableExportColumn[] = [
      { key: 'idx', label: '#', width: '40px', align: 'center' },
      { key: 'question', label: 'Question' },
      { key: 'type', label: 'Type', width: '130px' },
      { key: 'marks', label: 'Marks', width: '70px', align: 'right' },
    ];
    const rows: TableExportRow[] = [];
    let counter = 1;
    activeSet.sections.forEach((section) => {
      section.questions.forEach((question) => {
        rows.push({
          idx: String(counter),
          question: question.title || 'Untitled question',
          type: questionTypeLabel(question.questionTypeId),
          marks: String(question.marks),
        });
        counter += 1;
      });
    });
    openPrintPreview({
      filename: `${paperName || 'ai-exam-paper'}.pdf`,
      title: paperName || 'AI Exam Paper',
      subtitle: `${activeSet.setName} · ${activeSet.totalQuestions} questions · ${activeSet.totalMarks} marks`,
      columns,
      rows,
    });
  };

  const handleExportHtml = () => {
    if (!activeSet) return;
    const sectionsHtml = activeSet.sections
      .map((section) => {
        let counter = 1;
        const items = section.questions
          .map((question) => {
            const row = `<li><span class="q">${counter}. ${escapeHtml(
              question.title || 'Untitled question'
            )}</span><span class="meta">${escapeHtml(
              questionTypeLabel(question.questionTypeId)
            )} · ${question.marks} mark(s)</span></li>`;
            counter += 1;
            return row;
          })
          .join('');
        return `<section class="sec"><h2>Section ${escapeHtml(section.name)} <small>${
          section.questions.length
        } questions · ${section.totalMarks} marks</small></h2><ol>${items}</ol></section>`;
      })
      .join('');
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(paperName || 'AI Exam Paper')} - ${escapeHtml(activeSet.setName)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
    header { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 22px; }
    header p { margin: 6px 0 0; color: #475569; font-size: 13px; }
    .sec { margin-bottom: 24px; }
    .sec h2 { font-size: 15px; color: #4338ca; margin: 0 0 10px; }
    .sec h2 small { color: #64748b; font-weight: 400; }
    ol { margin: 0; padding-left: 20px; }
    li { margin-bottom: 10px; }
    .q { display: block; font-size: 14px; }
    .meta { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(paperName || 'AI Exam Paper')}</h1>
    <p>${escapeHtml(activeSet.setName)} &middot; ${activeSet.totalQuestions} questions &middot; ${
      activeSet.totalMarks
    } marks${paperDesc.trim() ? ` &middot; ${escapeHtml(paperDesc.trim())}` : ''}</p>
  </header>
  ${sectionsHtml}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(paperName || 'ai-exam-paper').replace(/\s+/g, '-')}-${activeSet.setName.replace(
      /\s+/g,
      '-'
    )}.html`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  // -- Render ---------------------------------------------------------------
  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        {/* Header */}
        <header className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              AI Exam Paper
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Generate a question paper from Depth-of-Knowledge and Bloom&apos;s taxonomy targets.
            </p>
          </div>
        </header>

        {/* Banners */}
        {errorText ? <Banner tone="error">{errorText}</Banner> : null}
        {infoText ? <Banner tone="info">{infoText}</Banner> : null}
        {saveResult ? (
          <Banner tone="success">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {saveResult.message}
                {saveResult.id ? ` (Paper ID: ${saveResult.id})` : ''}
              </span>
              <button
                type="button"
                onClick={handleCreateAnother}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <RefreshCw className="size-3.5" />
                Create another
              </button>
            </div>
          </Banner>
        ) : null}

        {/* Section 1 — Scope */}
        <SectionCard step={1} title="Scope" description="Choose the grade, standard and subject.">
          <SearchDropdown
            fields={['section', 'standard', 'subject']}
            subInstituteId={session.subInstituteId}
            token={session.token}
            labels={{ section: 'Grade', standard: 'Standard', subject: 'Subject' }}
            required={{ section: true, standard: true, subject: true }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            onSectionChange={(value) => {
              setGradeId(singleValue(value));
              setStandardId('');
              setSubjectId('');
            }}
            onStandardChange={(value) => {
              setStandardId(singleValue(value));
              setSubjectId('');
            }}
            onSubjectChange={(value) => {
              setSubjectId(singleValue(value));
            }}
          />

          {/* Chapters */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">
                Chapters <span className="text-xs font-normal text-slate-400">(empty = all chapters)</span>
              </span>
              {chapters.length > 0 ? (
                <button
                  type="button"
                  onClick={toggleAllChapters}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {allChaptersSelected ? 'Clear all' : 'Select all'}
                </button>
              ) : null}
            </div>
            {!subjectId ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                Select a standard and subject to load chapters.
              </p>
            ) : chaptersLoading ? (
              <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" /> Loading chapters…
              </p>
            ) : chapters.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                No chapters found for this subject.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {chapters.map((chapter) => {
                  const selected = chapterIds.includes(chapter.id);
                  return (
                    <label
                      key={chapter.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                        selected
                          ? 'border-indigo-300 bg-indigo-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleChapter(chapter.id)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition',
                          selected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        )}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block truncate text-sm font-medium',
                            selected ? 'text-indigo-700' : 'text-slate-800'
                          )}
                        >
                          {chapter.name || 'Untitled chapter'}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {chapter.conceptCount} concepts
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Question types */}
          <div className="mt-5">
            <span className="mb-2 block text-sm font-medium text-slate-700">Question types</span>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map((type) => {
                const selected = questionTypeIds.includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleQuestionType(type.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      selected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* Distributions */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SectionCard
            step={2}
            title="Depth of Knowledge (DOK)"
            description="Set the percentage share of each DOK level."
          >
            <div className="space-y-2">
              {dokDistribution.length === 0 ? (
                <p className="text-sm text-slate-500">Loading DOK levels…</p>
              ) : (
                dokDistribution.map((entry) => (
                  <DistributionRow
                    key={entry.id}
                    entry={entry}
                    availability={dokAvailabilityById.get(entry.id)}
                    onChange={setDokPercentage}
                  />
                ))
              )}
            </div>
            <TotalBadge total={dokTotal} />
          </SectionCard>

          <SectionCard
            step={3}
            title="Bloom's taxonomy"
            description="Set the percentage share of each Bloom level."
          >
            <div className="space-y-2">
              {bloomDistribution.length === 0 ? (
                <p className="text-sm text-slate-500">Loading Bloom levels…</p>
              ) : (
                bloomDistribution.map((entry) => (
                  <DistributionRow
                    key={entry.id}
                    entry={entry}
                    availability={bloomAvailabilityById.get(entry.id)}
                    onChange={setBloomPercentage}
                  />
                ))
              )}
            </div>
            <TotalBadge total={bloomTotal} />
          </SectionCard>
        </div>

        {/* Section 4 — Questions & marks */}
        <SectionCard
          step={4}
          title="Questions & marks"
          description="Define the size and weighting of the paper."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Total questions
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={totalQuestions}
                onChange={(event) => handleTotalQuestionsChange(event.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Marks per question
              </label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={marksPerQuestion}
                onChange={(event) =>
                  setMarksPerQuestion(Math.max(0.5, parseNum(event.target.value, 0.5)))
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Total marks</label>
              <input type="number" value={totalMarks} readOnly className={cn(fieldClass, 'bg-slate-50')} />
            </div>
          </div>
        </SectionCard>

        {/* Section 5 — Sections & sets */}
        <SectionCard
          step={5}
          title="Sections & sets"
          description="Split the paper into sections and choose how many shuffled sets to generate."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Number of sections
              </label>
              <select
                value={numSections}
                onChange={(event) => handleNumSectionsChange(event.target.value)}
                className={fieldClass}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Sets to generate</label>
              <select
                value={generateSets}
                onChange={(event) =>
                  setGenerateSets(Math.max(1, Math.min(3, Math.round(parseNum(event.target.value, 1)))))
                }
                className={fieldClass}
              >
                {[1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {sections.map((section, index) => (
              <div
                key={section.name}
                className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3 sm:items-end"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Section</label>
                  <input value={section.name} readOnly className={cn(fieldClass, 'h-9 bg-slate-50')} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Questions</label>
                  <input
                    type="number"
                    min={0}
                    value={section.questions}
                    onChange={(event) => handleSectionQuestionsChange(index, event.target.value)}
                    className={cn(fieldClass, 'h-9')}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Marks</label>
                  <input
                    value={Math.round(section.questions * marksPerQuestion * 100) / 100}
                    readOnly
                    className={cn(fieldClass, 'h-9 bg-slate-50')}
                  />
                </div>
              </div>
            ))}
          </div>
          <p
            className={cn(
              'mt-2 text-xs',
              sectionsTotal === totalQuestions ? 'text-slate-500' : 'text-amber-600'
            )}
          >
            Section questions total {sectionsTotal} of {totalQuestions}.
          </p>
        </SectionCard>

        {/* Section 6 — Exam settings */}
        <SectionCard
          step={6}
          title="Exam settings"
          description="Name the paper and configure how it opens."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Paper name <span className="text-rose-500">*</span>
              </label>
              <input
                value={paperName}
                onChange={(event) => setPaperName(event.target.value)}
                placeholder="e.g. Term 1 – Science"
                className={fieldClass}
              />
            </div>
            <div className="sm:col-span-2">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <AiFieldAssistant
                  value={paperDesc}
                  onApply={setPaperDesc}
                  fieldType="description"
                  label="Paper description"
                  module="exam"
                  page="Exam creation"
                  entityType="exam_paper"
                  related={{ "Paper name": paperName }}
                />
              </div>
              <textarea
                value={paperDesc}
                onChange={(event) => setPaperDesc(event.target.value)}
                rows={2}
                placeholder="Optional notes about this paper"
                className={cn(fieldClass, 'h-auto min-h-16 resize-y py-2')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Exam type</label>
              <select
                value={examType}
                onChange={(event) => setExamType(event.target.value)}
                className={fieldClass}
              >
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Time allowed (minutes)
              </label>
              <input
                type="number"
                min={1}
                value={timeAllowed}
                onChange={(event) => setTimeAllowed(Math.max(1, Math.round(parseNum(event.target.value, 60))))}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Attempts allowed</label>
              <select
                value={attemptAllowed}
                onChange={(event) => setAttemptAllowed(Math.round(parseNum(event.target.value, 1)))}
                className={fieldClass}
              >
                {[1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Open date</label>
                <input
                  type="date"
                  value={openDate}
                  onChange={(event) => setOpenDate(event.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Close date</label>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(event) => setCloseDate(event.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Preview */}
        {activeSet ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Preview</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeSet.totalQuestions} questions · {activeSet.totalMarks} marks
                  {availability ? ` · ${availability.totalAvailable} available in scope` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCw className="size-3.5" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Printer className="size-3.5" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleExportHtml}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Download className="size-3.5" />
                  Export HTML
                </button>
              </div>
            </div>

            {sets.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {sets.map((set, index) => (
                  <button
                    key={set.setName}
                    type="button"
                    onClick={() => setActiveSetIndex(index)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                      index === activeSetIndex
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {set.setName}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              {activeSet.sections.map((section) => (
                <div key={section.name} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Section {section.name}</h3>
                    <span className="text-xs text-slate-500">
                      {section.questions.length} questions · {section.totalMarks} marks
                    </span>
                  </div>
                  {section.questions.length === 0 ? (
                    <p className="text-sm text-slate-500">No questions in this section.</p>
                  ) : (
                    <ol className="space-y-2">
                      {section.questions.map((question, index) => (
                        <li
                          key={`${question.id}-${index}`}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                        >
                          <div className="flex min-w-0 gap-2.5">
                            <span className="mt-0.5 shrink-0 text-xs font-semibold text-slate-400">
                              {index + 1}.
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-800">
                                {question.title || 'Untitled question'}
                              </p>
                              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {questionTypeLabel(question.questionTypeId)}
                              </span>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-slate-700">
                            {question.marks} mark(s)
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Sticky action bar */}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5 sm:shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                {totalQuestions} questions
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                {totalMarks} marks
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 font-medium',
                  dokTotal === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                )}
              >
                DOK {dokTotal}%
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 font-medium',
                  bloomTotal === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                )}
              >
                Bloom {bloomTotal}%
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {validating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Validate &amp; Preview
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save paper
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
