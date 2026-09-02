'use client';

import Link from 'next/link';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  GraduationCap,
  Hourglass,
  Info,
  Lock,
  Monitor,
  Plus,
  BookOpen,
  Play,
  Printer,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { ChatbotLayoutContext } from '@/app/components/DashboardShell';
import {
  SearchDropdown,
  type SearchDropdownValues,
} from '@/components/search-dropdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';

type ExamStatus = 'Scheduled' | 'Open' | 'Draft' | 'Closed';
type AudienceMode = 'Teacher' | 'Student';
type StudentLearningTab = 'PAL' | 'Online Exam' | 'Offline Exam';

type StudentConceptStatus = 'Mastered' | 'In progress' | 'Locked';

type LearningContent = {
  id: number;
  title: string;
  type: string;
  publishedBy: string;
  previewUrl?: string;
};

type StudentConceptProgress = {
  id: string;
  title: string;
  subtitle: string;
  mastery: number;
  attemptsLabel: string;
  attemptsCount: number;
  status: StudentConceptStatus;
  canLearn: boolean;
  canPractice: boolean;
  learningContent: LearningContent[];
};

type StudentChapterProgress = {
  chapterId: number;
  chapterTitle: string;
  badgeLabel: string;
  chapterMastery: number;
  conceptsMastered: string;
  averageMastery: string;
  practiceAttempts: string;
  masteryThreshold: string;
  concepts: StudentConceptProgress[];
};

type StudentPracticeQuestionOption = {
  id: string;
  label: string;
};

type StudentPracticeQuestion = {
  id: string;
  question: string;
  marks: number;
  options: StudentPracticeQuestionOption[];
};

type StudentPracticeAssessment = {
  conceptId: string;
  durationMinutes: number;
  masteryTarget: number;
  questions: StudentPracticeQuestion[];
};

type ExamRecord = {
  id: string;
  name: string;
  classLabel: string;
  type: string;
  window: string;
  attempts: number;
  questions: number;
  marks: number;
  status: ExamStatus;
};

