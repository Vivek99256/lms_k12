'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  GraduationCap,
  Info,
  LayoutGrid,
  Monitor,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';

type ExamStatus = 'Scheduled' | 'Open' | 'Draft' | 'Closed';
type ExamType = 'Practice' | 'Term' | 'Diagnostic';
type AudienceMode = 'Teacher' | 'Student';

type ExamRecord = {
  id: string;
  name: string;
  classLabel: string;
  type: ExamType;
  window: string;
  attempts: number;
  questions: number;
  marks: number;
  status: ExamStatus;
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

const INITIAL_EXAMS: ExamRecord[] = [
  {
    id: 'EXM-0150',
    name: 'Sound - concept check 2',
    classLabel: 'Grade 8 - Science',
    type: 'Practice',
    window: '8 Jul 2026 - 12 Jul 2026',
    attempts: 2,
    questions: 12,
    marks: 20,
    status: 'Scheduled',
  },
  {
    id: 'EXM-0146',
    name: 'Sound - concept check 1',
    classLabel: 'Grade 8 - Science',
    type: 'Practice',
    window: '29 Jun 2026 - 3 Jul 2026',
    attempts: 3,
    questions: 10,
    marks: 10,
    status: 'Open',
  },
  {
    id: 'EXM-0152',
    name: 'Term 1 mid-term - Science',
    classLabel: 'Grade 8 - Science',
    type: 'Term',
    window: '27 Jul 2026',
    attempts: 1,
    questions: 30,
    marks: 80,
    status: 'Draft',
  },
  {
    id: 'EXM-0128',
    name: 'Force and pressure - unit test',
    classLabel: 'Grade 8 - Science',
    type: 'Term',
    window: '24 Apr 2026',
    attempts: 1,
    questions: 25,
    marks: 50,
    status: 'Closed',
  },
  {
    id: 'EXM-0141',
    name: 'Sound - chapter diagnostic',
    classLabel: 'Grade 8 - Science',
    type: 'Diagnostic',
    window: '22 Jun 2026 - 26 Jun 2026',
    attempts: 1,
    questions: 15,
    marks: 15,
    status: 'Closed',
  },
  {
    id: 'EXM-0139',
    name: 'Friction - unit test',
    classLabel: 'Grade 8 - Science',
    type: 'Term',
    window: '18 May 2026',
    attempts: 1,
    questions: 25,
    marks: 50,
    status: 'Closed',
  },
];

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

const topTabs = [
  { label: 'LMS', icon: LayoutGrid, active: false },
  { label: 'Teach / learn', icon: BookOpen, active: false },
  { label: 'Test', icon: FileText, active: true },
];

const innerTabs = [
  { label: 'Exams', icon: FileText, active: true },
  { label: 'Results dashboard', icon: GraduationCap, active: false },
];

const standardOptions = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
const subjectOptions = ['Science', 'Mathematics', 'English'];
const examTypeOptions = ['Practice', 'Term', 'Diagnostic'];
const attemptsAllowedOptions = ['1 attempt', '2 attempts', '3 attempts'];

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

const chapterOptions = [
  {
    id: 'force-pressure',
    label: 'Chapter 1 - Force and pressure',
    conceptCount: '3 concepts',
  },
  {
    id: 'friction',
    label: 'Chapter 2 - Friction',
    conceptCount: '3 concepts',
  },
  {
    id: 'sound',
    label: 'Chapter 3 - Sound',
    conceptCount: '4 concepts',
  },
];

const conceptOptions = [
  { id: 'vibration', label: 'Vibration and sound production' },
  { id: 'amplitude', label: 'Amplitude, frequency and pitch' },
  { id: 'audible', label: 'Audible and inaudible sounds' },
  { id: 'noise', label: 'Noise and music' },
];

const questionBank: QuestionRecord[] = [
  {
    id: 'q-1',
    question: 'Select all sounds that are ultrasonic.',
    concept: 'Audible and inaudible sounds',
    type: 'Multiple answer',
    bloom: 'Apply',
    difficulty: 'Medium',
    marks: 4,
  },
  {
    id: 'q-2',
    question: 'Describe two practical uses of ultrasound in medicine or industry.',
    concept: 'Audible and inaudible sounds',
    type: 'Narrative',
    bloom: 'Understand',
    difficulty: 'Medium',
    marks: 5,
  },
  {
    id: 'q-3',
    question: 'Select all factors that increase the loudness of a drum beat.',
    concept: 'Amplitude, frequency and pitch',
    type: 'Multiple answer',
    bloom: 'Apply',
    difficulty: 'Easy',
    marks: 4,
  },
  {
    id: 'q-4',
    question: 'Explain how vibration frequency changes the pitch of a guitar string.',
    concept: 'Amplitude, frequency and pitch',
    type: 'Short answer',
    bloom: 'Analyze',
    difficulty: 'Hard',
    marks: 6,
  },
  {
    id: 'q-5',
    question: 'Match each sound source to the kind of vibration it produces.',
    concept: 'Vibration and sound production',
    type: 'Match',
    bloom: 'Understand',
    difficulty: 'Easy',
    marks: 3,
  },
];

export default function StudentHomeworkIndexPage() {
  const [exams, setExams] = useState<ExamRecord[]>(INITIAL_EXAMS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('Teacher');
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [createExamStep, setCreateExamStep] = useState(1);
  const [selectedStandard, setSelectedStandard] = useState('Grade 8');
  const [selectedSubject, setSelectedSubject] = useState('Science');
  const [selectedChapters, setSelectedChapters] = useState<string[]>(['sound']);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>(['amplitude', 'audible']);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [examName, setExamName] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examType, setExamType] = useState('Practice');
  const [attemptsAllowed, setAttemptsAllowed] = useState('2 attempts');
  const [openDate, setOpenDate] = useState('2026-07-08');
  const [closeDate, setCloseDate] = useState('2026-07-12');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('40');

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

  const toggleChapter = (chapterId: string) => {
    setSelectedChapters((current) => {
      if (current.includes(chapterId)) {
        return current.filter((item) => item !== chapterId);
      }

      return [...current, chapterId];
    });
  };

  const toggleConcept = (conceptId: string) => {
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
      current.length === questionBank.length ? [] : questionBank.map((question) => question.id)
    );
  };

  const openCreateExamModal = () => {
    setCreateExamStep(1);
    setSelectedQuestions([]);
    setExamName('');
    setExamDescription('');
    setExamType('Practice');
    setAttemptsAllowed('2 attempts');
    setOpenDate('2026-07-08');
    setCloseDate('2026-07-12');
    setTimeLimitMinutes('40');
    setIsCreateExamOpen(true);
  };

  const closeCreateExamModal = () => {
    setIsCreateExamOpen(false);
    setCreateExamStep(1);
  };

  const selectedQuestionMarks = useMemo(() => {
    return questionBank
      .filter((question) => selectedQuestions.includes(question.id))
      .reduce((total, question) => total + question.marks, 0);
  }, [selectedQuestions]);

  const allQuestionsSelected =
    questionBank.length > 0 && selectedQuestions.length === questionBank.length;

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

  const goToNextExamStep = () => {
    if (createExamStep === 1) {
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

  const publishExam = () => {
    const now = new Date();
    const selectedOpenDate = openDate ? new Date(`${openDate}T00:00:00`) : null;
    const isOpen =
      selectedOpenDate !== null && !Number.isNaN(selectedOpenDate.getTime()) && selectedOpenDate <= now;
    const examStatus: ExamStatus = isOpen ? 'Open' : 'Scheduled';
    const attemptsMatch = attemptsAllowed.match(/\d+/);
    const attempts = attemptsMatch ? Number(attemptsMatch[0]) : 1;
    const examId = `EXM-${String(1600 + exams.length + 1).padStart(4, '0')}`;

    const newExam: ExamRecord = {
      id: examId,
      name: examName.trim() || 'Untitled exam',
      classLabel: `${selectedStandard} - ${selectedSubject}`,
      type: examType as ExamType,
      window:
        openDate && closeDate
          ? openDate === closeDate
            ? formatDisplayDate(openDate)
            : `${formatDisplayDate(openDate)} - ${formatDisplayDate(closeDate)}`
          : formatDisplayDate(openDate) || formatDisplayDate(closeDate),
      attempts,
      questions: selectedQuestions.length,
      marks: selectedQuestionMarks,
      status: examStatus,
    };

    setExams((current) => [newExam, ...current]);
    closeCreateExamModal();
  };

  useEffect(() => {
    if (!isCreateExamOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateExamOpen]);

  return (
    <>
      <div className="min-h-full bg-[#EAF0F8] px-4 py-4 sm:px-5 lg:px-6 rounded-t-3xl" >
        <div className="mx-auto w-full max-w-[1540px]">
          <section className="rounded-[24px] border border-[#D9E3F1] bg-[#EAF0F8] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:p-5">
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

              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <span className="text-[13px] font-medium text-[#6B7B91]">Viewing as</span>
                <div className="inline-flex rounded-[14px] border border-[#DFE6F2] bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                  <button
                    type="button"
                    onClick={() => setAudienceMode('Teacher')}
                    className={`inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[14px] font-semibold transition ${
                      audienceMode === 'Teacher'
                        ? 'border border-[#7C6CF4] bg-white text-[#1F2A44] shadow-[0_4px_12px_rgba(124,108,244,0.18)]'
                        : 'text-[#6B7B91]'
                    }`}
                  >
                    <Monitor size={16} />
                    Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode('Student')}
                    className={`inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[14px] font-semibold transition ${
                      audienceMode === 'Student'
                        ? 'border border-[#7C6CF4] bg-white text-[#1F2A44] shadow-[0_4px_12px_rgba(124,108,244,0.18)]'
                        : 'text-[#6B7B91]'
                    }`}
                  >
                    <GraduationCap size={16} />
                    Student
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-[#E0E7F1] bg-white p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-1.5 md:flex-row md:items-center">
                {topTabs.map((tab, index) => {
                  const TabIcon = tab.icon;

                  return (
                    <div key={tab.label} className="flex items-center">
                      <button
                        type="button"
                        className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-[14px] font-semibold transition ${
                          tab.active
                            ? 'bg-[#5846EA] text-white shadow-[0_10px_20px_rgba(88,70,234,0.28)]'
                            : 'text-[#66758B]'
                        }`}
                      >
                        <TabIcon size={16} />
                        {tab.label}
                      </button>
                      {index < topTabs.length - 1 ? (
                        <span className="mx-2 hidden h-6 w-px bg-[#E7EDF5] md:block" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

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
                          <option>Practice</option>
                          <option>Term</option>
                          <option>Diagnostic</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8798]" />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openCreateExamModal}
                  className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-[12px] bg-[#5846EA] px-4 text-[14px] font-semibold text-white shadow-[0_12px_24px_rgba(88,70,234,0.28)] transition hover:bg-[#4C3DD3]"
                >
                  <Plus size={18} />
                  Create exam
                </button>
              </div>

              <p className="text-[14px] font-medium text-[#5F7087]">
                {filteredExams.length} of {exams.length} exams
              </p>

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

                {filteredExams.length === 0 ? (
                  <div className="px-6 py-12 text-center text-[14px] text-[#6B7B91]">
                    No exams match the current search and filters.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          </section>
        </div>
      </div>

      {isCreateExamOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0F172A]/52 px-3 py-3 backdrop-blur-[2px] sm:px-6 sm:py-6">
          <div className="flex h-[90vh] max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[#DCE4F0] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="shrink-0 border-b border-[#E4EAF2] bg-white px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-center justify-between">
              <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-[#1E293B]">
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

            <div className="shrink-0 border-b border-[#E4EAF2] bg-white px-5 py-5 sm:px-7 sm:py-6">
              <div className="grid gap-5 sm:grid-cols-4 sm:gap-3">
                {createExamSteps.map((step, index) => {
                  const isCompleted = createExamStep > step.id;
                  const isActive = createExamStep === step.id;
                  const isLast = index === createExamSteps.length - 1;

                  return (
                    <div key={step.id} className="relative">
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[15px] font-semibold ${
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
                            className={`text-[15px] font-semibold ${
                              isActive || isCompleted ? 'text-[#5B4FE9]' : 'text-[#51657F]'
                            }`}
                          >
                            {step.title}
                          </p>
                          {step.description ? (
                            <p className="mt-1 max-w-[130px] text-[13px] leading-6 text-[#51657F]">
                              {step.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {!isLast ? (
                        <span className="absolute left-[132px] top-4 hidden h-px w-[calc(100%-140px)] bg-[#CBD5E1] sm:block" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {createExamStep === 1 ? (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                        Standard
                      </span>
                      <div className="relative">
                        <select
                          value={selectedStandard}
                          onChange={(event) => setSelectedStandard(event.target.value)}
                          className="h-12 w-full appearance-none rounded-[12px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                        >
                          {standardOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                        Subject
                      </span>
                      <div className="relative">
                        <select
                          value={selectedSubject}
                          onChange={(event) => setSelectedSubject(event.target.value)}
                          className="h-12 w-full appearance-none rounded-[12px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                        >
                          {subjectOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      </div>
                    </label>
                  </div>

                  <div className="mt-6">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                      Chapters
                    </p>
                    <div className="mt-3 space-y-3">
                      {chapterOptions.map((chapter) => {
                        const isSelected = selectedChapters.includes(chapter.id);

                        return (
                          <label
                            key={chapter.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-[16px] border px-3 py-3 transition ${
                              isSelected
                                ? 'border-[#D8D1FF] bg-[#F7F5FF]'
                                : 'border-transparent bg-transparent hover:bg-[#F8FAFC]'
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
                              <span className={`block text-[15px] font-medium ${isSelected ? 'text-[#4338CA]' : 'text-[#1E293B]'}`}>
                                {chapter.label}
                              </span>
                              <span className="mt-1 block text-[13px] text-[#64748B]">
                                {chapter.conceptCount}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                      Concepts
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {conceptOptions.map((concept) => {
                        const isSelected = selectedConcepts.includes(concept.id);

                        return (
                          <button
                            key={concept.id}
                            type="button"
                            onClick={() => toggleConcept(concept.id)}
                            className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition ${
                              isSelected
                                ? 'bg-[#5B4FE9] text-white shadow-[0_8px_16px_rgba(91,79,233,0.18)]'
                                : 'bg-[#EEF2F7] text-[#51657F]'
                            }`}
                          >
                            {concept.label}
                          </button>
                        );
                      })}
                    </div>
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
                              {questionBank.map((question) => {
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
                        <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                          Description
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
                              {examTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
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
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{examType}</p>
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
                      <p className="mt-1 text-[16px] font-semibold text-[#1E293B]">{attemptsAllowed}</p>
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
                        {timeLimitMinutes} minutes
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
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[#E4EAF2] bg-white px-5 py-4 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={createExamStep === 1}
                onClick={() => setCreateExamStep((current) => Math.max(1, current - 1))}
                className={`inline-flex h-11 items-center gap-2 rounded-[12px] px-4 text-[15px] font-semibold ${
                  createExamStep === 1
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
                  className="inline-flex h-11 items-center justify-center rounded-[12px] px-4 text-[15px] font-semibold text-[#334155] transition hover:bg-[#F5F7FB]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createExamStep === 4 ? publishExam : goToNextExamStep}
                  disabled={createExamStep === 2 && selectedQuestions.length === 0}
                  className={`inline-flex h-[50px] items-center justify-center gap-2 rounded-[16px] px-6 text-[15px] font-semibold transition ${
                    createExamStep === 2 && selectedQuestions.length === 0
                      ? 'bg-[#C7C2FA] text-white shadow-none'
                      : 'bg-[#5846EA] text-white shadow-[0_14px_28px_rgba(88,70,234,0.28)] hover:bg-[#4C3DD3]'
                  }`}
                >
                  {createExamStep === 4 ? (
                    <>
                      <Send size={18} />
                      Publish exam
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
          </div>
        </div>
      ) : null}
    </>
  );
}
