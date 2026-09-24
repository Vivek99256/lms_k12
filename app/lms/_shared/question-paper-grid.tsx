'use client';

/**
 * The one question-paper grid.
 *
 * `/lms/exam`, `/lms/worksheet` and `/lms/project` are all views of the same
 * `question_paper` table over the same `GET /api/question-paper` endpoint — they
 * differ only in which `exam_type` rows they pin to and which columns they show.
 * This module owns the fetch, the row mapping, the toolbar and the table so the
 * three pages cannot drift apart; a page supplies `examType` and `columns` and
 * nothing else about the grid.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { examPaperPdfUrl } from '@/app/lms/lmsAssignment/api';
import {
  ExamPdfButton,
  ExamPdfNotice,
  useExamPaperPdf,
  type ExamPaperPdfController,
} from '@/app/lms/exam/_question-paper-templates/ExamPaperPdf';

export type ExamStatus = 'Scheduled' | 'Open' | 'Draft' | 'Closed';

export type ExamRecord = {
  id: string;
  /** The question_paper row id, for APIs that need it beyond the EXM- label. */
  paperId: number;
  name: string;
  classLabel: string;
  type: string;
  window: string;
  attempts: number;
  questions: number;
  marks: number;
  status: ExamStatus;
};

export type ApiQuestionPaperRecord = {
  id: number;
  paper_name?: string | null;
  paper_desc?: string | null;
  open_date?: string | null;
  close_date?: string | null;
  attempt_allowed?: number | string | null;
  total_ques?: number | string | null;
  total_marks?: number | string | null;
  exam_type?: string | null;
  standard_name?: string | number | null;
  grade_name?: string | null;
  subject_name?: string | null;
  active_exam?: string | null;
};

type QuestionPaperApiResponse = {
  status_code?: number;
  message?: string;
  data?: ApiQuestionPaperRecord[];
};

export const statusBadgeClasses: Record<ExamStatus, string> = {
  Scheduled: 'bg-[#FFF4E8] text-[#A45C14]',
  Open: 'bg-[#EAF9F1] text-[#14804A]',
  Draft: 'bg-[#EEF2F7] text-[#64748B]',
  Closed: 'bg-[#EEF2F7] text-[#475569]',
};

export const statusDotClasses: Record<ExamStatus, string> = {
  Scheduled: 'bg-[#B96A1F]',
  Open: 'bg-[#14804A]',
  Draft: 'bg-[#7C8AA0]',
  Closed: 'bg-[#64748B]',
};

export const examTypeOptions = [
  { label: 'Online', value: 'online' },
  { label: 'Offline', value: 'offline' },
  { label: 'Homework', value: 'homework' },
  { label: 'Assignment', value: 'assignment' },
  { label: 'Worksheet', value: 'worksheet' },
  { label: 'Project', value: 'project' },
];