type ApiQuestionPaperRecord = {
  id: number;
  grade_id?: number | string | null;
  standard_id?: number | string | null;
  subject_id?: number | string | null;
  grade?: number | string | null;
  standard?: number | string | null;
  subject?: number | string | null;
  paper_name?: string | null;
  paper_desc?: string | null;
  open_date?: string | null;
  close_date?: string | null;
  timelimit_enable?: number | string | null;
  time_allowed?: number | string | null;
  attempt_allowed?: number | string | null;
  total_ques?: number | string | null;
  total_marks?: number | string | null;
  question_ids?: string | null;
  shuffle_question?: number | string | null;
  show_feedback?: number | string | null;
  show_hide?: number | string | null;
  result_show_ans?: number | string | null;
  created_on?: string | null;
  created_by?: number | string | null;
  sub_institute_id?: number | string | null;
  syear?: number | string | null;
  exam_type?: string | null;
  ai_generated?: string | null;
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

type QuestionDetail = {
  id: number;
  question_type_id: number;
  grade_id: number;
  standard_id: number;
  subject_id: number;
  grade?: number;
  standard?: number;
  subject?: number;
  chapter_id: number | null;
  concept_id: number | null;
  topic_id: number | null;
  question_title: string;
  description: string;
  points: number;
  multiple_answer: number;
  concept: string | null;
  subconcept: string | null;
  pre_grade_topic: string | null;
  post_grade_topic: string | null;
  cross_curriculum_grade_topic: string | null;
  sub_institute_id: number;
  status: number;
  created_by: number;
  created_on: string;
  answer: unknown;
  hint_text: string;
  learning_outcome: string;
  options?: Array<{
    id?: number;
    option?: string;
    option_text?: string;
    answer?: string;
    value?: string;
  }>;
  question_options?: Array<{
    id?: number;
    option?: string;
    option_text?: string;
    answer?: string;
    value?: string;
  }>;
};

type QuestionPaperDetail = {
  id: number;
  grade_id: number;
  standard_id: number;
  subject_id: number;
  grade?: number;
  standard?: number;
  subject?: number;
  paper_name: string;
  paper_desc: string | null;
  open_date: string;
  close_date: string;
  timelimit_enable: number;
  time_allowed: number;
  total_marks: number;
  total_ques: number;
  question_ids: string;
  shuffle_question: number;
  attempt_allowed: number;
  show_feedback: number;
  show_hide: number;
  result_show_ans: number;
  created_on: string;
  created_by: number;
  sub_institute_id: number;
  syear: number;
  exam_type: string;
  ai_generated: string;
  standard_name?: string | number | null;
  grade_name?: string | null;
  subject_name?: string | null;
  difficulty_distribution: unknown;
  taxonomy_distribution: unknown;
  sections_config: unknown;
  question_arr: QuestionDetail[];
};

type QuestionPaperDetailResponse = {
  status_code: number;
  message: string;
  data: QuestionPaperDetail;
};

type CreateQuestionPaperApiResponse = {
  status_code?: number;
  message?: string;
  id?: number;
};

type LmsCoursesChapterRecord = {
  id: number;
  chapter_name?: string | null;
  total_content?: number | string | null;
  content_categories?: Record<string, unknown[]> | null;
};

type LmsCoursesSubjectRecord = {
  standard_name: string | number;
  subject_name: string;
  subject_id: number;
  standard_id: number;
  chapters?: LmsCoursesChapterRecord[];
};

type LmsCoursesApiResponse = {
  status_code?: number;
  message?: string;
  lms_subject?: Record<string, LmsCoursesSubjectRecord[] | undefined>;
};

type ChapterConceptRecord = {
  id: number | string;
  name?: string | null;
  chapter_id?: number | string | null;
};

type ChapterConceptOption = {
  value: string;
  label: string;
  chapterId: number;
};

type ChapterConceptsApiResponse = {
  status?: boolean;
  status_code?: number;
  message?: string;
  data?: ChapterConceptRecord[];
};

type ApiQuestionRecord = {
  id: number | string;
  question_title?: string | null;
  description?: string | null;
  concept_id?: number | string | null;
  concept_name?: string | null;
  concept?: {
    name?: string | null;
  } | null;
  question_type_id?: number | string | null;
  question_type_name?: string | null;
  question_type?: {
    name?: string | null;
  } | null;
  bloom_name?: string | null;
  bloom_level?: string | null;
  bloom?: {
    name?: string | null;
  } | null;
  difficulty_name?: string | null;
  difficulty_level?: string | null;
  difficulty?: string | null;
  points?: number | string | null;
  marks?: number | string | null;
};

type QuestionsApiResponse = {
  status?: boolean;
  status_code?: number;
  message?: string;
  data?: ApiQuestionRecord[];
};

type QuestionRecord = {
  id: string;
  question: string;
  concept: string;
  type: string;
  bloom: string;
  difficulty: string;
  marks: number;
};

const statusBadgeClasses: Record<ExamStatus, string> = {
  Scheduled: 'bg-[#FFF4E8] text-[#A45C14]',
  Open: 'bg-[#EAF9F1] text-[#14804A]',
  Draft: 'bg-[#EEF2F7] text-[#64748B]',
  Closed: 'bg-[#EEF2F7] text-[#475569]',
};

const statusDotClasses: Record<ExamStatus, string> = {
  Scheduled: 'bg-[#B96A1F]',
  Open: 'bg-[#14804A]',
  Draft: 'bg-[#7C8AA0]',
  Closed: 'bg-[#64748B]',
};

const examTypeOptions = [
  { label: 'Online', value: 'online' },
  { label: 'Offline', value: 'offline' },
];
const attemptsAllowedOptions = ['1 attempt', '2 attempts', '3 attempts'];

const innerTabs = [
  { label: 'Exams', icon: FileText, active: true },
  { label: 'Results dashboard', icon: GraduationCap, active: false },
];

const studentViewTabs: Array<{ label: StudentLearningTab; icon: LucideIcon; hidden?: boolean }> = [
  // PAL is hidden from the student learning tabs for now, not removed: the tab
  // panel below still renders it, so flipping `hidden` back off restores it.
  { label: 'PAL', icon: Monitor, hidden: true },
  { label: 'Online Exam', icon: FileText },
  { label: 'Offline Exam', icon: BookOpen },
];

const visibleStudentViewTabs = studentViewTabs.filter((tab) => !tab.hidden);

// Land on the first tab that is actually visible, so hiding PAL never leaves
// the student view opened on a tab with no button to switch away from.
const defaultStudentLearningTab: StudentLearningTab =
  visibleStudentViewTabs[0]?.label ?? studentViewTabs[0].label;

// Real student-facing PAL chapter/concept mastery is fetched from
// /api/pal/mastery-map/{learnerId} (see fetchStudentChapterProgress below);
// this only seeds the type-safe empty default before that fetch resolves.
const studentChapterProgressData: StudentChapterProgress[] = [];

const createExamSteps = [
  {
    id: 1,
    title: 'Scope',
    description: 'Standard, chapters, concepts',
  },
  {
    id: 2,
    title: 'Questions',
    description: 'Pick from question bank',
  },
  {
    id: 3,
    title: 'Configuration',
    description: 'Dates, attempts, marks',
  },
  {
    id: 4,
    title: 'Review & publish',
    description: '',
 },
];

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function getCreateExamSession() {
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

function mapQuestionPaperToExam(row: ApiQuestionPaperRecord): ExamRecord {
  const paperName = row.paper_name?.trim() ?? '';
  const paperDesc = row.paper_desc?.trim() ?? '';
  const examName = [paperName, paperDesc].filter(Boolean).join(' ');
  const standardName = row.standard_name == null ? '' : String(row.standard_name).trim();
  const subjectName = row.subject_name?.trim() ?? '';
  const openDate = row.open_date?.trim() ?? '';
  const closeDate = row.close_date?.trim() ?? '';

  return {
    id: `EXM-${row.id}`,
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

// --- PAL mastery map (GET /api/pal/mastery-map/{learnerId}) ---------------

type MasteryMapConcept = {
  concept_id: number | string;
  concept_name?: string | null;
  mastery_score?: number | string | null;
  status?: string | null;
};

type MasteryMapData = {
  concepts?: MasteryMapConcept[];
  overall_mastery?: number | string | null;
  mastered_concepts?: number | string | null;
};

type MasteryMapApiResponse = {
  success?: boolean;
  message?: string;
  data?: MasteryMapData;
};

const CONCEPT_MASTERY_THRESHOLD = 75;

function mapMasteryMapToChapterProgress(payload: MasteryMapApiResponse): StudentChapterProgress[] {
  const data = payload.data;
  const concepts = data?.concepts ?? [];
  if (concepts.length === 0) return [];

  const mappedConcepts: StudentConceptProgress[] = concepts.map((concept) => {
    const mastery = Math.round(toNumber(concept.mastery_score));
    const isMastered = readString(concept.status).toLowerCase() === 'mastered' || mastery >= CONCEPT_MASTERY_THRESHOLD;
    const status: StudentConceptStatus = isMastered ? 'Mastered' : 'In progress';

    return {
      id: String(concept.concept_id),
      title: readString(concept.concept_name) || `Concept ${concept.concept_id}`,
      subtitle: isMastered ? 'Mastered' : `In progress · ${mastery}% mastery`,
      mastery,
      attemptsLabel: `${mastery}%`,
      attemptsCount: 0,
      status,
      canLearn: true,
      canPractice: !isMastered,
      learningContent: [],
    };
  });

  const conceptsMasteredCount = mappedConcepts.filter((concept) => concept.status === 'Mastered').length;
  const overallMastery = Math.round(toNumber(data?.overall_mastery));

  return [
    {
      chapterId: 0,
      chapterTitle: 'Concept mastery',
      badgeLabel: 'Based on your practice history',
      chapterMastery: overallMastery,
      conceptsMastered: `${conceptsMasteredCount} of ${mappedConcepts.length}`,
      averageMastery: `${overallMastery}%`,
      practiceAttempts: '-',
      masteryThreshold: `${CONCEPT_MASTERY_THRESHOLD}%`,
      concepts: mappedConcepts,
    },
  ];
}

// --- Adaptive practice (GET /lms/adaptive-practice, POST /lms/submit-practice) ---

type AdaptivePracticeOption = {
  id: number | string;
  answer?: string | null;
};

type AdaptivePracticeQuestion = {
  id: number | string;
  question_title?: string | null;
  points?: number | string | null;
  options?: AdaptivePracticeOption[] | null;
};

type AdaptivePracticeApiResponse = {
  status_code?: number;
  message?: string;
  data?: {
    questions?: AdaptivePracticeQuestion[];
  };
};

type SubmitPracticeApiResponse = {
  status_code?: number;
  message?: string;
  data?: {
    summary?: {
      percentage?: number | string;
    };
  };
};

function mapAdaptivePracticeToAssessment(
  conceptId: string,
  payload: AdaptivePracticeApiResponse
): StudentPracticeAssessment {
  const rawQuestions = payload.data?.questions ?? [];

  const questions: StudentPracticeQuestion[] = rawQuestions
    .filter((question) => Array.isArray(question.options) && question.options.length > 0)
    .map((question) => ({
      id: String(question.id),
      question: readString(question.question_title) || 'Untitled question',
      marks: toNumber(question.points) || 1,
      options: (question.options ?? []).map((option) => ({
        id: String(option.id),
        label: readString(option.answer) || 'Option',
      })),
    }));

  return {
    conceptId,
    durationMinutes: Math.max(2, Math.ceil(questions.length * 1.5)),
    masteryTarget: CONCEPT_MASTERY_THRESHOLD,
    questions,
  };
}

function toDisplayText(value: string | number | null | undefined): string {
  return value == null ? '' : String(value).trim();
}

function getSingleDropdownValue(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return value || '';
}

function getLmsSubjectRows(payload: LmsCoursesApiResponse): LmsCoursesSubjectRecord[] {
  return Object.values(payload.lms_subject ?? {}).reduce<LmsCoursesSubjectRecord[]>(
    (rows, group) => {
      if (Array.isArray(group)) {
        rows.push(...group);
      }
      return rows;
    },
    []
  );
}

function formatPracticeAttemptSubtitle(attemptsCount: number, masteryTarget: number): string {
  const attemptLabel = attemptsCount === 1 ? '1 attempt' : `${attemptsCount} attempts`;
  return `${attemptLabel} · unlimited retakes until ${masteryTarget}%`;
}

function formatDurationLabel(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getStudentExamErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unable to load question papers.';

  if (!message) {
    return 'Unable to load question papers.';
  }

  if (
    message.includes('SQLSTATE') ||
    message.includes('Unknown column') ||
    message.includes('on clause')
  ) {
    return 'We could not load exams right now because the exam service returned an invalid response. Please try again shortly or contact your school administrator.';
  }

  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('ERR_CONNECTION')
  ) {
    return 'We could not connect to the exam service. Please check your connection and try again.';
  }

  return message;
}

interface QuestionPaperViewProps {
  paper: QuestionPaperDetail;
  onBack: () => void;
}

interface PrintableQuestionPaperProps {
  paper: QuestionPaperDetail;
  onPrint: () => void;
}

function getPrintableQuestionOptions(question: QuestionDetail): string[] {
  const rawOptions = question.options || question.question_options || [];

  return rawOptions
    .map(
      (option) =>
        option.option_text ||
        option.option ||
        option.answer ||
        option.value ||
        ''
    )
    .filter(Boolean);
}

function PrintableQuestionPaper({
  paper,
  onPrint,
}: PrintableQuestionPaperProps) {
  return (
    <section className="offline-question-paper rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <div className="no-print mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-slate-600">
            {paper.grade_name || 'Section'} - {paper.subject_name || 'Subject'} - Grade{' '}
            {paper.standard_name || paper.standard_id}
          </p>
        </div>

        <Button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          <Printer size={18} />
          Print question paper
        </Button>
      </div>

      <div className="mx-auto max-w-4xl rounded-2xl border-2 border-slate-200 bg-white px-8 py-8 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0">
        <header className="border-b border-slate-200 pb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            {paper.paper_name}
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            {paper.grade_name || 'Section'} - {paper.subject_name || 'Subject'} - Grade{' '}
            {paper.standard_name || paper.standard_id}
          </p>

          {paper.paper_desc ? (
            <p className="mt-1 text-sm text-slate-500">
              {paper.paper_desc}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-slate-700">
            <span>Total questions: {paper.total_ques}</span>
            <span>Total marks: {paper.total_marks}</span>
            {paper.timelimit_enable === 1 ? (
              <span>Duration: {paper.time_allowed} min</span>
            ) : null}
          </div>
        </header>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 print:bg-white">
          <h2 className="text-sm font-bold text-slate-900">
            Instructions
          </h2>

          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm leading-6 text-slate-700">
            <li>All questions are compulsory.</li>
            <li>Marks for each question are shown in brackets.</li>
            <li>Select or write the correct answer as required.</li>
          </ol>
        </div>

        <div className="mt-7 space-y-8">
          {paper.question_arr?.map((question, index) => {
            const options = getPrintableQuestionOptions(question);

            return (
              <article
                key={question.id}
                className="break-inside-avoid"
              >
                <div className="flex items-start justify-between gap-5">
                  <h3 className="text-sm font-semibold leading-7 text-slate-900">
                    {index + 1}. {question.question_title}
                  </h3>

                  <span className="shrink-0 text-sm font-medium text-violet-600">
                    ({question.points} {question.points === 1 ? 'mark' : 'marks'})
                  </span>
                </div>

                {question.description ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {question.description}
                  </p>
                ) : null}

                {options.length > 0 ? (
                  <div className="mt-3 space-y-2 pl-3">
                    {options.map((option, optionIndex) => (
                      <div
                        key={`${question.id}-${optionIndex}`}
                        className="text-sm text-slate-800"
                      >
                        {String.fromCharCode(65 + optionIndex)}. {option}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="h-6 border-b border-slate-300" />
                    <div className="h-6 border-b border-slate-300" />
                    <div className="h-6 border-b border-slate-300" />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function QuestionPaperView({ paper, onBack }: QuestionPaperViewProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const handleSubmitExam = async () => {
    const session = getCreateExamSession();

    if (!session.subInstituteId || !session.userId) {
      setSubmitError('Your session has expired. Please sign in again and retry.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');

      const formData = new FormData();
      formData.append('questionpaper_id', String(paper.id));
      formData.append('sub_institute_id', session.subInstituteId);
      formData.append('user_id', session.userId);
      formData.append('type', 'JSON');

      (paper.question_arr || []).forEach((question) => {
        formData.append(`answer_narrative[${question.id}]`, answers[question.id] ?? '');
      });

      const response = await fetch(`${API_BASE_URL}/lms/online_exam`, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || Number(result?.status_code) !== 1) {
        throw new Error(result?.message || 'Unable to submit the exam. Please try again.');
      }

      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Unable to submit the exam. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={40} />
        <p className="text-lg font-semibold text-slate-900">Exam submitted</p>
        <p className="mt-1 text-sm text-slate-500">Your answers have been recorded.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Back to exams
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back to exams
            </button>

            <h1 className="text-2xl font-bold text-slate-900">
              {paper.paper_name}
            </h1>

            {paper.paper_desc ? (
              <p className="mt-2 text-sm text-slate-600">
                {paper.paper_desc}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
              {paper.total_ques} questions
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
              {paper.total_marks} marks
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
              {paper.time_allowed} min
            </span>
            <span className="rounded-full bg-violet-50 px-3 py-1.5 text-sm capitalize text-violet-700">
              {paper.exam_type}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {paper.question_arr?.length > 0 ? (
          paper.question_arr.map((question, index) => (
            <article
              key={question.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 font-semibold text-violet-700">
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-7 text-slate-900">
                      {question.question_title}
                    </h2>

                    {question.description ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {question.description}
                      </p>
                    ) : null}

                    {question.learning_outcome ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Learning outcome: {question.learning_outcome}
                      </p>
                    ) : null}

                    {question.hint_text ? (
                      <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                        Hint: {question.hint_text}
                      </div>
                    ) : null}
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                  {question.points} {question.points === 1 ? 'mark' : 'marks'}
                </span>
              </div>

              <div className="mt-5">
                <textarea
                  name={`answer_${question.id}`}
                  rows={4}
                  value={answers[question.id] ?? ''}
                  onChange={(event) => handleAnswerChange(question.id, event.target.value)}
                  placeholder="Write your answer here..."
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="font-medium text-slate-700">
              No questions found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              This question paper currently has no questions.
            </p>
          </div>
        )}
      </div>

      {paper.question_arr?.length > 0 ? (
        <div className="sticky bottom-4 flex flex-col items-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          {submitError ? (
            <p className="text-sm font-medium text-red-600">{submitError}</p>
          ) : null}
          <button
            type="button"
            onClick={handleSubmitExam}
            disabled={isSubmitting}
            className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        </div>
      ) : null}
    </div>
  );
}


export default function StudentHomeworkIndexPage() {
  const { isChatbotOpen } = useContext(ChatbotLayoutContext);
  // Follows the signed-in profile and is not switchable. The Viewing-as toggle is
  // gone, so a stored 'Student' preference would otherwise have left a teacher in
  // the student view with no control to leave it.
  const audienceMode: AudienceMode =
    getCreateExamSession().userProfileName.trim().toUpperCase() === 'STUDENT'
      ? 'Student'
      : 'Teacher';
  const [apiExams, setApiExams] = useState<ExamRecord[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [examLoadError, setExamLoadError] = useState('');
  const [publishSuccessMessage, setPublishSuccessMessage] = useState('');
  const [lmsCourses, setLmsCourses] = useState<LmsCoursesSubjectRecord[]>([]);
  const [isLoadingLmsCourses, setIsLoadingLmsCourses] = useState(false);
  const [lmsCoursesError, setLmsCoursesError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [studentLearningTab, setStudentLearningTab] = useState<StudentLearningTab>(defaultStudentLearningTab);
  const [examFilters, setExamFilters] = useState({
    grade_id: '',
    standard_id: '',
    subject_id: '',
  });
  const [studentQuestionPapers, setStudentQuestionPapers] = useState<ApiQuestionPaperRecord[]>([]);
  const [isSearchingStudentExams, setIsSearchingStudentExams] = useState(false);
  const [studentExamSearchError, setStudentExamSearchError] = useState('');
  const [hasSearchedStudentExams, setHasSearchedStudentExams] = useState(false);
  const [offlineExamPapers, setOfflineExamPapers] = useState<ApiQuestionPaperRecord[]>([]);
  const [isLoadingOfflineExams, setIsLoadingOfflineExams] = useState(false);
  const [offlineExamError, setOfflineExamError] = useState('');
  const [hasSearchedOfflineExams, setHasSearchedOfflineExams] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<QuestionPaperDetail | null>(null);
  const [selectedPaperContext, setSelectedPaperContext] = useState<'online' | 'offline' | null>(null);
  const [paperLoading, setPaperLoading] = useState(false);
  const [paperError, setPaperError] = useState('');
  const [offlineExamFilters, setOfflineExamFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    subject: '',
  });
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [createExamStep, setCreateExamStep] = useState(1);
  const [createExamFilters, setCreateExamFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    subject: '',
  });
  const [selectedStandard, setSelectedStandard] = useState('');
  const [selectedStandardId, setSelectedStandardId] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [conceptOptions, setConceptOptions] = useState<ChapterConceptOption[]>([]);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [isConceptLoading, setIsConceptLoading] = useState(false);
  const [conceptError, setConceptError] = useState('');
  const [questions, setQuestions] = useState<ApiQuestionRecord[]>([]);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');
  // DOK / Bloom filter options for the question-bank step. Fetched from
  // /api/question-mapping-levels (lms_mapping_type rows) — never hardcoded, so
  // new levels added in the DB appear automatically.
  const [mappingLevels, setMappingLevels] = useState<{
    dok: Array<{ id: number; name: string }>;
    bloom: Array<{ id: number; name: string }>;
  }>({ dok: [], bloom: [] });
  const [selectedDokLevels, setSelectedDokLevels] = useState<number[]>([]);
  const [selectedBloomLevels, setSelectedBloomLevels] = useState<number[]>([]);
  const [openLevelDropdown, setOpenLevelDropdown] = useState<'dok' | 'bloom' | null>(null);
  const [studentChapterProgressList, setStudentChapterProgressList] =
    useState<StudentChapterProgress[]>(studentChapterProgressData);
  const [studentSelectedChapterId, setStudentSelectedChapterId] = useState<number>(
    studentChapterProgressData[0]?.chapterId ?? 0
  );
  const [isStudentMasteryLoading, setIsStudentMasteryLoading] = useState(false);
  const [studentMasteryError, setStudentMasteryError] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<StudentConceptProgress | null>(null);
  const [isLearnDrawerOpen, setIsLearnDrawerOpen] = useState(false);
  const [activePracticeConceptId, setActivePracticeConceptId] = useState<string | null>(null);
  const [activePracticeAssessment, setActivePracticeAssessment] = useState<StudentPracticeAssessment | null>(null);
  const [isPracticeLoading, setIsPracticeLoading] = useState(false);
  const [practiceLoadError, setPracticeLoadError] = useState('');
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const [practiceTimeLeft, setPracticeTimeLeft] = useState(0);

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [examName, setExamName] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examType, setExamType] = useState('');
  const [attemptsAllowed, setAttemptsAllowed] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const scopeScrollRef = useRef<HTMLDivElement | null>(null);
  const exams = apiExams;
  const onlineExamSession = getCreateExamSession();
  const isStudentProfile = onlineExamSession.userProfileName.trim().toUpperCase() === 'STUDENT';
  const activeStudentChapter = useMemo(
    () =>
      studentChapterProgressList.find((chapter) => chapter.chapterId === studentSelectedChapterId) ??
      studentChapterProgressList[0],
    [studentChapterProgressList, studentSelectedChapterId]
  );
  const activePracticeConcept = useMemo(
    () =>
      activeStudentChapter?.concepts.find((concept) => concept.id === activePracticeConceptId) ?? null,
    [activePracticeConceptId, activeStudentChapter]
  );
  const practiceAnsweredCount = activePracticeAssessment
    ? activePracticeAssessment.questions.filter((question) => Boolean(practiceAnswers[question.id])).length
    : 0;
  const hasAnsweredAllPracticeQuestions = activePracticeAssessment
    ? practiceAnsweredCount === activePracticeAssessment.questions.length
    : false;
  const handleOnlineExamDropdownChange = (values: SearchDropdownValues) => {
    const gradeId = Array.isArray(values.section)
      ? values.section[0] || ''
      : values.section || '';
    const standardId = Array.isArray(values.standard)
      ? values.standard[0] || ''
      : values.standard || '';
    const subjectId = Array.isArray(values.subject)
      ? values.subject[0] || ''
      : values.subject || '';

    setExamFilters({
      grade_id: String(gradeId),
      standard_id: String(standardId),
      subject_id: String(subjectId),
    });

    setSelectedPaper(null);
    setPaperError('');
    setStudentQuestionPapers([]);
    setHasSearchedStudentExams(false);
    setStudentExamSearchError('');
  };

  const clearCreateExamSelections = () => {
    setSelectedChapters([]);
    setConceptOptions([]);
    setSelectedConcepts([]);
    setConceptError('');
    setQuestions([]);
    setQuestionsError('');
    setSelectedQuestions([]);
  };

  const handleExamDropdownChange = (values: SearchDropdownValues) => {
    setCreateExamFilters({
      section: values.section,
      standard: values.standard,
      subject: values.subject,
    });
  };

  const handleOfflineExamDropdownChange = (values: SearchDropdownValues) => {
    setOfflineExamFilters({
      section: values.section,
      standard: values.standard,
      subject: values.subject,
    });
    setSelectedPaper(null);
    setSelectedPaperContext(null);
    setPaperError('');
  };

  const fetchOfflineQuestionPaperDetail = useCallback(async (
    paper: ApiQuestionPaperRecord
  ) => {
    const session = getCreateExamSession();

    if (!session.subInstituteId) {
      setPaperError('Sub-institute ID is missing.');
      return;
    }

    try {
      setPaperLoading(true);
      setPaperError('');
      setSelectedPaper(null);
      setSelectedPaperContext('offline');

      const queryParams = new URLSearchParams({
        sub_institute_id: session.subInstituteId,
      });

      const response = await fetch(
        `${API_BASE_URL}/api/question-paper/${paper.id}?${queryParams.toString()}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        }
      );

      const result = (await response.json()) as QuestionPaperDetailResponse;

      if (!response.ok) {
        throw new Error(
          getStudentExamErrorMessage(
            result?.message || `Request failed with status ${response.status}`
          )
        );
      }

      if (Number(result?.status_code) !== 1 || !result?.data) {
        throw new Error(
          getStudentExamErrorMessage(
            result?.message || 'Unable to load question paper.'
          )
        );
      }

      setSelectedPaper({
        ...result.data,
        standard_name: result.data.standard_name || toDisplayText(paper.standard_name),
        grade_name: result.data.grade_name || paper.grade_name || '',
        subject_name: result.data.subject_name || paper.subject_name || '',
      });
    } catch (error) {
      const friendlyMessage = getStudentExamErrorMessage(error);
      setSelectedPaper(null);
      setSelectedPaperContext(null);
      setPaperError(friendlyMessage);
    } finally {
      setPaperLoading(false);
    }
  }, []);

  const handleOpenStudentQuestionPaper = async (
    paperId: number,
    context: 'online' | 'offline'
  ) => {
    const session = getCreateExamSession();

    if (!session.subInstituteId) {
      setPaperError('Sub-institute ID is missing.');
      return;
    }

    try {
      setPaperLoading(true);
      setPaperError('');
      setSelectedPaper(null);
      setSelectedPaperContext(context);

      const queryParams = new URLSearchParams({
        sub_institute_id: session.subInstituteId,
      });

      const response = await fetch(
        `${API_BASE_URL}/api/question-paper/${paperId}?${queryParams.toString()}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        }
      );

      const result = (await response.json()) as QuestionPaperDetailResponse;

      if (!response.ok) {
        throw new Error(
          getStudentExamErrorMessage(
            result?.message || `Request failed with status ${response.status}`
          )
        );
      }

      if (Number(result?.status_code) !== 1 || !result?.data) {
        throw new Error(
          getStudentExamErrorMessage(
            result?.message || 'Unable to load the question paper.'
          )
        );
      }

      setSelectedPaper(result.data);
    } catch (error) {
      const friendlyMessage = getStudentExamErrorMessage(error);
      setSelectedPaperContext(null);
      setPaperError(friendlyMessage);
    } finally {
      setPaperLoading(false);
    }
  };

  const fetchOnlineExams = useCallback(async (includeFilters: boolean) => {
    const session = getCreateExamSession();

    if (
      !session.subInstituteId ||
      !session.syear ||
      !session.userProfileName ||
      !session.userId
    ) {
      setStudentExamSearchError('Required login session information is missing.');
      return;
    }

    const queryParams = new URLSearchParams({
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_profile_name: session.userProfileName,
      user_id: session.userId,
    });

    if (includeFilters) {
      const { grade_id, standard_id, subject_id } = examFilters;

      if (!grade_id) {
        setStudentExamSearchError('Please select a section.');
        return;
      }

      if (!standard_id) {
        setStudentExamSearchError('Please select a standard.');
        return;
      }

      if (!subject_id) {
        setStudentExamSearchError('Please select a subject.');
        return;
      }

      queryParams.set('grade_id', grade_id);
      queryParams.set('standard_id', standard_id);
      queryParams.set('subject_id', subject_id);
    }

    try {
      setIsSearchingStudentExams(true);
      setHasSearchedStudentExams(true);
      setStudentExamSearchError('');
      setSelectedPaper(null);
      setPaperError('');
      setStudentQuestionPapers([]);

      const response = await fetch(
        `${API_BASE_URL}/api/question-paper?${queryParams.toString()}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        }
      );

      const result = (await response.json()) as QuestionPaperApiResponse;

      if (!response.ok) {
        throw new Error(
          getStudentExamErrorMessage(
            result?.message || `Request failed with status ${response.status}`
          )
        );
      }

      if (Number(result?.status_code) !== 1 || !Array.isArray(result?.data)) {
        throw new Error(
          getStudentExamErrorMessage(
            result?.message || 'No question papers found.'
          )
        );
      }

      setStudentQuestionPapers(result.data);
    } catch (error) {
      const friendlyMessage = getStudentExamErrorMessage(error);
      setStudentQuestionPapers([]);
      setStudentExamSearchError(friendlyMessage);
    } finally {
      setIsSearchingStudentExams(false);
    }
  }, [examFilters]);

  const handleOnlineExamSearch = useCallback(() => {
    void fetchOnlineExams(true);
  }, [fetchOnlineExams]);

  const fetchOfflineExams = useCallback(async () => {
    const gradeId = getSingleDropdownValue(offlineExamFilters.section);
    const standardId = getSingleDropdownValue(offlineExamFilters.standard);
    const subjectId = getSingleDropdownValue(offlineExamFilters.subject);

    if (!gradeId || !standardId || !subjectId) {
      setOfflineExamPapers([]);
      setHasSearchedOfflineExams(false);
      setOfflineExamError('');
      return;
    }

    const session = getCreateExamSession();

    if (
      !session.subInstituteId ||
      !session.syear ||
      !session.userProfileName ||
      !session.userId
    ) {
      setOfflineExamPapers([]);
      setHasSearchedOfflineExams(false);
      setOfflineExamError('Required login session information is missing.');
      return;
    }

    try {
      setIsLoadingOfflineExams(true);
      setHasSearchedOfflineExams(true);
      setOfflineExamError('');
      setOfflineExamPapers([]);
      setSelectedPaper(null);
      setSelectedPaperContext(null);
      setPaperError('');

      const queryParams = new URLSearchParams({
        sub_institute_id: session.subInstituteId,
        syear: session.syear,
        user_profile_name: session.userProfileName.toUpperCase(),
        user_id: session.userId,
        grade_id: gradeId,
        standard_id: standardId,
        subject_id: subjectId,
        exam_type: 'offline',
      });

      const response = await fetch(
        `${API_BASE_URL}/api/question-paper?${queryParams.toString()}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        }
      );

      const result = (await response.json()) as QuestionPaperApiResponse;

      if (!response.ok) {
        throw new Error(
          getStudentExamErrorMessage(
            result?.message || `Request failed with status ${response.status}`
          )
        );
      }

      if (Number(result?.status_code) !== 1 || !Array.isArray(result?.data)) {
        throw new Error(
          getStudentExamErrorMessage(
            result?.message || 'No offline exams found.'
          )
        );
      }

      setOfflineExamPapers(result.data);

      if (result.data.length > 0) {
        await fetchOfflineQuestionPaperDetail(result.data[0]);
      }
    } catch (error) {
      const friendlyMessage = getStudentExamErrorMessage(error);
      setOfflineExamPapers([]);
      setOfflineExamError(friendlyMessage);
    } finally {
      setIsLoadingOfflineExams(false);
    }
  }, [fetchOfflineQuestionPaperDetail, offlineExamFilters]);

  useEffect(() => {
    if (!isStudentProfile) {
      return;
    }

    void fetchOnlineExams(false);
  }, [fetchOnlineExams, isStudentProfile]);

  useEffect(() => {
    void fetchOfflineExams();
  }, [fetchOfflineExams]);
 

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch =
        exam.name.toLowerCase().includes(search.toLowerCase()) ||
        exam.id.toLowerCase().includes(search.toLowerCase()) ||
        exam.classLabel.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'All statuses' || exam.status === statusFilter;

      const matchesType = typeFilter === 'All types' || exam.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [exams, search, statusFilter, typeFilter]);

  const chapterOptions = useMemo(() => {
    if (selectedStandardId == null || selectedSubjectId == null) return [];

    const chaptersMap = new Map<number, LmsCoursesChapterRecord>();

    lmsCourses
      .filter(
        (row) => row.standard_id === selectedStandardId && row.subject_id === selectedSubjectId
      )
      .forEach((row) => {
        row.chapters?.forEach((chapter) => {
          const existingChapter = chaptersMap.get(chapter.id);
          if (!existingChapter) {
            chaptersMap.set(chapter.id, {
              ...chapter,
              content_categories: { ...(chapter.content_categories ?? {}) },
            });
            return;
          }

          const mergedCategories = {
            ...(existingChapter.content_categories ?? {}),
            ...(chapter.content_categories ?? {}),
          };

          chaptersMap.set(chapter.id, {
            ...existingChapter,
            ...chapter,
            content_categories: mergedCategories,
          });
        });
      });

    return Array.from(chaptersMap.values()).sort((a, b) =>
      toDisplayText(a.chapter_name).localeCompare(toDisplayText(b.chapter_name), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );
  }, [lmsCourses, selectedStandardId, selectedSubjectId]);

  const selectedChapterOptions = useMemo(() => {
    const chapterMap = new Map(
      chapterOptions.map((chapter) => [chapter.id, toDisplayText(chapter.chapter_name) || 'Untitled chapter'])
    );

    return selectedChapters.map((chapterId) => ({
      value: String(chapterId),
      label: chapterMap.get(chapterId) || 'Untitled chapter',
    }));
  }, [chapterOptions, selectedChapters]);

  const toggleChapter = (chapterId: number) => {
    setQuestions([]);
    setSelectedQuestions([]);
    setQuestionsError('');
    setIsQuestionsLoading(false);
    setSelectedChapters((current) => {
      if (current.includes(chapterId)) {
        return current.filter((item) => item !== chapterId);
      }

      return [...current, chapterId];
    });
  };

  const toggleConcept = (conceptId: string) => {
    setQuestions([]);
    setSelectedQuestions([]);
    setQuestionsError('');
    setIsQuestionsLoading(false);
    setSelectedConcepts((current) => {
      if (current.includes(conceptId)) {
        return current.filter((item) => item !== conceptId);
      }

      return [...current, conceptId];
    });
  };

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestions((current) => {
      if (current.includes(questionId)) {
        return current.filter((item) => item !== questionId);
      }

      return [...current, questionId];
    });
  };

  const toggleAllQuestions = () => {
    setSelectedQuestions((current) =>
 current.length === questionRows.length ? [] : questionRows.map((question) => question.id)
    );
  };

  const conceptNameMap = useMemo(() => {
    return Object.fromEntries(
      conceptOptions.map((concept) => [Number(concept.value), concept.label])
    );
  }, [conceptOptions]);

  const getQuestionTypeLabel = (questionTypeId: number) => {
    const typeMap: Record<number, string> = {
      1: 'MCQ',
      2: 'True / False',
      3: 'Short Answer',
      4: 'Long Answer',
      5: 'Fill in the Blank',
    };

    return typeMap[Number(questionTypeId)] ?? '—';
  };

  const questionRows = useMemo<QuestionRecord[]>(() => {
    return questions.map((question) => ({
      id: String(question.id),
      question: question.question_title || question.description || 'Untitled question',
      concept:
        question.concept_name ||
        question.concept?.name ||
        conceptNameMap[Number(question.concept_id)] ||
        '—',
      type:
        question.question_type_name ||
        question.question_type?.name ||
        getQuestionTypeLabel(toNumber(question.question_type_id)),
      bloom:
        question.bloom_name ||
        question.bloom_level ||
        question.bloom?.name ||
        '—',
      difficulty:
        question.difficulty_name ||
        question.difficulty_level ||
        question.difficulty ||
        '—',
      marks: Number(question.points ?? question.marks ?? 0),
    }));
  }, [conceptNameMap, questions]);

  const selectedQuestionRows = useMemo(
    () => questionRows.filter((question) => selectedQuestions.includes(question.id)),
    [questionRows, selectedQuestions]
  );

  const openCreateExamModal = () => {
    setPublishSuccessMessage('');
    resetCreateExamForm();
    setIsCreateExamOpen(true);
  };

  const resetCreateExamForm = () => {
    setCreateExamStep(1);
    setCreateExamFilters({
      section: '',
      standard: '',
      subject: '',
    });
    setSelectedStandard('');
    setSelectedStandardId(null);
    setSelectedSubject('');
    setSelectedSubjectId(null);
    clearCreateExamSelections();
    setIsConceptLoading(false);
    setIsQuestionsLoading(false);
    setQuestionsError('');
    setSelectedDokLevels([]);
    setSelectedBloomLevels([]);
    setOpenLevelDropdown(null);
    setExamName('');
    setExamDescription('');
    setExamType('');
    setAttemptsAllowed('');
    setOpenDate('');
    setCloseDate('');
    setTimeLimitMinutes('');
    setIsPublishing(false);
    setPublishError('');
  };

  const closeCreateExamModal = () => {
    setIsCreateExamOpen(false);
    resetCreateExamForm();
  };

  const closePracticeAssessmentModal = () => {
    setActivePracticeConceptId(null);
    setPracticeAnswers({});
    setPracticeTimeLeft(0);
  };

  const handleOpenLearnContent = (concept: StudentConceptProgress) => {
    setSelectedConcept(concept);
    setIsLearnDrawerOpen(true);
  };

  const handleCloseLearnContent = () => {
    setIsLearnDrawerOpen(false);

    window.setTimeout(() => {
      setSelectedConcept(null);
    }, 200);
  };

  const printOfflineQuestionPaper = () => {
    window.print();
  };

  const openPracticeAssessmentModal = async (conceptId: string) => {
    const session = getCreateExamSession();

    setActivePracticeConceptId(conceptId);
    setActivePracticeAssessment(null);
    setPracticeAnswers({});
    setPracticeLoadError('');

    if (!session.userId) {
      setPracticeLoadError('Your session has expired. Please sign in again and retry.');
      return;
    }

    try {
      setIsPracticeLoading(true);

      const url = new URL(`${API_BASE_URL}/lms/adaptive-practice`);
      url.searchParams.set('type', 'API');
      url.searchParams.set('student_id', session.userId);
      url.searchParams.set('concept_id', conceptId);
      url.searchParams.set('question_count', '5');
      if (session.subInstituteId) {
        url.searchParams.set('sub_institute_id', session.subInstituteId);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
      });
      const payload = (await response.json().catch(() => null)) as AdaptivePracticeApiResponse | null;

      if (!response.ok || Number(payload?.status_code) !== 1) {
        throw new Error(payload?.message || 'Unable to load practice questions.');
      }

      const assessment = mapAdaptivePracticeToAssessment(conceptId, payload ?? {});
      if (assessment.questions.length === 0) {
        throw new Error('No practice questions are available for this concept right now.');
      }

      setActivePracticeAssessment(assessment);
      setPracticeTimeLeft(assessment.durationMinutes * 60);
    } catch (error) {
      setPracticeLoadError(
        error instanceof Error ? error.message : 'Unable to load practice questions.'
      );
    } finally {
      setIsPracticeLoading(false);
    }
  };

  const selectedQuestionMarks = useMemo(() => {
    return questionRows
      .filter((question) => selectedQuestions.includes(question.id))
      .reduce((total, question) => total + question.marks, 0);
  }, [questionRows, selectedQuestions]);

  const allQuestionsSelected =
    questionRows.length > 0 && selectedQuestions.length === questionRows.length;

  const formatDisplayDate = (value: string) => {
    if (!value) return '-';

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (value: string) => {
    if (!value) return '';

    const hasTime = value.includes('T') || value.includes(' ');
    const normalizedValue = hasTime ? value.replace(' ', 'T') : `${value}T00:00:00`;
    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
      return hasTime ? value.replace('T', ' ') : `${value} 00:00:00`;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const refreshExamList = useCallback(async (options?: { signal?: AbortSignal; showLoading?: boolean }) => {
    const { signal, showLoading = true } = options ?? {};
    const session = getCreateExamSession();

    if (showLoading) {
      setIsLoadingExams(true);
    }
    setExamLoadError('');

    if (!session.subInstituteId || !session.userProfileName || !session.userId || !session.syear) {
      setApiExams([]);
      setExamLoadError('Exam session data is missing.');
      if (showLoading) {
        setIsLoadingExams(false);
      }
      return;
    }

    try {
      const url = new URL(`${API_BASE_URL}/api/question-paper`);
      url.searchParams.set('sub_institute_id', session.subInstituteId);
      url.searchParams.set('syear', session.syear);
      url.searchParams.set('user_profile_name', session.userProfileName);
      url.searchParams.set('user_id', session.userId);

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

      const mappedExams = Array.isArray(payload.data) ? payload.data.map(mapQuestionPaperToExam) : [];
      setApiExams(mappedExams);
    } catch (error) {
      if (signal?.aborted) return;
      setApiExams([]);
      setExamLoadError(error instanceof Error ? error.message : 'Failed to load exams');
    } finally {
      if (!signal?.aborted && showLoading) {
        setIsLoadingExams(false);
      }
    }
  }, []);

  const goToNextExamStep = () => {
    if (createExamStep === 1) {
      const gradeId = Array.isArray(createExamFilters.section)
        ? createExamFilters.section[0]
        : createExamFilters.section;

      const standardId = Array.isArray(createExamFilters.standard)
        ? createExamFilters.standard[0]
        : createExamFilters.standard;

      const subjectId = Array.isArray(createExamFilters.subject)
        ? createExamFilters.subject[0]
        : createExamFilters.subject;

      if (!gradeId) {
        window.alert('Please select a section.');
        return;
      }

      if (!standardId) {
        window.alert('Please select a standard.');
        return;
      }

      if (!subjectId) {
        window.alert('Please select a subject.');
        return;
      }

      setCreateExamStep(2);
      return;
    }

    if (createExamStep === 2) {
      if (selectedQuestions.length === 0) return;
      setCreateExamStep(3);
      return;
    }

    if (createExamStep === 3) {
      setCreateExamStep(4);
    }
  };

  const publishExam = async () => {
    if (isPublishing) return;

    const session = getCreateExamSession();
    const selectedExamType = examType.trim().toLowerCase();
    const selectedQuestionIds = selectedQuestions.map(Number).filter((id) => Number.isFinite(id));
    const attemptAllowed = Number(attemptsAllowed.match(/\d+/)?.[0] ?? 1);
    const timeAllowed = Number(timeLimitMinutes);
    const gradeId = Array.isArray(createExamFilters.section)
      ? createExamFilters.section[0]
      : createExamFilters.section;
    const standardId = Array.isArray(createExamFilters.standard)
      ? createExamFilters.standard[0]
      : createExamFilters.standard;
    const subjectId = Array.isArray(createExamFilters.subject)
      ? createExamFilters.subject[0]
      : createExamFilters.subject;

    if (!session.subInstituteId || !session.userId || !session.token || !session.syear) {
      setPublishError('User session is missing. Please sign in again and try publishing.');
      return;
    }

    if (
      !gradeId ||
      !standardId ||
      !subjectId ||
      !examName.trim() ||
      !examType.trim() ||
      !attemptsAllowed.trim() ||
      !openDate ||
      !closeDate ||
      !Number.isFinite(timeAllowed) ||
      timeAllowed <= 0 ||
      selectedQuestionIds.length === 0
    ) {
      setPublishError('Complete the exam details and select at least one question before publishing.');
      return;
    }

    try {
      setIsPublishing(true);
      setPublishError('');
      setPublishSuccessMessage('');

      const payload = {
        sub_institute_id: Number(session.subInstituteId),
        syear: Number(session.syear),
        user_id: Number(session.userId),
        grade: Number(gradeId),
        standard: Number(standardId),
        subject: Number(subjectId),
        paper_name: examName.trim(),
        paper_desc: examDescription.trim(),
        open_date: formatDateTime(openDate),
        close_date: formatDateTime(closeDate),
        time_allowed: timeAllowed,
        total_ques: selectedQuestionIds.length,
        total_marks: selectedQuestionRows.reduce((total, question) => total + Number(question.marks ?? 0), 0),
        attempt_allowed: attemptAllowed,
        exam_type: selectedExamType,
        question_ids: selectedQuestionIds,
      };

      const response = await fetch(`${API_BASE_URL}/api/question-paper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as CreateQuestionPaperApiResponse;

      if (!response.ok || result.status_code !== 1) {
        throw new Error(result.message || 'Unable to publish the exam.');
      }

      const successMessage = result.message || 'Question-Paper Added Successfully';

      setPublishSuccessMessage(successMessage);
      setIsCreateExamOpen(false);
      resetCreateExamForm();
      await refreshExamList({ showLoading: false });
    } catch (error) {
      console.error('Publish exam error:', error);

      const message = error instanceof Error ? error.message : 'Unable to publish the exam.';
      setPublishError(message);
    } finally {
      setIsPublishing(false);
    }
  };

  const submitPracticeAssessment = async () => {
    if (!activePracticeAssessment || !activePracticeConcept || !activeStudentChapter) return;
    if (!hasAnsweredAllPracticeQuestions) return;

    const session = getCreateExamSession();
    if (!session.userId) {
      setPracticeLoadError('Your session has expired. Please sign in again and retry.');
      return;
    }

    try {
      setIsPracticeLoading(true);
      setPracticeLoadError('');

      const body = new URLSearchParams();
      body.set('type', 'API');
      body.set('student_id', session.userId);
      if (session.subInstituteId) body.set('sub_institute_id', session.subInstituteId);
      activePracticeAssessment.questions.forEach((question) => {
        const answer = practiceAnswers[question.id];
        if (answer) body.set(`answers[${question.id}]`, answer);
      });

      const response = await fetch(`${API_BASE_URL}/lms/submit-practice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: body.toString(),
      });
      const payload = (await response.json().catch(() => null)) as SubmitPracticeApiResponse | null;

      if (!response.ok || Number(payload?.status_code) !== 1) {
        throw new Error(payload?.message || 'Unable to submit practice answers.');
      }

      const scorePercent = Math.round(Number(payload?.data?.summary?.percentage ?? 0));
      const nextMastery = Math.max(activePracticeConcept.mastery, scorePercent);
      const didMasterConcept = nextMastery >= activePracticeAssessment.masteryTarget;

      setStudentChapterProgressList((current) =>
        current.map((chapter) => {
          if (chapter.chapterId !== activeStudentChapter.chapterId) return chapter;

          const updatedConcepts: StudentConceptProgress[] = chapter.concepts.map((concept) => {
            if (concept.id !== activePracticeConcept.id) return concept;

            const attemptsCount = concept.attemptsCount + 1;
            const nextStatus: StudentConceptStatus = didMasterConcept ? 'Mastered' : 'In progress';

            return {
              ...concept,
              mastery: nextMastery,
              attemptsCount,
              attemptsLabel: `${nextMastery}%`,
              status: nextStatus,
              subtitle: didMasterConcept
                ? `Mastered · ${attemptsCount} ${attemptsCount === 1 ? 'attempt' : 'attempts'}`
                : formatPracticeAttemptSubtitle(attemptsCount, activePracticeAssessment.masteryTarget),
              canPractice: !didMasterConcept,
            };
          });

          const averageMasteryValue = Math.round(
            updatedConcepts.reduce((sum, concept) => sum + concept.mastery, 0) / updatedConcepts.length
          );
          const conceptsMasteredCount = updatedConcepts.filter(
            (concept) => concept.status === 'Mastered'
          ).length;
          const totalAttempts = updatedConcepts.reduce((sum, concept) => sum + concept.attemptsCount, 0);

          return {
            ...chapter,
            concepts: updatedConcepts,
            chapterMastery: averageMasteryValue,
            conceptsMastered: `${conceptsMasteredCount} of ${updatedConcepts.length}`,
            averageMastery: `${averageMasteryValue}%`,
            practiceAttempts: String(totalAttempts),
          };
        })
      );

      closePracticeAssessmentModal();
    } catch (error) {
      setPracticeLoadError(
        error instanceof Error ? error.message : 'Unable to submit practice answers.'
      );
    } finally {
      setIsPracticeLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      refreshExamList({ signal: controller.signal }).catch((error) => {
        if (!controller.signal.aborted) {
          console.error('Exam list refresh error:', error);
        }
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [refreshExamList]);

  useEffect(() => {
    if (!isStudentProfile) return;

    const session = getCreateExamSession();
    if (!session.userId || !session.token) {
      setStudentMasteryError('Your session has expired. Please sign in again and retry.');
      return;
    }

    const controller = new AbortController();

    async function loadMasteryMap() {
      setIsStudentMasteryLoading(true);
      setStudentMasteryError('');

      try {
        const response = await fetch(`${API_BASE_URL}/api/pal/mastery-map/${session.userId}`, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
        });
        const payload = (await response.json().catch(() => null)) as MasteryMapApiResponse | null;

        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.message || 'Unable to load concept mastery.');
        }

        const chapters = mapMasteryMapToChapterProgress(payload ?? {});
        setStudentChapterProgressList(chapters);
        setStudentSelectedChapterId(chapters[0]?.chapterId ?? 0);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStudentChapterProgressList([]);
        setStudentMasteryError(
          error instanceof Error ? error.message : 'Unable to load concept mastery.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsStudentMasteryLoading(false);
        }
      }
    }

    void loadMasteryMap();

    return () => controller.abort();
  }, [isStudentProfile]);

  useEffect(() => {
    if (!isCreateExamOpen && !activePracticeConceptId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activePracticeConceptId, isCreateExamOpen]);

  useEffect(() => {
    if (!isCreateExamOpen) return;

    const controller = new AbortController();
    const session = getCreateExamSession();

    const fetchLmsCourses = async () => {
      setIsLoadingLmsCourses(true);
      setLmsCoursesError('');

      if (!session.subInstituteId || !session.userProfileName || !session.userId) {
        setLmsCourses([]);
        setLmsCoursesError('Course session data is missing.');
        setIsLoadingLmsCourses(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append('sub_institute_id', session.subInstituteId);
        formData.append('user_profile_name', session.userProfileName);
        formData.append('user_id', session.userId);

        const response = await fetch(`${API_BASE_URL}/api/lms-courses`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        });
        const payload = (await response.json()) as LmsCoursesApiResponse;

        if (!response.ok || payload.status_code !== 1) {
          throw new Error(payload.message || 'Failed to load course data');
        }

        setLmsCourses(getLmsSubjectRows(payload));
      } catch (error) {
        if (controller.signal.aborted) return;
        setLmsCourses([]);
        setLmsCoursesError(error instanceof Error ? error.message : 'Failed to load course data');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingLmsCourses(false);
        }
      }
    };

    fetchLmsCourses();

    return () => {
      controller.abort();
    };
  }, [isCreateExamOpen]);

  useEffect(() => {
    if (!isCreateExamOpen) return;
    if (selectedChapters.length === 0) {
      return;
    }

    const controller = new AbortController();

    const fetchChapterConcepts = async () => {
      const session = getCreateExamSession();
      const scrollTop = scopeScrollRef.current?.scrollTop ?? 0;

      if (!session.subInstituteId) {
        setConceptOptions([]);
        setConceptError('Concept session data is missing.');
        return;
      }

      try {
        setIsConceptLoading(true);
        setConceptError('');

        const payload = {
          chapter_id: selectedChapters,
          sub_institute_id: toNumber(session.subInstituteId),
        };

        const response = await fetch(`${API_BASE_URL}/api/lms-chapter-concepts`, {
          method: 'POST',
          body: JSON.stringify(payload),
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        });

        const result = (await response.json()) as ChapterConceptsApiResponse;

        if (!response.ok) {
          throw new Error(result.message || 'Failed to load chapter concepts');
        }

        const uniqueOptions = new Map<string, ChapterConceptOption>();
        (result.data ?? []).forEach((concept) => {
          const value = readString(concept.id);
          const label = readString(concept.name).trim();

          if (!value || !label) return;
          if (uniqueOptions.has(value)) return;

          uniqueOptions.set(value, {
            value,
            label,
            chapterId: toNumber(concept.chapter_id),
          });
        });

        const nextOptions = Array.from(uniqueOptions.values()).sort((left, right) =>
          left.label.localeCompare(right.label, undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        );

        if (controller.signal.aborted) return;

        setConceptOptions(nextOptions);
        setSelectedConcepts((current) =>
          current.filter((conceptId) => nextOptions.some((option) => option.value === conceptId))
        );
        requestAnimationFrame(() => {
          if (scopeScrollRef.current) {
            scopeScrollRef.current.scrollTop = scrollTop;
          }
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Concept API error:', error);
        setConceptOptions([]);
        setConceptError('Concepts could not be loaded. Please try again.');
      } finally {
        if (!controller.signal.aborted) {
          setIsConceptLoading(false);
        }
      }
    };

    fetchChapterConcepts();

    return () => {
      controller.abort();
    };
  }, [isCreateExamOpen, selectedChapters]);

  useEffect(() => {
    if (!isCreateExamOpen || createExamStep !== 2) return;

    const session = getCreateExamSession();
    if (!selectedSubjectId || selectedChapters.length === 0 || selectedConcepts.length === 0) {
      return;
    }

    const controller = new AbortController();

    const fetchQuestions = async () => {
      try {
        setIsQuestionsLoading(true);
        setQuestionsError('');

        const formData = new FormData();
        formData.append('subject_id', String(selectedSubjectId));

        selectedChapters.forEach((chapterId) => {
          formData.append('chapter_id[]', String(chapterId));
        });

        selectedConcepts.forEach((conceptId) => {
          formData.append('concept_id[]', String(conceptId));
        });

        selectedDokLevels.forEach((levelId) => {
          formData.append('dok_id[]', String(levelId));
        });

        selectedBloomLevels.forEach((levelId) => {
          formData.append('bloom_id[]', String(levelId));
        });

        const response = await fetch(`${API_BASE_URL}/api/lms-questions`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
          body: formData,
          signal: controller.signal,
        });

        const result = (await response.json()) as QuestionsApiResponse;

        if (!response.ok) {
          throw new Error(result.message || 'Failed to load questions');
        }

        const nextQuestions = result.data ?? [];
        if (controller.signal.aborted) return;

        setQuestions(nextQuestions);
        setSelectedQuestions((current) =>
          current.filter((id) => nextQuestions.some((question) => String(question.id) === id))
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Question API error:', error);
        setQuestions([]);
        setSelectedQuestions([]);
        setQuestionsError('Unable to load questions.');
      } finally {
        if (!controller.signal.aborted) {
          setIsQuestionsLoading(false);
        }
      }
    };

    fetchQuestions();

    return () => {
      controller.abort();
    };
  }, [createExamStep, isCreateExamOpen, selectedBloomLevels, selectedChapters, selectedConcepts, selectedDokLevels, selectedSubjectId]);

  // Load DOK / Bloom level options from the DB once per modal open.
  useEffect(() => {
    if (!isCreateExamOpen || mappingLevels.dok.length > 0 || mappingLevels.bloom.length > 0) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const session = getCreateExamSession();
        const response = await fetch(`${API_BASE_URL}/api/question-mapping-levels`, {
          headers: {
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          status_code?: number;
          data?: { dok?: Array<{ id: number; name: string }>; bloom?: Array<{ id: number; name: string }> };
        };
        if (controller.signal.aborted || !response.ok || !result?.data) return;

        setMappingLevels({
          dok: result.data.dok ?? [],
          bloom: result.data.bloom ?? [],
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Mapping levels API error:', error);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isCreateExamOpen, mappingLevels.bloom.length, mappingLevels.dok.length]);



  useEffect(() => {
    if (!activePracticeConceptId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePracticeAssessmentModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePracticeConceptId]);

  useEffect(() => {
    if (!activePracticeConceptId || practiceTimeLeft <= 0) return;

    const timer = window.setInterval(() => {
      setPracticeTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activePracticeConceptId, practiceTimeLeft]);

  const studentStatusBadgeClasses: Record<StudentConceptStatus, string> = {
    Mastered: 'bg-emerald-50 text-emerald-700',
    'In progress': 'bg-violet-50 text-violet-700',
    Locked: 'bg-slate-100 text-slate-500',
  };


  const studentProgressBarClasses: Record<StudentConceptStatus, string> = {
    Mastered: 'bg-emerald-500',
    'In progress': 'bg-violet-500',
    Locked: 'bg-slate-300',
  };

  return (
    <>
      
        <div className="mx-auto w-full max-w-[1540px]">
          <section className="rounded-[24px] border bg-white border-[#D9E3F1] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A889D]">
                  Academic year 2026-27 - Term 1
                </p>
                <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[#172554] sm:text-[34px]">
                  Learning management
                </h1>
                <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#5B6B82]">
                  Plan lessons, manage concept-level content, and run mastery-based assessments.
                </p>
              </div>

            </div>

            {audienceMode === 'Teacher' && !isStudentProfile ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                      {innerTabs.map((tab) => {
                        const TabIcon = tab.icon;

                        return (
                          <button
                            key={tab.label}
                            type="button"
                            className={`inline-flex items-center gap-2 border-b-2 pb-2 text-[14px] font-semibold transition ${
                              tab.active
                                ? 'border-[#5846EA] text-[#5846EA]'
                                : 'border-transparent text-[#5F7087]'
                            }`}
                          >
                            <TabIcon size={16} />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
                      <div className="relative w-full max-w-[320px]">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                          type="text"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search exams..."
                          className="h-10 w-full rounded-[10px] border border-[#CFD9E6] bg-white pl-10 pr-4 text-[14px] text-[#172554] outline-none placeholder:text-[#94A3B8] focus:border-[#7C6CF4]"
                        />
                      </div>

                      <div className="flex flex-col gap-2.5 sm:flex-row">
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

                        <div className="relative">
                          <select
                            value={typeFilter}
                            onChange={(event) => setTypeFilter(event.target.value)}
                            className="h-10 min-w-[130px] appearance-none rounded-[10px] border border-[#CFD9E6] bg-white px-3.5 pr-9 text-[14px] text-[#24324A] outline-none focus:border-[#7C6CF4]"
                          >
                            <option>All types</option>
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8798]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start">
                    <Link
                      href="/exam/exam-creation"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#5846EA] bg-white px-4 text-[14px] font-semibold text-[#5846EA] transition hover:bg-[#EEEBFF]"
                    >
                      <Sparkles size={18} />
                      AI generated exam
                    </Link>
                    <button
                      type="button"
                      onClick={openCreateExamModal}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#5846EA] px-4 text-[14px] font-semibold text-white"
                    >
                      <Plus size={18} />
                      Create exam
                    </button>
                  </div>
                </div>

                <p className="text-[14px] font-medium text-[#5F7087]">
                  {filteredExams.length} of {exams.length} exams
                </p>

                {publishSuccessMessage ? (
                  <div className="rounded-[14px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-[14px] font-medium text-[#166534]">
                    {publishSuccessMessage}
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-[18px] border border-[#D9E3F0] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1040px] border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-[#F6F8FC]">
                          {['Exam', 'Class', 'Type', 'Window', 'Attempts', 'Questions', 'Marks', 'Status'].map((heading) => (
                            <th
                              key={heading}
                              className="border-b border-[#D9E3F0] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5F7087]"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExams.map((exam) => (
                          <tr key={exam.id} className="bg-white">
                            <td className="border-b border-[#E6EDF5] px-4 py-3 align-top">
                              <div className="min-w-[240px]">
                                <p className="text-[14px] font-semibold text-[#1E293B]">{exam.name}</p>
                                <p className="mt-0.5 text-[12px] text-[#7B8798]">{exam.id}</p>
                              </div>
                            </td>
                            <td className="border-b border-[#E6EDF5] px-4 py-3 text-[14px] text-[#334155]">
                              {exam.classLabel}
                            </td>
                            <td className="border-b border-[#E6EDF5] px-4 py-3 text-[14px] text-[#334155]">
                              {exam.type}
                            </td>
                          <td className="border-b border-[#E6EDF5] px-4 py-3 text-[14px] text-[#334155]">
                            {exam.window}
                          </td>
                          <td className="border-b border-[#E6EDF5] px-4 py-3 text-right text-[14px] text-[#334155]">
                            {exam.attempts}
                          </td>
                          <td className="border-b border-[#E6EDF5] px-4 py-3 text-right text-[14px] text-[#334155]">
                            {exam.questions}
                          </td>
                          <td className="border-b border-[#E6EDF5] px-4 py-3 text-right text-[14px] text-[#334155]">
                            {exam.marks}
                          </td>
                          <td className="border-b border-[#E6EDF5] px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-semibold ${statusBadgeClasses[exam.status]}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${statusDotClasses[exam.status]}`} />
                              {exam.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isLoadingExams ? (
                  <div className="px-6 py-12 text-center text-[14px] text-[#6B7B91]">
                    Loading exams...
                  </div>
                ) : null}

                {!isLoadingExams && examLoadError ? (
                  <div className="px-6 py-12 text-center text-[14px] text-[#B45309]">
                    {examLoadError}
                  </div>
                ) : null}

                {!isLoadingExams && !examLoadError && filteredExams.length === 0 ? (
                  <div className="px-6 py-12 text-center text-[14px] text-[#6B7B91]">
                    No exams match the current search and filters.
                  </div>
                ) : null}
              </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-6 border-b border-[#D9E3F0] pb-3">
                  {visibleStudentViewTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = studentLearningTab === tab.label;

                    return (
                      <button
                        key={tab.label}
                        type="button"
                        onClick={() => setStudentLearningTab(tab.label)}
                        className={`inline-flex items-center gap-2 border-b-2 pb-3 text-[15px] font-semibold transition ${
                          isActive
                            ? 'border-[#5846EA] text-[#5846EA]'
                            : 'border-transparent text-[#5F7087] hover:text-[#334155]'
                        }`}
                      >
                        <TabIcon size={16} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {studentLearningTab === 'PAL' ? (
                  <>
                    {isStudentMasteryLoading ? (
                      <div className="rounded-[18px] border border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                        Loading concept mastery...
                      </div>
                    ) : studentMasteryError ? (
                      <div className="rounded-[18px] border border-red-200 bg-red-50 px-5 py-4">
                        <p className="text-sm font-semibold text-red-700">Unable to load concept mastery</p>
                        <p className="mt-1 text-sm text-red-600">{studentMasteryError}</p>
                      </div>
                    ) : studentChapterProgressList.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                        No concept mastery data is available yet. Complete a practice or online exam to see progress here.
                      </div>
                    ) : (
                    <>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div className="w-full max-w-[460px]">
                        <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                          Chapter
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="relative min-w-0 flex-1">
                            <select
                              value={String(activeStudentChapter?.chapterId ?? '')}
                              onChange={(event) => setStudentSelectedChapterId(Number(event.target.value))}
                              className="h-11 w-full appearance-none rounded-[10px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                            >
                              {studentChapterProgressList.map((chapter) => (
                                <option key={chapter.chapterId} value={chapter.chapterId}>
                                  {chapter.chapterTitle}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          </div>

                          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2F7] px-3 py-2 text-[13px] font-medium text-[#51657F]">
                            <Info size={14} />
                            {activeStudentChapter?.badgeLabel}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                      <div className="rounded-[18px] border border-[#D9E3F0] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#172554]">
                          Chapter progress
                        </h2>
                        <div className="mt-5 flex items-center justify-between gap-3 text-[14px] text-[#4E6280]">
                          <span>{activeStudentChapter?.chapterTitle} chapter mastery</span>
                          <span className="font-semibold text-[#334155]">
                            {activeStudentChapter?.chapterMastery ?? 0}%
                          </span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-[#E7ECF3]">
                          <div
                            className="h-2 rounded-full bg-[#5846EA]"
                            style={{ width: `${activeStudentChapter?.chapterMastery ?? 0}%` }}
                          />
                        </div>

                        <div className="mt-6 space-y-4 text-[14px] text-[#334155]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#4E6280]">Concepts mastered</span>
                            <span className="font-semibold">{activeStudentChapter?.conceptsMastered}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#4E6280]">Average mastery</span>
                            <span className="font-semibold">{activeStudentChapter?.averageMastery}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#4E6280]">Practice attempts</span>
                            <span className="font-semibold">{activeStudentChapter?.practiceAttempts}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#4E6280]">Mastery threshold</span>
                            <span className="font-semibold">{activeStudentChapter?.masteryThreshold}</span>
                          </div>
                        </div>

                        <div className="my-6 h-px bg-[#E5EAF2]" />

                        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6E7FA0]">
                          Adaptive learning loop
                        </p>

                        <div className="mt-4 space-y-4">
                          {[
                            {
                              key: 'diagnostic',
                              title: 'Diagnostic assessment',
                              description: 'Baseline for the chapter',
                              state: 'completed' as const,
                            },
                            {
                              key: 'learn',
                              title: 'Learn',
                              description: 'Personalized content per concept',
                              state: 'completed' as const,
                            },
                            {
                              key: 'practice',
                              title: 'Practice assessment',
                              description: 'Retake until 75% mastery',
                              state: 'active' as const,
                            },
                            {
                              key: 'mastery',
                              title: 'Mastery & progression',
                              description: 'Next concept unlocks',
                              state: 'locked' as const,
                            },
                          ].map((step, index, steps) => {
                            const isCompleted = step.state === 'completed';
                            const isActive = step.state === 'active';
                            const isLast = index === steps.length - 1;

                            return (
                              <div key={step.key} className="relative flex gap-3">
                                <div className="relative flex w-6 justify-center">
                                  <span
                                    className={`relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-semibold ${
                                      isCompleted
                                        ? 'border-[#5846EA] bg-[#5846EA] text-white'
                                        : isActive
                                          ? 'border-[#5846EA] bg-white text-[#5846EA]'
                                          : 'border-[#CBD5E1] bg-white text-[#64748B]'
                                    }`}
                                  >
                                    {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
                                  </span>
                                  {!isLast ? (
                                    <span
                                      className={`absolute top-6 h-[28px] w-[2px] rounded-full ${
                                        isCompleted ? 'bg-[#5846EA]' : 'bg-[#D7DFEA]'
                                      }`}
                                    />
                                  ) : null}
                                </div>
                                <div className="pb-2">
                                  <p
                                    className={`text-[14px] font-semibold ${
                                      isActive || isCompleted ? 'text-[#172554]' : 'text-[#51657F]'
                                    }`}
                                  >
                                    {step.title}
                                  </p>
                                  <p className="mt-1 text-[13px] leading-5 text-[#64748B]">
                                    {step.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-[#D9E3F0] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <div className="border-b border-[#E5EAF2] px-5 py-5">
                          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#172554]">
                            Concept progression
                          </h2>
                          <p className="mt-1 text-[14px] text-[#4E6280]">
                            Master each concept (75% or above) to unlock the next
                          </p>
                        </div>

                        <div className="divide-y divide-[#E5EAF2]">
                          {activeStudentChapter?.concepts.map((concept) => {
                            const isLocked = concept.status === 'Locked';
                            const isMastered = concept.status === 'Mastered';

                            return (
                              <div
                                key={concept.id}
                                className={
                                  isChatbotOpen
                                    ? 'grid gap-4 px-5 py-5'
                                    : 'grid gap-4 px-5 py-5 2xl:grid-cols-[minmax(0,1.35fr)_170px_120px_auto] 2xl:items-center'
                                }
                              >
                                <div className="flex min-w-0 items-start gap-3">
                                  <span
                                    className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                      isMastered
                                        ? 'bg-emerald-500 text-white'
                                        : isLocked
                                          ? 'bg-slate-100 text-slate-500'
                                          : 'bg-violet-500 text-white'
                                    }`}
                                  >
                                    {isMastered ? (
                                      <CheckCircle2 size={18} />
                                    ) : isLocked ? (
                                      <Lock size={16} />
                                    ) : (
                                      <Play size={16} />
                                    )}
                                  </span>

                                  <div className="min-w-0">
                                    <p
                                      className={`text-[15px] font-semibold ${
                                        isLocked ? 'text-[#64748B]' : 'text-[#172554]'
                                      }`}
                                    >
                                      {concept.title}
                                    </p>
                                    <p className="mt-1 text-[13px] leading-5 text-[#64748B]">
                                      {concept.subtitle}
                                    </p>
                                  </div>
                                </div>

                                <div className={isChatbotOpen ? 'min-w-0 max-w-full' : 'min-w-0 max-w-[320px]'}>
                                  <div className="flex items-center justify-between gap-3 text-[13px] text-[#4E6280]">
                                    <span>{concept.attemptsLabel}</span>
                                    <span>{concept.mastery}%</span>
                                  </div>
                                  <div className="mt-2 h-2 rounded-full bg-[#E7ECF3]">
                                    <div
                                      className={`h-2 rounded-full ${studentProgressBarClasses[concept.status]}`}
                                      style={{ width: `${concept.mastery}%` }}
                                    />
                                  </div>
                                </div>

                                <div className={isChatbotOpen ? '' : '2xl:col-span-1'}>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${studentStatusBadgeClasses[concept.status]}`}
                                  >
                                    {concept.status}
                                  </span>
                                </div>

                                <div
                                  className={
                                    isChatbotOpen
                                      ? 'flex flex-col gap-2'
                                      : 'flex flex-col gap-2 sm:flex-row sm:flex-wrap 2xl:col-span-1 2xl:flex-nowrap 2xl:justify-end'
                                  }
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleOpenLearnContent(concept)}
                                    disabled={!concept.canLearn}
                                    aria-label={`Open learning content for ${concept.title}`}
                                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                                      concept.canLearn
                                        ? 'border-[#D6DEEA] bg-white text-[#334155] hover:border-[#B7C5D8] hover:text-indigo-600'
                                        : 'cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#A0AEC0]'
                                    } ${isChatbotOpen ? 'w-full' : ''}`}
                                  >
                                    <svg
                                      width="19"
                                      height="19"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                                    </svg>
                                    <span>Learn content</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!concept.canPractice}
                                    onClick={() => openPracticeAssessmentModal(concept.id)}
                                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                                      concept.canPractice
                                        ? 'border-[#CBD5E1] bg-white text-[#172554] hover:border-[#94A3B8]'
                                        : 'cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#A0AEC0]'
                                    } ${isChatbotOpen ? 'w-full' : ''}`}
                                  >
                                    <FileText size={14} />
                                    Practice assessment
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    </>
                    )}
                  </>
                ) : studentLearningTab === 'Online Exam' ? (
                  selectedPaper && selectedPaperContext === 'online' ? (
                    <QuestionPaperView
                      paper={selectedPaper}
                      onBack={() => {
                        setSelectedPaper(null);
                        setSelectedPaperContext(null);
                        setPaperError('');
                      }}
                    />
                  ) : (
                    <div className="flex flex-col gap-5">
                      {!isStudentProfile ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                          <SearchDropdown
                            fields={['section', 'standard', 'subject']}
                            values={{
                              section: examFilters.grade_id,
                              standard: examFilters.standard_id,
                              subject: examFilters.subject_id,
                            }}
                            required={{
                              section: true,
                              standard: true,
                              subject: true,
                            }}
                            labels={{
                              section: 'Section',
                              standard: 'Standard',
                              subject: 'Subject',
                            }}
                            placeholders={{
                              section: 'Select Section',
                              standard: 'Select Standard',
                              subject: 'Select Subject',
                            }}
                            onChange={handleOnlineExamDropdownChange}
                          />

                          <div className="mt-5 flex justify-end">
                            <button
                              type="button"
                              onClick={handleOnlineExamSearch}
                              disabled={isSearchingStudentExams}
                              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSearchingStudentExams ? 'Searching...' : 'Search Exam'}
                            </button>
                          </div>

                          {studentExamSearchError ? (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                              <p className="text-sm font-semibold text-red-700">
                                Unable to load exams
                              </p>
                              <p className="mt-1 text-sm text-red-600">
                                {studentExamSearchError}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="space-y-4">
                        {paperLoading ? (
                          <div className="rounded-[18px] border border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                            Opening question paper...
                          </div>
                        ) : null}

                        {paperError ? (
                          <div className="rounded-[18px] border border-red-200 bg-red-50 px-5 py-4">
                            <p className="text-sm font-semibold text-red-700">
                              Unable to open question paper
                            </p>
                            <p className="mt-1 text-sm text-red-600">
                              {paperError}
                            </p>
                          </div>
                        ) : null}

                        {isStudentProfile && studentExamSearchError ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <p className="text-sm font-semibold text-red-700">
                              Unable to load exams
                            </p>
                            <p className="mt-1 text-sm text-red-600">
                              {studentExamSearchError}
                            </p>
                          </div>
                        ) : null}

                        {isSearchingStudentExams ? (
                          <div className="rounded-[18px] border border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                            Loading question papers...
                          </div>
                        ) : !hasSearchedStudentExams && !isStudentProfile ? (
                          <div className="rounded-[18px] border border-dashed border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                            Select Section, Standard, and Subject, then click Search Exam.
                          </div>
                        ) : studentQuestionPapers.length === 0 && !studentExamSearchError ? (
                          <div className="rounded-[18px] border border-dashed border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                            {isStudentProfile
                              ? 'No question paper is available for your account right now.'
                              : 'No question paper is available for the selected Section, Standard and Subject.'}
                          </div>
                        ) : !studentExamSearchError ? (
                          studentQuestionPapers.map((paper) => (
                            <Card
                              key={paper.id}
                              className="rounded-[18px] border border-[#D9E3F0] bg-white py-0 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                            >
                              <CardContent className="flex flex-col gap-4 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex min-w-0 items-start gap-4">
                                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-[#F4F7FB] text-[#5846EA]">
                                    <FileText size={22} />
                                  </span>

                                  <div className="min-w-0">
                                    <h3 className="text-[18px] font-semibold text-[#172554]">
                                      {paper.paper_name || 'Untitled exam'}
                                    </h3>
                                    <p className="mt-1 text-[14px] text-[#5F7087]">
                                      {paper.subject_name || 'Subject'} - Grade{' '}
                                      {toDisplayText(paper.standard_name) || '-'}
                                    </p>
                                    {paper.paper_desc ? (
                                      <p className="mt-1 text-[14px] text-[#7B8798]">
                                        {paper.paper_desc}
                                      </p>
                                    ) : null}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[13px] text-[#475569]">
                                        {toNumber(paper.total_ques)}{' '}
                                        {toNumber(paper.total_ques) === 1 ? 'question' : 'questions'}
                                      </span>
                                      <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[13px] text-[#475569]">
                                        {toNumber(paper.total_marks)}{' '}
                                        {toNumber(paper.total_marks) === 1 ? 'mark' : 'marks'}
                                      </span>
                                      {toNumber(paper.timelimit_enable) === 1 ? (
                                        <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[13px] text-[#475569]">
                                          {toNumber(paper.time_allowed)} min
                                        </span>
                                      ) : null}
                                      <span className="rounded-full bg-[#FFF4E8] px-2.5 py-1 text-[13px] text-[#A45C14]">
                                        {toNumber(paper.attempt_allowed)}{' '}
                                        {toNumber(paper.attempt_allowed) === 1 ? 'attempt' : 'attempts'}
                                      </span>
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-[13px] ${
                                          paper.active_exam === 'yes'
                                            ? 'bg-[#EAF9F1] text-[#14804A]'
                                            : 'bg-[#EEF2F7] text-[#64748B]'
                                        }`}
                                      >
                                        {paper.active_exam === 'yes' ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  className="h-11 rounded-[14px] bg-[#5846EA] px-5 text-[14px] font-semibold text-white hover:bg-[#4C3DD3] disabled:bg-slate-300"
                                  onClick={() => handleOpenStudentQuestionPaper(paper.id, 'online')}
                                >
                                  <FileText size={16} />
                                  Open question paper
                                </Button>
                              </CardContent>
                            </Card>
                          ))
                        ) : null}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="no-print flex items-start gap-2 rounded-[14px] border border-[#D8E5FF] bg-[#F5F8FF] px-4 py-3 text-[13px] text-[#4C63A8]">
                      <Info size={16} className="mt-0.5 shrink-0" />
                      <p>
                        Select Section, Standard, and Subject to load the offline question paper automatically.
                      </p>
                    </div>

                    <div className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <SearchDropdown
                        fields={['section', 'standard', 'subject']}
                        values={offlineExamFilters}
                        required={{
                          section: true,
                          standard: true,
                          subject: true,
                        }}
                        labels={{
                          section: 'Section',
                          standard: 'Standard',
                          subject: 'Subject',
                        }}
                        placeholders={{
                          section: 'Select Section',
                          standard: 'Select Standard',
                          subject: 'Select Subject',
                        }}
                        onChange={handleOfflineExamDropdownChange}
                      />

                      {offlineExamPapers.length > 1 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {offlineExamPapers.map((paper) => (
                            <button
                              key={paper.id}
                              type="button"
                              onClick={() => void fetchOfflineQuestionPaperDetail(paper)}
                              className={`rounded-full px-3 py-1.5 text-sm transition ${
                                selectedPaper?.id === paper.id && selectedPaperContext === 'offline'
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {paper.paper_name || `Paper ${paper.id}`}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {offlineExamError ? (
                      <div className="no-print rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-sm font-semibold text-red-700">
                          Unable to load offline exams
                        </p>
                        <p className="mt-1 text-sm text-red-600">
                          {offlineExamError}
                        </p>
                      </div>
                    ) : null}

                    {paperError ? (
                      <div className="no-print rounded-[18px] border border-red-200 bg-red-50 px-5 py-4">
                        <p className="text-sm font-semibold text-red-700">
                          Unable to open question paper
                        </p>
                        <p className="mt-1 text-sm text-red-600">
                          {paperError}
                        </p>
                      </div>
                    ) : null}

                    {isLoadingOfflineExams || paperLoading ? (
                      <div className="rounded-[18px] border border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                        Loading question paper...
                      </div>
                    ) : !hasSearchedOfflineExams ? (
                      <div className="no-print rounded-[18px] border border-dashed border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                        Select Section, Standard, and Subject. The offline question paper will appear here.
                      </div>
                    ) : selectedPaper && selectedPaperContext === 'offline' ? (
                      <PrintableQuestionPaper
                        paper={selectedPaper}
                        onPrint={printOfflineQuestionPaper}
                      />
                    ) : !offlineExamError ? (
                      <div className="no-print rounded-[18px] border border-dashed border-[#D9E3F0] bg-white px-5 py-8 text-center text-[14px] text-[#5F7087]">
                        No offline question paper is available for the selected Section, Standard, and Subject.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
          </section>
        </div>
     

      {activePracticeConceptId && (!activePracticeAssessment || isPracticeLoading) ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0F172A]/60 px-3 py-4 backdrop-blur-[2px] sm:px-6">
          <div className="w-full max-w-sm rounded-[20px] border border-[#DCE4F0] bg-white p-6 text-center shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            {isPracticeLoading ? (
              <p className="text-sm font-medium text-[#5B6B82]">Loading practice questions...</p>
            ) : practiceLoadError ? (
              <>
                <p className="text-sm font-semibold text-red-600">{practiceLoadError}</p>
                <button
                  type="button"
                  onClick={closePracticeAssessmentModal}
                  className="mt-4 rounded-[12px] border border-[#D0D8E6] px-4 py-2 text-sm font-medium text-[#334155]"
                >
                  Close
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {activePracticeAssessment && activePracticeConcept && !isPracticeLoading ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0F172A]/60 px-3 py-4 backdrop-blur-[2px] sm:px-6">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[#DCE4F0] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="shrink-0 border-b border-[#E4EAF2] px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-[#1E293B]">
                    Practice Assessment - {activePracticeConcept.title}
                  </h2>
                  <div className="mt-2 space-y-1 text-[14px] text-[#5B6B82]">
                    <p>{activePracticeAssessment.questions.length} questions</p>
                    <p>Unlimited attempts</p>
                    <p>Reach {activePracticeAssessment.masteryTarget}% to master this concept</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closePracticeAssessmentModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F3F6FB] hover:text-[#334155]"
                  aria-label="Close practice assessment modal"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: 'Total Marks',
                    value: String(
                      activePracticeAssessment.questions.reduce((sum, question) => sum + question.marks, 0)
                    ),
                    icon: Award,
                  },
                  {
                    label: 'Total Duration',
                    value: `${activePracticeAssessment.durationMinutes} min`,
                    icon: Hourglass,
                  },
                  {
                    label: 'Time Left',
                    value: formatDurationLabel(practiceTimeLeft),
                    icon: Clock3,
                  },
                ].map((item) => {
                  const SummaryIcon = item.icon;

                  return (
                    <Card
                      key={item.label}
                      className="rounded-[20px] border border-[#D9E3F0] bg-[#F8FAFC] py-0 shadow-none"
                    >
                      <CardContent className="flex items-center gap-3 px-4 py-4">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-[#5846EA] ring-1 ring-[#D9E3F0]">
                          <SummaryIcon size={20} />
                        </span>
                        <div>
                          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6B7B91]">
                            {item.label}
                          </p>
                          <p className="mt-1 text-[22px] font-semibold text-[#172554]">{item.value}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 space-y-4">
                {activePracticeAssessment.questions.map((question, index) => (
                  <Card
                    key={question.id}
                    className="rounded-[22px] border border-[#D9E3F0] bg-white py-0 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                  >
                    <CardContent className="px-5 py-5 sm:px-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[#172554]">
                            {index + 1}. {question.question}
                          </p>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold text-[#5B4FE9]">
                          {question.marks} marks
                        </span>
                      </div>

                      <RadioGroup
                        value={practiceAnswers[question.id] ?? ''}
                        onValueChange={(value) =>
                          setPracticeAnswers((current) => ({
                            ...current,
                            [question.id]: value,
                          }))
                        }
                        className="mt-5 gap-3"
                      >
                        {question.options.map((option) => (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-[14px] border px-4 py-3 transition ${
                              practiceAnswers[question.id] === option.id
                                ? 'border-[#CFC8FF] bg-[#F7F5FF]'
                                : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                            }`}
                          >
                            <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                            <span className="text-[14px] text-[#334155]">{option.label}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#E4EAF2] bg-white px-7 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] font-medium text-[#5F7087]">
                  {practiceLoadError ? (
                    <span className="text-red-600">{practiceLoadError}</span>
                  ) : (
                    <>{practiceAnsweredCount} of {activePracticeAssessment.questions.length} answered</>
                  )}
                </p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-[12px] border-[#D0D8E6] px-4 text-[#334155]"
                    onClick={closePracticeAssessmentModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="h-10 rounded-[12px] bg-[#5846EA] px-4 text-white hover:bg-[#4C3DD3]"
                    disabled={!hasAnsweredAllPracticeQuestions || isPracticeLoading}
                    onClick={submitPracticeAssessment}
                  >
                    {isPracticeLoading ? 'Submitting...' : 'Submit Answers'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedConcept ? (
        <>
          <button
            type="button"
            aria-label="Close learning content drawer"
            onClick={handleCloseLearnContent}
            className={`fixed inset-0 z-40 bg-slate-900/55 transition-opacity duration-300 ${
              isLearnDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="learn-content-title"
            className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[600px] flex-col bg-white shadow-2xl transition-transform duration-300 ${
              isLearnDrawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-7 py-6">
              <h2
                id="learn-content-title"
                className="max-w-[470px] text-2xl font-bold leading-tight text-slate-900"
              >
                Personalized learning - {selectedConcept.title}
              </h2>

              <button
                type="button"
                onClick={handleCloseLearnContent}
                aria-label="Close"
                className="ml-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-7">
              {selectedConcept.status === 'Mastered' ? (
                <div className="mb-5 flex items-start gap-2 text-sm font-medium text-blue-600">
                  <svg
                    className="mt-0.5 shrink-0"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5" />
                    <path d="M12 8h.01" />
                  </svg>

                  <p>
                    Concept mastered - this content stays available for revision.
                  </p>
                </div>
              ) : null}

              {selectedConcept.learningContent.length > 0 ? (
                <div className="space-y-4">
                  {selectedConcept.learningContent.map((content) => (
                    <article
                      key={content.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 3h16v12H4z" />
                            <path d="M8 21h8" />
                            <path d="M12 15v6" />
                          </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <h3 className="font-semibold leading-6 text-slate-900">
                              {content.title}
                            </h3>

                            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                              {content.type}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {content.publishedBy}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex min-h-[122px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                        {content.previewUrl ? (
                          <iframe
                            src={content.previewUrl}
                            title={content.title}
                            className="h-[280px] w-full rounded-lg"
                          />
                        ) : (
                          <p className="text-sm text-slate-500">
                            Content preview placeholder
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="font-medium text-slate-700">
                    No learning content available
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Learning content has not been published for this concept yet.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </>
      ) : null}

      {isCreateExamOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close create exam drawer"
            className="absolute inset-0 z-40 bg-slate-900/50"
            onClick={closeCreateExamModal}
          />
          <aside className="absolute right-0 top-0 z-50 flex h-full w-full max-w-[720px] flex-col bg-white shadow-2xl">
            <div className="shrink-0 border-b border-[#E4EAF2] bg-white px-7 py-5">
              <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                Create exam
              </h2>
                <button
                  type="button"
                  onClick={closeCreateExamModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F3F6FB] hover:text-[#334155]"
                  aria-label="Close create exam modal"
                >
                <X size={22} />
              </button>
              </div>
            </div>

            <div className="shrink-0 overflow-x-auto border-b border-[#E4EAF2] bg-white px-7 py-6">
              <div className="grid min-w-[620px] grid-cols-4 gap-3">
                {createExamSteps.map((step, index) => {
                  const isCompleted = createExamStep > step.id;
                  const isActive = createExamStep === step.id;
                  const isLast = index === createExamSteps.length - 1;

                  return (
                    <div key={step.id} className="relative">
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[14px] font-semibold ${
                            isActive
                              ? 'border-[#5B4FE9] text-[#5B4FE9]'
                              : isCompleted
                                ? 'border-[#5B4FE9] bg-[#5B4FE9] text-white'
                              : 'border-[#CBD5E1] text-[#64748B]'
                          }`}
                        >
                          {isCompleted ? <Check size={15} strokeWidth={3} /> : step.id}
                        </span>
                        <div>
                          <p
                            className={`text-[14px] font-semibold ${
                              isActive || isCompleted ? 'text-[#5B4FE9]' : 'text-[#51657F]'
                            }`}
                          >
                            {step.title}
                          </p>
                          {step.description ? (
                            <p className="mt-1 max-w-[110px] text-[12px] leading-5 text-[#51657F]">
                              {step.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {!isLast ? <span className="absolute left-[116px] top-4 h-px w-[calc(100%-124px)] bg-[#CBD5E1]" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              ref={scopeScrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-6"
            >
              {createExamStep === 1 ? (
                <>
             
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <SearchDropdown
                      fields={['section', 'standard', 'subject']}
                      values={createExamFilters}
                      required={{
                        section: true,
                        standard: true,
                        subject: true,
                      }}
                      labels={{
                        section: 'Section',
                        standard: 'Standard',
                        subject: 'Subject',
                      }}
                      placeholders={{
                        section: 'Select Section',
                        standard: 'Select Standard',
                        subject: 'Select Subject',
                      }}
                      onChange={handleExamDropdownChange}
                      onSectionChange={() => {
                        setSelectedStandard('');
                        setSelectedStandardId(null);
                        setSelectedSubject('');
                        setSelectedSubjectId(null);
                        clearCreateExamSelections();
                      }}
                      onStandardChange={(value, selectedData) => {
                        const standardId = Array.isArray(value)
                          ? Number(value[0] || 0)
                          : Number(value || 0);

                        setSelectedStandard(
                          selectedData[0]?.name
                            ? toDisplayText(selectedData[0].name)
                            : ''
                        );
                        setSelectedStandardId(Number.isFinite(standardId) && standardId > 0 ? standardId : null);
                        setSelectedSubject('');
                        setSelectedSubjectId(null);
                        clearCreateExamSelections();
                      }}
                      onSubjectChange={(value, selectedData) => {
                        const subjectId = Array.isArray(value)
                          ? Number(value[0] || 0)
                          : Number(value || 0);

                        setSelectedSubject(
                          selectedData[0]?.subject_name
                            ? toDisplayText(selectedData[0].subject_name)
                            : ''
                        );
                        setSelectedSubjectId(Number.isFinite(subjectId) && subjectId > 0 ? subjectId : null);
                        clearCreateExamSelections();
                      }}
                    />
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Chapters
                    </p>
                    <div className="mt-3 min-h-[44px] max-h-[88px] overflow-y-auto rounded-[16px] border border-[#D8E1EE] bg-[#F8FAFC] px-3 py-2">
                      {selectedChapterOptions.length === 0 ? (
                        <p className="text-[14px] text-[#64748B]">No chapters selected yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedChapterOptions.slice(0, 2).map((chapter) => (
                            <span
                              key={chapter.value}
                              className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-sm text-violet-700"
                            >
                              <span className="truncate">{chapter.label}</span>
                            </span>
                          ))}
                          {selectedChapterOptions.length > 2 ? (
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700">
                              +{selectedChapterOptions.length - 2} more
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                    {lmsCoursesError ? (
                      <p className="mt-3 text-[13px] text-[#B45309]">{lmsCoursesError}</p>
                    ) : null}
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto overscroll-contain pr-1">
                      {isLoadingLmsCourses ? (
                        <div className="rounded-[16px] border border-dashed border-[#D8E1EE] px-4 py-5 text-[14px] text-[#64748B]">
                          Loading chapters...
                        </div>
                      ) : chapterOptions.length === 0 ? (
                        <div className="rounded-[16px] border border-dashed border-[#D8E1EE] px-4 py-5 text-[14px] text-[#64748B]">
                          {selectedSubjectId == null
                            ? 'Select a standard and subject to view chapters.'
                            : 'No chapters are available for the selected subject.'}
                        </div>
                      ) : (
                        chapterOptions.map((chapter) => {
                        const isSelected = selectedChapters.includes(chapter.id);

                        return (
                          <label
                            key={chapter.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2 transition ${
                              isSelected
                                ? 'bg-[#F7F5FF]'
                                : 'bg-transparent hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleChapter(chapter.id)}
                              className="peer sr-only"
                            />
                            <span
                              className={`mt-1 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border transition ${
                                isSelected
                                  ? 'border-[#5B4FE9] bg-[#5B4FE9] text-white'
                                  : 'border-[#C9D4E5] bg-white text-transparent'
                              }`}
                            >
                              <Check size={15} strokeWidth={3} />
                            </span>
                            <span className="min-w-0">
                              <span className={`block font-medium ${isSelected ? 'text-[#4338CA]' : 'text-slate-800'}`}>
                                {toDisplayText(chapter.chapter_name) || 'Untitled chapter'}
                              </span>
                              <span className="mt-1 block text-sm text-slate-500">
                                {toNumber(chapter.total_content)} concepts
                              </span>
                            </span>
                          </label>
                        );
                      }))}
                    </div>
                  </div>

                  <div className="mt-6 min-h-[180px]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Concepts
                    </p>
                    {!selectedChapters.length ? (
                      <p className="mt-3 text-[14px] text-[#64748B]">
                        Select chapter checkboxes to view related concepts.
                      </p>
                    ) : null}
                    {selectedChapters.length > 0 && isConceptLoading ? (
                      <div className="mt-3 rounded-[16px] border border-[#D8E1EE] px-4 py-4 text-[14px] text-[#64748B]">
                        Loading concepts...
                      </div>
                    ) : null}
                    {selectedChapters.length > 0 && conceptError ? (
                      <div className="mt-3 rounded-[16px] border border-[#F3C7C7] px-4 py-4 text-[14px] text-[#DC2626]">
                        {conceptError}
                      </div>
                    ) : null}
                    {selectedChapters.length > 0 &&
                    !isConceptLoading &&
                    conceptOptions.length === 0 &&
                    !conceptError ? (
                      <div className="mt-3 rounded-[16px] border border-[#D8E1EE] px-4 py-4 text-[14px] text-[#64748B]">
                        No concepts are available for the selected chapters.
                      </div>
                    ) : null}
                    {!isConceptLoading && conceptOptions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {conceptOptions.map((concept) => {
                          const isSelected = selectedConcepts.includes(concept.value);

                          return (
                            <button
                              key={concept.value}
                              type="button"
                              onClick={() => toggleConcept(concept.value)}
                              className={`rounded-full px-3 py-1.5 text-sm transition ${
                                isSelected
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {concept.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  
                </>
              ) : createExamStep === 2 ? (
                <div>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5B4FE9]">
                      Questions
                    </p>
                    <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#1E293B]">
                      Pick from question bank
                    </h3>
                    <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#5B6B82]">
                      Questions are mapped to concept intelligence - type, Bloom level and depth of knowledge.
                    </p>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[14px] font-medium text-[#475569]">
                        {selectedQuestions.length} selected - {selectedQuestionMarks} marks
                      </p>
                      <div className="inline-flex rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[13px] font-semibold text-[#4C3DD3]">
                        {selectedStandard} - {selectedSubject}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {(
                        [
                          {
                            key: 'dok' as const,
                            label: 'DOK level',
                            options: mappingLevels.dok,
                            selected: selectedDokLevels,
                            setSelected: setSelectedDokLevels,
                          },
                          {
                            key: 'bloom' as const,
                            label: "Bloom's level",
                            options: mappingLevels.bloom,
                            selected: selectedBloomLevels,
                            setSelected: setSelectedBloomLevels,
                          },
                        ]
                      ).map((filter) => (
                        <div key={filter.key} className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenLevelDropdown(openLevelDropdown === filter.key ? null : filter.key)
                            }
                            className="inline-flex items-center gap-2 rounded-[12px] border border-[#D8E1EE] bg-white px-4 py-2.5 text-[14px] font-medium text-[#334155] shadow-sm transition hover:border-[#B9C7DD]"
                          >
                            {filter.label}
                            {filter.selected.length > 0 ? (
                              <span className="rounded-full bg-[#5B4FE9] px-2 py-0.5 text-[11px] font-semibold text-white">
                                {filter.selected.length}
                              </span>
                            ) : null}
                            <ChevronDown
                              className={`h-4 w-4 text-[#94A3B8] transition-transform ${
                                openLevelDropdown === filter.key ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {openLevelDropdown === filter.key ? (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenLevelDropdown(null)}
                              />
                              <div className="absolute left-0 z-20 mt-2 w-60 rounded-[14px] border border-[#DCE4F0] bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
                                {filter.options.length === 0 ? (
                                  <p className="px-3 py-2 text-[13px] text-[#64748B]">
                                    No levels available.
                                  </p>
                                ) : (
                                  filter.options.map((level) => {
                                    const isSelected = filter.selected.includes(level.id);

                                    return (
                                      <label
                                        key={level.id}
                                        className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] text-[#334155] transition hover:bg-[#F4F6FB]"
                                      >
                                        <input
                                          type="checkbox"
                                          className="sr-only"
                                          checked={isSelected}
                                          onChange={() =>
                                            filter.setSelected((current) =>
                                              current.includes(level.id)
                                                ? current.filter((id) => id !== level.id)
                                                : [...current, level.id]
                                            )
                                          }
                                        />
                                        <span
                                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition ${
                                            isSelected
                                              ? 'border-[#5B4FE9] bg-[#5B4FE9] text-white'
                                              : 'border-[#CBD5E1] bg-white text-transparent'
                                          }`}
                                        >
                                          <Check size={13} strokeWidth={3} />
                                        </span>
                                        {level.name}
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            </>
                          ) : null}
                        </div>
                      ))}

                      {selectedDokLevels.length > 0 || selectedBloomLevels.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDokLevels([]);
                            setSelectedBloomLevels([]);
                            setOpenLevelDropdown(null);
                          }}
                          className="text-[13px] font-medium text-[#5B4FE9] transition hover:text-[#4338CA]"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>

                    {isQuestionsLoading ? (
                      <div className="mt-5 rounded-[20px] border border-[#DCE4F0] p-6 text-center text-[14px] text-[#64748B]">
                        Loading questions...
                      </div>
                    ) : questionsError ? (
                      <div className="mt-5 rounded-[20px] border border-red-200 p-4 text-[14px] text-red-600">
                        {questionsError}
                      </div>
                    ) : questionRows.length === 0 ? (
                      <div className="mt-5 rounded-[20px] border border-[#DCE4F0] p-6 text-center text-[14px] text-slate-500">
                        {selectedDokLevels.length > 0 || selectedBloomLevels.length > 0
                          ? 'No questions match the selected DOK / Bloom levels. Try clearing the filters.'
                          : 'No questions found for the selected concepts.'}
                      </div>
                    ) : (
                      <div className="mt-5 overflow-hidden rounded-[20px] border border-[#DCE4F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                        <div className="overflow-x-auto">
                          <div className="max-h-[min(44vh,420px)] overflow-y-auto">
                            <table className="w-full min-w-[920px] border-separate border-spacing-0">
                              <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
                                <tr>
                                  <th className="border-b border-[#E4EAF2] px-4 py-4 text-left">
                                    <button
                                      type="button"
                                      onClick={toggleAllQuestions}
                                      className={`inline-flex h-5 w-5 items-center justify-center rounded-[5px] border transition ${
                                        allQuestionsSelected
                                          ? 'border-[#5B4FE9] bg-[#5B4FE9] text-white'
                                          : 'border-[#CBD5E1] bg-white text-transparent'
                                      }`}
                                      aria-label="Select all questions"
                                    >
                                      <Check size={13} strokeWidth={3} />
                                    </button>
                                  </th>
                                  {['Question', 'Concept', 'Type', 'Bloom', 'Difficulty', 'Marks'].map((heading) => (
                                    <th
                                      key={heading}
                                      className="border-b border-[#E4EAF2] px-4 py-4 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[#64748B]"
                                    >
                                      {heading}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {questionRows.map((question) => {
                                  const isSelected = selectedQuestions.includes(question.id);

                                  return (
                                    <tr key={question.id} className={isSelected ? 'bg-[#FBFAFF]' : 'bg-white'}>
                                      <td className="border-b border-[#E4EAF2] px-4 py-4 align-top">
                                        <button
                                          type="button"
                                          onClick={() => toggleQuestion(question.id)}
                                          className={`inline-flex h-5 w-5 items-center justify-center rounded-[5px] border transition ${
                                            isSelected
                                              ? 'border-[#5B4FE9] bg-[#5B4FE9] text-white'
                                              : 'border-[#CBD5E1] bg-white text-transparent'
                                          }`}
                                          aria-label={`Select question ${question.id}`}
                                        >
                                          <Check size={13} strokeWidth={3} />
                                        </button>
                                      </td>
                                      <td className="border-b border-[#E4EAF2] px-4 py-4 text-[14px] leading-6 text-[#0F172A]">
                                        {question.question}
                                      </td>
                                      <td className="border-b border-[#E4EAF2] px-4 py-4 text-[14px] leading-6 text-[#51657F]">
                                        {question.concept}
                                      </td>
                                      <td className="border-b border-[#E4EAF2] px-4 py-4 text-[14px] text-[#0F172A]">
                                        {question.type}
                                      </td>
                                      <td className="border-b border-[#E4EAF2] px-4 py-4 text-[14px] text-[#0F172A]">
                                        {question.bloom}
                                      </td>
                                      <td className="border-b border-[#E4EAF2] px-4 py-4 text-[14px] text-[#0F172A]">
                                        {question.difficulty}
                                      </td>
                                      <td className="border-b border-[#E4EAF2] px-4 py-4 text-[14px] font-semibold text-[#0F172A]">
                                        {question.marks}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                   
                  </div>
                </div>
              ) : createExamStep === 3 ? (
                <div>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5B4FE9]">
                      Configuration
                    </p>
                    <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#1E293B]">
                      Dates, attempts, marks
                    </h3>

                    <div className="mt-6 space-y-5">
                      <label className="block">
                        <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                          Exam Name <span className="text-[#DC2626]">*</span>
                        </span>
                        <input
                          type="text"
                          value={examName}
                          onChange={(event) => setExamName(event.target.value)}
                          placeholder="e.g. Sound - concept check 3"
                          className="h-12 w-full rounded-[12px] border border-[#C9D4E5] bg-white px-4 text-[15px] font-medium text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#5B4FE9]"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2.5 flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                          Description
                          <AiFieldAssistant
                            value={examDescription}
                            onApply={setExamDescription}
                            fieldType="instructions"
                            label="Exam description"
                            module="lms"
                            page="Online exam"
                            entityType="exam_paper"
                            related={{ "Exam name": examName }}
                          />
                        </span>
                        <textarea
                          value={examDescription}
                          onChange={(event) => setExamDescription(event.target.value)}
                          placeholder="Shown to students before they start"
                          className="min-h-[104px] w-full rounded-[12px] border border-[#C9D4E5] bg-white px-4 py-3 text-[15px] font-medium text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#5B4FE9]"
                        />
                      </label>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                            Exam Type
                          </span>
                          <div className="relative">
                            <select
                              value={examType}
                              onChange={(event) => setExamType(event.target.value)}
                              className="h-12 w-full appearance-none rounded-[12px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                            >
                              <option value="">Select exam type</option>
                              {examTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          </div>
                        </label>

                        <label className="block">
                          <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                            Attempts Allowed
                          </span>
                          <div className="relative">
                            <select
                              value={attemptsAllowed}
                              onChange={(event) => setAttemptsAllowed(event.target.value)}
                              className="h-12 w-full appearance-none rounded-[12px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                            >
                              <option value="">Select attempts</option>
                              {attemptsAllowedOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          </div>
                        </label>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                            Open Date
                          </span>
                          <input
                            type="date"
                            value={openDate}
                            onChange={(event) => setOpenDate(event.target.value)}
                            className="h-12 w-full rounded-[12px] border border-[#C9D4E5] bg-white px-4 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                            Close Date
                          </span>
                          <input
                            type="date"
                            value={closeDate}
                            onChange={(event) => setCloseDate(event.target.value)}
                            className="h-12 w-full rounded-[12px] border border-[#C9D4E5] bg-white px-4 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                          />
                        </label>
                      </div>

                      <label className="block max-w-[260px]">
                        <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                          Time Limit (Minutes)
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={timeLimitMinutes}
                          onChange={(event) => setTimeLimitMinutes(event.target.value)}
                          className="h-12 w-full rounded-[12px] border border-[#C9D4E5] bg-white px-4 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                        />
                      </label>

                      <div className="grid gap-4 border-t border-[#E4EAF2] pt-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[13px] font-medium text-[#64748B]">Total questions</p>
                          <p className="mt-1 text-[20px] font-semibold text-[#1E293B]">
                           {selectedQuestions.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-[#64748B]">Total marks</p>
                          <p className="mt-1 text-[20px] font-semibold text-[#1E293B]">
                            {selectedQuestionMarks}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5B4FE9]">
                    Review & publish
                  </p>
                  <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#1E293B]">
                    Review & publish
                  </h3>

                  <div className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                    <div>
                      <p className="text-[14px] text-[#64748B]">Exam name</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">
                        {examName || 'Untitled exam'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Type</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{examType || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Standard</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{selectedStandard}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Subject</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{selectedSubject}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Concepts</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{selectedConcepts.length}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Questions</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{selectedQuestions.length}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Total marks</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{selectedQuestionMarks}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Attempts allowed</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{attemptsAllowed || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Open date</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{formatDisplayDate(openDate)}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Close date</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{formatDisplayDate(closeDate)}</p>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#64748B]">Time limit</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">
                        {timeLimitMinutes ? `${timeLimitMinutes} minutes` : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 rounded-[16px] border border-[#D7DEFF] bg-[#F7F8FF] px-4 py-3 text-[14px] text-[#4C3DD3]">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="mt-0.5 shrink-0" />
                      <p>
                        Publishing makes this exam visible to the selected standard from the open date.
                      </p>
                    </div>
                  </div>

                  {publishError ? (
                    <div className="mt-4 rounded-[16px] border border-[#F3C7C7] bg-[#FEF2F2] px-4 py-3 text-[14px] text-[#B91C1C]">
                      {publishError}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[#E4EAF2] bg-white px-5 py-4 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={createExamStep === 1 || isPublishing}
                onClick={() => setCreateExamStep((current) => Math.max(1, current - 1))}
                className={`inline-flex h-11 items-center gap-2 rounded-[12px] px-4 text-[15px] font-semibold ${
                  createExamStep === 1 || isPublishing
                    ? 'text-[#B4BFD0]'
                    : 'text-[#475569] transition hover:bg-[#F5F7FB]'
                }`}
              >
                <ArrowLeft size={18} />
                Back
              </button>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateExamModal}
                  disabled={isPublishing}
                  className="inline-flex h-11 items-center justify-center rounded-[12px] px-4 text-[15px] font-semibold text-[#334155] transition hover:bg-[#F5F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createExamStep === 4 ? publishExam : goToNextExamStep}
                  disabled={isPublishing || (createExamStep === 2 && selectedQuestions.length === 0)}
                  className={`inline-flex h-[50px] items-center justify-center gap-2 rounded-[16px] px-6 text-[15px] font-semibold transition ${
                    isPublishing || (createExamStep === 2 && selectedQuestions.length === 0)
                      ? 'bg-[#C7C2FA] text-white shadow-none'
                      : 'bg-[#5846EA] text-white shadow-[0_14px_28px_rgba(88,70,234,0.28)] hover:bg-[#4C3DD3]'
                  }`}
                >
                  {createExamStep === 4 ? (
                    <>
                      <Send size={18} />
                      {isPublishing ? 'Publishing...' : 'Publish exam'}
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 16mm;
          }

          body {
            background: #fff !important;
          }

          body * {
            visibility: hidden;
          }

          header,
          aside,
          nav,
          .sidebar,
          .app-header,
          .floating-toolbar {
            display: none !important;
          }

          .offline-question-paper,
          .offline-question-paper * {
            visibility: visible;
          }

          .offline-question-paper {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 20px !important;
            background: #fff !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
          }

          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