// `exam_type` is stored as a lowercase slug ("homework"), so anything that shows
// it to a person maps it back to the dropdown's label. Unknown values from older
// rows fall through unchanged rather than being hidden.
export function examTypeLabel(value?: string | null): string {
  const slug = (value ?? '').trim().toLowerCase();
  if (!slug) return '-';
  return examTypeOptions.find((option) => option.value === slug)?.label ?? value!.trim();
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function getQuestionPaperSession() {
  if (typeof window === 'undefined') {
    return { token: '', subInstituteId: '', userProfileName: '', userId: '', syear: '' };
  }

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const academicYears = userData.academicYears;
    let syear = readString(localStorage.getItem('selectedAcademicYear'));

    if (!syear && Array.isArray(academicYears) && academicYears.length > 0) {
      const firstYear = academicYears[0] as Record<string, unknown>;
      syear = readString(firstYear.syear);
    }

    if (!syear) {
      syear = readString(userData.academic_year_id ?? userData.academicYearId ?? menuContext.academic_year_id);
    }

    return {
      token: readString(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      userProfileName: readString(menuContext.user_profile_name ?? userData.user_profile_name),
      userId: readString(menuContext.user_id ?? userData.user_id),
      syear,
    };
  } catch {
    return { token: '', subInstituteId: '', userProfileName: '', userId: '', syear: '' };
  }
}

export function mapQuestionPaperToExam(row: ApiQuestionPaperRecord): ExamRecord {
  const paperName = row.paper_name?.trim() ?? '';
  const paperDesc = row.paper_desc?.trim() ?? '';
  const examName = [paperName, paperDesc].filter(Boolean).join(' ');
  const standardName = row.standard_name == null ? '' : String(row.standard_name).trim();
  const subjectName = row.subject_name?.trim() ?? '';
  const openDate = row.open_date?.trim() ?? '';
  const closeDate = row.close_date?.trim() ?? '';

  return {
    id: `EXM-${row.id}`,
    paperId: toNumber(row.id),
    name: examName || 'Untitled exam',
    classLabel: `Grade ${standardName} - ${subjectName}`.trim(),
    type: row.exam_type?.trim() || '-',
    window: [openDate, closeDate].filter(Boolean).join(' - '),
    attempts: toNumber(row.attempt_allowed),
    questions: toNumber(row.total_ques),
    marks: toNumber(row.total_marks),
    status: row.active_exam === 'yes' ? 'Open' : 'Closed',
  };
}

/**
 * Loads question papers, optionally pinned to a single `exam_type`.
 *
 * With no `examType` the request omits the parameter, which is what `/lms/exam`
 * wants: the teacher and admin branches of the endpoint then return every type.
 * Bumping `reloadToken` re-runs the fetch, so a page that creates a paper can
 * refresh the grid without owning its state.
 */
export function useQuestionPaperRows(examType?: string, reloadToken?: number) {
  const [rows, setRows] = useState<ExamRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async (options?: { signal?: AbortSignal; showLoading?: boolean }) => {
    const { signal, showLoading = true } = options ?? {};
    const session = getQuestionPaperSession();

    if (showLoading) setIsLoading(true);
    setLoadError('');

    if (!session.subInstituteId || !session.userProfileName || !session.userId || !session.syear) {
      setRows([]);
      setLoadError('Exam session data is missing.');
      if (showLoading) setIsLoading(false);
      return;
    }

    try {
      const url = new URL(`${API_BASE_URL}/api/question-paper`);
      url.searchParams.set('sub_institute_id', session.subInstituteId);
      url.searchParams.set('syear', session.syear);
      url.searchParams.set('user_profile_name', session.userProfileName);
      url.searchParams.set('user_id', session.userId);
      if (examType) url.searchParams.set('exam_type', examType);

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal,
        headers: {
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
      });
      const payload = (await response.json()) as QuestionPaperApiResponse;

      if (!response.ok || payload.status_code !== 1) {
        throw new Error(payload.message || 'Failed to load exams');
      }

      setRows(Array.isArray(payload.data) ? payload.data.map(mapQuestionPaperToExam) : []);
    } catch (error) {
      if (signal?.aborted) return;
      setRows([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load exams');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [examType]);

  useEffect(() => {
    const controller = new AbortController();
    // Deferred a tick so the first render settles before the loading state
    // flips, matching how the exam page has always kicked this fetch off.
    const timeoutId = window.setTimeout(() => {
      load({ signal: controller.signal }).catch((error) => {
        if (!controller.signal.aborted) {
          console.error('Question paper list refresh error:', error);
        }
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [load, reloadToken]);

  return { rows, isLoading, loadError, reload: load };
}

export type QuestionPaperColumn =
  | 'exam'
  | 'class'
  | 'type'
  | 'window'
  | 'attempts'
  | 'questions'
  | 'marks'
  | 'status'
  | 'paper';

/** Every column, in the order `/lms/exam` shows them. */
export const ALL_QUESTION_PAPER_COLUMNS: QuestionPaperColumn[] = [
  'exam',
  'class',
  'type',
  'window',
  'attempts',
  'questions',
  'marks',
  'status',
  'paper',
];

const COLUMN_HEADINGS: Record<QuestionPaperColumn, string> = {
  exam: 'Exam',
  class: 'Class',
  type: 'Type',
  window: 'Window',
  attempts: 'Attempts',
  questions: 'Questions',
  marks: 'Marks',
  status: 'Status',
  paper: 'Paper',
};

const NUMERIC_COLUMNS = new Set<QuestionPaperColumn>(['attempts', 'questions', 'marks']);

const CELL_BASE = 'border-b border-[#E6EDF5] px-4 py-3 text-[14px] text-[#334155]';

function Cell({
  column,
  row,
  pdf,
  showOpenPdfOption,
}: {
  column: QuestionPaperColumn;
  row: ExamRecord;
  pdf: ExamPaperPdfController;
  showOpenPdfOption: boolean;
}) {
  switch (column) {
    case 'exam':
      return (
        <td className="border-b border-[#E6EDF5] px-4 py-3 align-top">
          <div className="min-w-[240px]">
            <p className="text-[14px] font-semibold text-[#1E293B]">{row.name}</p>
            <p className="mt-0.5 text-[12px] text-[#7B8798]">{row.id}</p>
          </div>
        </td>
      );
    case 'class':
      return <td className={CELL_BASE}>{row.classLabel}</td>;
    case 'type':
      return <td className={CELL_BASE}>{examTypeLabel(row.type)}</td>;
    case 'window':
      return <td className={CELL_BASE}>{row.window}</td>;
    case 'attempts':
      return <td className={`${CELL_BASE} text-right`}>{row.attempts}</td>;
    case 'questions':
      return <td className={`${CELL_BASE} text-right`}>{row.questions}</td>;
    case 'marks':
      return <td className={`${CELL_BASE} text-right`}>{row.marks}</td>;
    case 'status':
      return (
        <td className="border-b border-[#E6EDF5] px-4 py-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-semibold ${statusBadgeClasses[row.status]}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusDotClasses[row.status]}`} />
            {row.status}
          </span>
        </td>
      );
    case 'paper':
      return (
        <td className="border-b border-[#E6EDF5] px-4 py-3">
          <ExamPdfButton
            controller={pdf}
            paperId={row.paperId}
            examName={row.name}
            openHref={showOpenPdfOption ? examPaperPdfUrl(row.paperId) : undefined}
          />
        </td>
      );
  }
}

export function QuestionPaperGrid({
  rows,
  isLoading,
  loadError,
  columns = ALL_QUESTION_PAPER_COLUMNS,
  pdfController,
  noun = 'exams',
  searchPlaceholder = 'Search exams...',
  emptyMessage,
  showTypeFilter = true,
  showOpenPdfOption = false,
  toolbarActions,
  children,
}: {
  rows: ExamRecord[];
  isLoading: boolean;
  loadError: string;
  columns?: QuestionPaperColumn[];
  /**
   * Shared with the page when it also renders a template picker, so the notice
   * and the row buttons talk to one export controller.
   */
  pdfController?: ExamPaperPdfController;
  noun?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Hidden on a page pinned to one exam_type, where it can only ever filter to itself. */
  showTypeFilter?: boolean;
  /**
   * Adds an "Open PDF" menu item beside the Paper column's existing download
   * action, pointed at the stored file (`GET /api/question-paper/{id}/pdf`).
   * Off by default so `/lms/exam` (tab 242) keeps its single PDF button.
   */
  showOpenPdfOption?: boolean;
  toolbarActions?: ReactNode;
  /** Rendered between the toolbar and the table (publish notices and the like). */
  children?: ReactNode;
}) {
  const ownPdf = useExamPaperPdf();
  const pdf = pdfController ?? ownPdf;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [typeFilter, setTypeFilter] = useState('All types');

  // The status filter only earns its place next to a Status column; the type
  // filter only where more than one type can appear.
  const showStatusFilter = columns.includes('status');

  const filteredRows = useMemo(() => {
    const needle = search.toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(needle) ||
        row.id.toLowerCase().includes(needle) ||
        row.classLabel.toLowerCase().includes(needle);

      const matchesStatus =
        !showStatusFilter || statusFilter === 'All statuses' || row.status === statusFilter;

      const matchesType = !showTypeFilter || typeFilter === 'All types' || row.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [rows, search, statusFilter, typeFilter, showStatusFilter, showTypeFilter]);

  const minWidth = Math.max(520, columns.length * 130);

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-[320px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-[10px] border border-[#CFD9E6] bg-white pl-10 pr-4 text-[14px] text-[#172554] outline-none placeholder:text-[#94A3B8] focus:border-[#7C6CF4]"
            />
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            {showStatusFilter ? (
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 min-w-[140px] appearance-none rounded-[10px] border border-[#CFD9E6] bg-white px-3.5 pr-9 text-[14px] text-[#24324A] outline-none focus:border-[#7C6CF4]"
                >
                  <option>All statuses</option>
                  <option>Scheduled</option>
                  <option>Open</option>
                  <option>Draft</option>
                  <option>Closed</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8798]" />
              </div>
            ) : null}

            {showTypeFilter ? (
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="h-10 min-w-[130px] appearance-none rounded-[10px] border border-[#CFD9E6] bg-white px-3.5 pr-9 text-[14px] text-[#24324A] outline-none focus:border-[#7C6CF4]"
                >
                  <option>All types</option>
                  {examTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8798]" />
              </div>
            ) : null}
          </div>
        </div>

        {toolbarActions ? (
          <div className="flex flex-wrap items-center gap-2 self-start">{toolbarActions}</div>
        ) : null}
      </div>

      <p className="text-[14px] font-medium text-[#5F7087]">
        {filteredRows.length} of {rows.length} {noun}
      </p>

      <ExamPdfNotice controller={pdf} />

      {children}

      <div className="overflow-hidden rounded-[18px] border border-[#D9E3F0] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <div className="overflow-x-auto">
          <table
            className="w-full border-separate border-spacing-0"
            style={{ minWidth: `${minWidth}px` }}
          >
            <thead>
              <tr className="bg-[#F6F8FC]">
                {columns.map((column) => (
                  <th
                    key={column}
                    className={`border-b border-[#D9E3F0] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5F7087] ${
                      NUMERIC_COLUMNS.has(column) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {COLUMN_HEADINGS[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="bg-white">
                  {columns.map((column) => (
                    <Cell
                      key={column}
                      column={column}
                      row={row}
                      pdf={pdf}
                      showOpenPdfOption={showOpenPdfOption}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-[14px] text-[#6B7B91]">Loading {noun}...</div>
        ) : null}

        {!isLoading && loadError ? (
          <div className="px-6 py-12 text-center text-[14px] text-[#B45309]">{loadError}</div>
        ) : null}

        {!isLoading && !loadError && filteredRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-[14px] text-[#6B7B91]">
            {emptyMessage ?? `No ${noun} match the current search and filters.`}
          </div>
        ) : null}
      </div>
    </>
  );
}
