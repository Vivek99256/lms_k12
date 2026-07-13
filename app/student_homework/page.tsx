'use client';

import { useEffect, useMemo, useState } from 'react';
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
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type ExamStatus = 'Scheduled' | 'Open' | 'Draft' | 'Closed';
type AudienceMode = 'Teacher' | 'Student';
type StudentLearningTab = 'PAL' | 'Online Exam' | 'Offline Exam';

type StudentConceptStatus = 'Mastered' | 'In progress' | 'Locked';

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

type StudentExamStatus = 'Available' | 'Upcoming' | 'Completed' | 'Closed';

type StudentOnlineExamRecord = {
  id: string;
  name: string;
  standard: string;
  subject: string;
  classLabel: string;
  chapter: string;
  availabilityWindow: string;
  questions: number;
  marks: number;
  durationMinutes: number;
  attempts: string;
  status: StudentExamStatus;
  actionLabel: string;
  actionDisabled?: boolean;
};

type StudentOnlineQuestionOption = {
  id: string;
  label: string;
};

type StudentOnlineQuestion = {
  id: string;
  question: string;
  marks: number;
  options: StudentOnlineQuestionOption[];
  correctOptionId: string;
};

type StudentOnlineQuestionPaper = {
  examId: string;
  badgeLabel: string;
  questions: StudentOnlineQuestion[];
};

type StudentOfflineExamRecord = {
  id: string;
  name: string;
  standard: string;
  subject: string;
  classLabel: string;
  chapter: string;
  examDate: string;
  examTime: string;
  questions: number;
  durationMinutes: number;
  instructions?: string[];
  venue?: string;
  marks: number;
  status: StudentExamStatus;
  actionLabel: string;
  actionDisabled?: boolean;
};

type StudentOfflineQuestionPaper = {
  examId: string;
  instructions: string[];
  questions: StudentOnlineQuestion[];
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
  correctOptionId: string;
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
  paper_name?: string | null;
  paper_desc?: string | null;
  open_date?: string | null;
  close_date?: string | null;
  attempt_allowed?: number | string | null;
  total_ques?: number | string | null;
  total_marks?: number | string | null;
  exam_type?: string | null;
  standard_name?: string | number | null;
  subject_name?: string | null;
  active_exam?: string | null;
};

type QuestionPaperApiResponse = {
  status_code?: number;
  message?: string;
  data?: ApiQuestionPaperRecord[];
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

const examTypeOptions = ['Practice', 'Term', 'Diagnostic'];
const attemptsAllowedOptions = ['1 attempt', '2 attempts', '3 attempts'];

const innerTabs = [
  { label: 'Exams', icon: FileText, active: true },
  { label: 'Results dashboard', icon: GraduationCap, active: false },
];

const studentViewTabs: Array<{ label: StudentLearningTab; icon: LucideIcon }> = [
  { label: 'PAL', icon: Monitor },
  { label: 'Online Exam', icon: FileText },
  { label: 'Offline Exam', icon: BookOpen },
];

const studentChapterProgressData: StudentChapterProgress[] = [
  {
    chapterId: 1,
    chapterTitle: 'Sound - Chapter 3',
    badgeLabel: 'Science · Grade 8 A',
    chapterMastery: 50,
    conceptsMastered: '2 of 4',
    averageMastery: '58%',
    practiceAttempts: '6',
    masteryThreshold: '75%',
    concepts: [
      {
        id: 'c1',
        title: 'Vibration and sound production',
        subtitle: 'Mastered · 2 attempts',
        mastery: 92,
        attemptsLabel: '92%',
        attemptsCount: 2,
        status: 'Mastered',
        canLearn: true,
        canPractice: false,
      },
      {
        id: 'c2',
        title: 'Amplitude, frequency and pitch',
        subtitle: 'Mastered · 3 attempts',
        mastery: 84,
        attemptsLabel: '84%',
        attemptsCount: 3,
        status: 'Mastered',
        canLearn: true,
        canPractice: false,
      },
      {
        id: 'c3',
        title: 'Audible and inaudible sounds',
        subtitle: '1 attempt · unlimited retakes until 75%',
        mastery: 55,
        attemptsLabel: '55%',
        attemptsCount: 1,
        status: 'In progress',
        canLearn: true,
        canPractice: true,
      },
      {
        id: 'c4',
        title: 'Noise and music',
        subtitle: 'Locked — master the previous concept to unlock',
        mastery: 0,
        attemptsLabel: '0%',
        attemptsCount: 0,
        status: 'Locked',
        canLearn: false,
        canPractice: false,
      },
    ],
  },
];

const studentPracticeAssessments: StudentPracticeAssessment[] = [
  {
    conceptId: 'c3',
    durationMinutes: 2,
    masteryTarget: 75,
    questions: [
      {
        id: 'c3-q1',
        question: 'Sounds with a frequency above 20,000 Hz are called...',
        marks: 2,
        correctOptionId: 'ultrasonic',
        options: [
          { id: 'ultrasonic', label: 'Ultrasonic sounds' },
          { id: 'infrasonic', label: 'Infrasonic sounds' },
          { id: 'audible', label: 'Audible sounds' },
        ],
      },
      {
        id: 'c3-q2',
        question: 'Which of the following is a common use of ultrasonic sound?',
        marks: 2,
        correctOptionId: 'scan',
        options: [
          { id: 'scan', label: 'Medical imaging and scanning' },
          { id: 'music', label: 'Playing classroom music' },
          { id: 'alarm', label: 'Human speech amplification' },
        ],
      },
    ],
  },
  {
    conceptId: 'c4',
    durationMinutes: 2,
    masteryTarget: 75,
    questions: [
      {
        id: 'c4-q1',
        question: 'Unwanted and unpleasant sound is called...',
        marks: 2,
        correctOptionId: 'noise',
        options: [
          { id: 'noise', label: 'Noise' },
          { id: 'music', label: 'Music' },
          { id: 'pitch', label: 'Pitch' },
        ],
      },
      {
        id: 'c4-q2',
        question: 'Which action can help reduce classroom noise levels?',
        marks: 2,
        correctOptionId: 'padding',
        options: [
          { id: 'padding', label: 'Adding soft materials and maintaining discipline' },
          { id: 'shouting', label: 'Speaking louder than everyone else' },
          { id: 'metal', label: 'Using more metal surfaces' },
        ],
      },
    ],
  },
];

const studentOnlineExams: StudentOnlineExamRecord[] = [
  {
    id: 'ONL-301',
    name: 'Sound - term paper',
    standard: 'Grade 8',
    subject: 'Science',
    classLabel: 'Science - Grade 8 A',
    chapter: 'Sound',
    availabilityWindow: '15 Jul 2026 - 18 Jul 2026',
    questions: 5,
    marks: 10,
    durationMinutes: 40,
    attempts: 'Not attempted',
    status: 'Available',
    actionLabel: 'Open question paper',
  },
  {
    id: 'ONL-284',
    name: 'Chapter Review - Light and Reflection',
    standard: 'Grade 8',
    subject: 'Science',
    classLabel: 'Science - Grade 8 A',
    chapter: 'Light and Reflection',
    availabilityWindow: '20 Jul 2026 - 20 Jul 2026',
    questions: 10,
    marks: 20,
    durationMinutes: 30,
    attempts: '1 attempt',
    status: 'Upcoming',
    actionLabel: 'Open question paper',
  },
  {
    id: 'ONL-260',
    name: 'Term Practice - Force and Pressure',
    standard: 'Grade 7',
    subject: 'Science',
    classLabel: 'Science - Grade 8 A',
    chapter: 'Force and Pressure',
    availabilityWindow: '05 Jul 2026 - 07 Jul 2026',
    questions: 15,
    marks: 30,
    durationMinutes: 35,
    attempts: 'Completed',
    status: 'Completed',
    actionLabel: 'Open question paper',
  },
];

const studentOnlineQuestionPapers: StudentOnlineQuestionPaper[] = [
  {
    examId: 'ONL-301',
    badgeLabel: 'Question paper',
    questions: [
      {
        id: 'onl-301-q1',
        question: 'Which property of a vibrating body determines the loudness of the sound produced?',
        marks: 2,
        correctOptionId: 'amplitude',
        options: [
          { id: 'amplitude', label: 'Amplitude' },
          { id: 'frequency', label: 'Frequency' },
          { id: 'wavelength', label: 'Wavelength' },
        ],
      },
      {
        id: 'onl-301-q2',
        question: 'The number of oscillations per second is called the...',
        marks: 2,
        correctOptionId: 'frequency',
        options: [
          { id: 'frequency', label: 'Frequency' },
          { id: 'amplitude', label: 'Amplitude' },
          { id: 'time-period', label: 'Time period' },
        ],
      },
      {
        id: 'onl-301-q3',
        question: 'Sounds with a frequency above 20,000 Hz are called...',
        marks: 2,
        correctOptionId: 'ultrasonic',
        options: [
          { id: 'ultrasonic', label: 'Ultrasonic sounds' },
          { id: 'infrasonic', label: 'Infrasonic sounds' },
          { id: 'audible', label: 'Audible sounds' },
        ],
      },
      {
        id: 'onl-301-q4',
        question: 'A sound is described as musical rather than noisy when it has...',
        marks: 2,
        correctOptionId: 'regular',
        options: [
          { id: 'regular', label: 'Regular, periodic vibrations' },
          { id: 'high', label: 'Very high amplitude' },
          { id: 'irregular', label: 'Irregular vibrations' },
        ],
      },
      {
        id: 'onl-301-q5',
        question: 'Which unit is used to measure the frequency of a sound?',
        marks: 2,
        correctOptionId: 'hertz',
        options: [
          { id: 'hertz', label: 'Hertz' },
          { id: 'decibel', label: 'Decibel' },
          { id: 'metre', label: 'Metre' },
        ],
      },
    ],
  },
];

const studentOfflineExams: StudentOfflineExamRecord[] = [
  {
    id: 'OFF-114',
    name: 'Sound - term paper',
    standard: 'Grade 8',
    subject: 'Science',
    classLabel: 'Science - Grade 8 A',
    chapter: 'Sound',
    examDate: '22 Jul 2026',
    examTime: '10:30 AM - 11:15 AM',
    questions: 5,
    durationMinutes: 40,
    instructions: [
      'All questions are compulsory.',
      'Marks for each question are shown in brackets.',
      'Circle the correct option for multiple-choice questions.',
    ],
    venue: 'Room 204',
    marks: 10,
    status: 'Upcoming',
    actionLabel: 'Print question paper',
  },
  {
    id: 'OFF-108',
    name: 'Lab Observation Assessment',
    standard: 'Grade 8',
    subject: 'Science',
    classLabel: 'Science - Grade 8 A',
    chapter: 'Light and Reflection',
    examDate: '12 Jul 2026',
    examTime: '09:00 AM - 09:30 AM',
    questions: 4,
    durationMinutes: 30,
    instructions: [
      'Answer neatly in the space provided on paper.',
      'Read each question carefully before attempting it.',
      'Use diagrams where necessary.',
    ],
    venue: 'Physics Lab',
    marks: 10,
    status: 'Completed',
    actionLabel: 'Print question paper',
  },
  {
    id: 'OFF-095',
    name: 'Periodic Written Test - Motion',
    standard: 'Grade 7',
    subject: 'Science',
    classLabel: 'Science - Grade 8 A',
    chapter: 'Motion',
    examDate: '02 Jul 2026',
    examTime: '11:45 AM - 12:30 PM',
    questions: 6,
    durationMinutes: 35,
    instructions: [
      'All questions are compulsory.',
      'Write answers in the order of the question paper.',
      'Show rough work only in the margin area.',
    ],
    venue: 'Room 112',
    marks: 20,
    status: 'Closed',
    actionLabel: 'Print question paper',
  },
];

const studentOfflineQuestionPapers: StudentOfflineQuestionPaper[] = [
  {
    examId: 'OFF-114',
    instructions: [
      'All questions are compulsory.',
      'Marks for each question are shown in brackets.',
      'Circle the correct option for multiple-choice questions.',
    ],
    questions: studentOnlineQuestionPapers[0]?.questions ?? [],
  },
  {
    examId: 'OFF-108',
    instructions: [
      'Answer neatly in the space provided on paper.',
      'Read each question carefully before attempting it.',
      'Use diagrams where necessary.',
    ],
    questions: [
      {
        id: 'off-108-q1',
        question: 'Which surface reflects the maximum amount of light regularly?',
        marks: 2,
        correctOptionId: 'mirror',
        options: [
          { id: 'mirror', label: 'A polished mirror' },
          { id: 'wall', label: 'A rough painted wall' },
          { id: 'paper', label: 'A crumpled paper sheet' },
          { id: 'cloth', label: 'A thick cloth surface' },
        ],
      },
      {
        id: 'off-108-q2',
        question: 'The bouncing back of light from a surface is called...',
        marks: 2,
        correctOptionId: 'reflection',
        options: [
          { id: 'reflection', label: 'Reflection' },
          { id: 'refraction', label: 'Refraction' },
          { id: 'dispersion', label: 'Dispersion' },
          { id: 'absorption', label: 'Absorption' },
        ],
      },
      {
        id: 'off-108-q3',
        question: 'Images formed by a plane mirror are always...',
        marks: 3,
        correctOptionId: 'virtual',
        options: [
          { id: 'virtual', label: 'Virtual and erect' },
          { id: 'real', label: 'Real and inverted' },
          { id: 'smaller', label: 'Always smaller than the object' },
          { id: 'colored', label: 'Colored differently from the object' },
        ],
      },
      {
        id: 'off-108-q4',
        question: 'Which device uses multiple reflections to let us see around corners?',
        marks: 3,
        correctOptionId: 'periscope',
        options: [
          { id: 'periscope', label: 'Periscope' },
          { id: 'telescope', label: 'Telescope' },
          { id: 'microscope', label: 'Microscope' },
          { id: 'stethoscope', label: 'Stethoscope' },
        ],
      },
    ],
  },
  {
    examId: 'OFF-095',
    instructions: [
      'All questions are compulsory.',
      'Write answers in the order of the question paper.',
      'Show rough work only in the margin area.',
    ],
    questions: [
      {
        id: 'off-095-q1',
        question: 'The SI unit of speed is...',
        marks: 3,
        correctOptionId: 'ms',
        options: [
          { id: 'ms', label: 'm/s' },
          { id: 'km', label: 'km' },
          { id: 'm', label: 'm' },
          { id: 's', label: 's' },
        ],
      },
      {
        id: 'off-095-q2',
        question: 'If an object covers equal distances in equal intervals of time, it is said to be in...',
        marks: 3,
        correctOptionId: 'uniform',
        options: [
          { id: 'uniform', label: 'Uniform motion' },
          { id: 'random', label: 'Random motion' },
          { id: 'periodic', label: 'Periodic motion' },
          { id: 'vibratory', label: 'Vibratory motion' },
        ],
      },
      {
        id: 'off-095-q3',
        question: 'A change in position of an object with time is called...',
        marks: 4,
        correctOptionId: 'motion',
        options: [
          { id: 'motion', label: 'Motion' },
          { id: 'rest', label: 'Rest' },
          { id: 'force', label: 'Force' },
          { id: 'gravity', label: 'Gravity' },
        ],
      },
      {
        id: 'off-095-q4',
        question: 'Which graph represents uniform motion?',
        marks: 3,
        correctOptionId: 'straight',
        options: [
          { id: 'straight', label: 'A straight line on a distance-time graph' },
          { id: 'curve', label: 'A curved line on a distance-time graph' },
          { id: 'horizontal', label: 'A horizontal line on a speed-time graph at zero' },
          { id: 'zigzag', label: 'A zig-zag line on a graph' },
        ],
      },
      {
        id: 'off-095-q5',
        question: 'The odometer in a vehicle measures...',
        marks: 3,
        correctOptionId: 'distance',
        options: [
          { id: 'distance', label: 'Distance travelled' },
          { id: 'speed', label: 'Instantaneous speed' },
          { id: 'fuel', label: 'Fuel level' },
          { id: 'temperature', label: 'Engine temperature' },
        ],
      },
      {
        id: 'off-095-q6',
        question: 'When speed changes with time, the motion is called...',
        marks: 4,
        correctOptionId: 'nonuniform',
        options: [
          { id: 'nonuniform', label: 'Non-uniform motion' },
          { id: 'uniform', label: 'Uniform motion' },
          { id: 'oscillatory', label: 'Oscillatory motion' },
          { id: 'stationary', label: 'Stationary motion' },
        ],
      },
    ],
  },
];

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

const QUESTION_PAPER_DEFAULTS = {
  subInstituteId: 1,
  syear: 2022,
  userProfileName: 'ADMIN',
  userId: 6956,
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function toDisplayText(value: string | number | null | undefined): string {
  return value == null ? '' : String(value).trim();
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


export default function StudentHomeworkIndexPage() {
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(() => {
    if (typeof window === 'undefined') return 'Teacher';
    const stored = localStorage.getItem('learningManagementAudienceMode');
    return stored === 'Student' ? 'Student' : 'Teacher';
  });
  const [apiExams, setApiExams] = useState<ExamRecord[]>([]);
  const [publishedExams, setPublishedExams] = useState<ExamRecord[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [examLoadError, setExamLoadError] = useState('');
  const [lmsCourses, setLmsCourses] = useState<LmsCoursesSubjectRecord[]>([]);
  const [isLoadingLmsCourses, setIsLoadingLmsCourses] = useState(false);
  const [lmsCoursesError, setLmsCoursesError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [studentLearningTab, setStudentLearningTab] = useState<StudentLearningTab>('PAL');
  const [selectedOnlineStandard, setSelectedOnlineStandard] = useState('Grade 8');
  const [selectedOnlineSubject, setSelectedOnlineSubject] = useState('Science');
  const [selectedOfflineStandard, setSelectedOfflineStandard] = useState('Grade 8');
  const [selectedOfflineSubject, setSelectedOfflineSubject] = useState('Science');
  const [activeOnlineExamId, setActiveOnlineExamId] = useState<string | null>(null);
  const [onlinePaperAnswers, setOnlinePaperAnswers] = useState<Record<string, string>>({});
  const [isSubmittingOnlinePaper, setIsSubmittingOnlinePaper] = useState(false);
  const [completedOnlineExamIds, setCompletedOnlineExamIds] = useState<string[]>([]);
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [createExamStep, setCreateExamStep] = useState(1);
  const [selectedStandard, setSelectedStandard] = useState('');
  const [selectedStandardId, setSelectedStandardId] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [studentChapterProgressList, setStudentChapterProgressList] =
    useState<StudentChapterProgress[]>(studentChapterProgressData);
  const [studentSelectedChapterId, setStudentSelectedChapterId] = useState<number>(
    studentChapterProgressData[0]?.chapterId ?? 0
  );
  const [activePracticeConceptId, setActivePracticeConceptId] = useState<string | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const [practiceTimeLeft, setPracticeTimeLeft] = useState(0);

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [examName, setExamName] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examType, setExamType] = useState('Practice');
  const [attemptsAllowed, setAttemptsAllowed] = useState('2 attempts');
  const [openDate, setOpenDate] = useState('2026-07-08');
  const [closeDate, setCloseDate] = useState('2026-07-12');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('40');
  const exams = useMemo(() => [...publishedExams, ...apiExams], [apiExams, publishedExams]);
  const activeStudentChapter = useMemo(
    () =>
      studentChapterProgressList.find((chapter) => chapter.chapterId === studentSelectedChapterId) ??
      studentChapterProgressList[0],
    [studentChapterProgressList, studentSelectedChapterId]
  );
  const activePracticeAssessment = useMemo(
    () =>
      studentPracticeAssessments.find((assessment) => assessment.conceptId === activePracticeConceptId) ??
      null,
    [activePracticeConceptId]
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
  const onlineStandardOptions = useMemo(
    () => Array.from(new Set(studentOnlineExams.map((exam) => exam.standard))),
    []
  );
  const onlineSubjectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          studentOnlineExams
            .filter((exam) => exam.standard === selectedOnlineStandard)
            .map((exam) => exam.subject)
        )
      ),
    [selectedOnlineStandard]
  );
  const filteredStudentOnlineExams = useMemo(
    () =>
      studentOnlineExams.filter(
        (exam) =>
          exam.standard === selectedOnlineStandard && exam.subject === selectedOnlineSubject
      ),
    [selectedOnlineStandard, selectedOnlineSubject]
  );
  const activeOnlineExam = useMemo(
    () => studentOnlineExams.find((exam) => exam.id === activeOnlineExamId) ?? null,
    [activeOnlineExamId]
  );
  const activeOnlineQuestionPaper = useMemo(
    () =>
      studentOnlineQuestionPapers.find((paper) => paper.examId === activeOnlineExamId) ?? null,
    [activeOnlineExamId]
  );
  const onlineAnsweredCount = activeOnlineQuestionPaper
    ? activeOnlineQuestionPaper.questions.filter((question) => Boolean(onlinePaperAnswers[question.id]))
        .length
    : 0;
  const hasAnsweredAllOnlineQuestions = activeOnlineQuestionPaper
    ? onlineAnsweredCount === activeOnlineQuestionPaper.questions.length
    : false;
  const offlineStandardOptions = useMemo(
    () => Array.from(new Set(studentOfflineExams.map((exam) => exam.standard))),
    []
  );
  const offlineSubjectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          studentOfflineExams
            .filter((exam) => exam.standard === selectedOfflineStandard)
            .map((exam) => exam.subject)
        )
      ),
    [selectedOfflineStandard]
  );
  const filteredStudentOfflineExams = useMemo(
    () =>
      studentOfflineExams.filter(
        (exam) =>
          exam.standard === selectedOfflineStandard && exam.subject === selectedOfflineSubject
      ),
    [selectedOfflineStandard, selectedOfflineSubject]
  );
  const activeOfflineExam = filteredStudentOfflineExams[0] ?? null;
  const activeOfflineQuestionPaper = useMemo(
    () =>
      studentOfflineQuestionPapers.find((paper) => paper.examId === activeOfflineExam?.id) ?? null,
    [activeOfflineExam]
  );
 

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

  const standardOptions = useMemo(() => {
    const standardsMap = new Map<number, LmsCoursesSubjectRecord>();

    lmsCourses.forEach((row) => {
      if (!standardsMap.has(row.standard_id)) {
        standardsMap.set(row.standard_id, row);
      }
    });

    return Array.from(standardsMap.values()).sort((a, b) =>
      toDisplayText(a.standard_name).localeCompare(toDisplayText(b.standard_name), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );
  }, [lmsCourses]);

  const subjectOptions = useMemo(() => {
    if (selectedStandardId == null) return [];

    const subjectsMap = new Map<number, LmsCoursesSubjectRecord>();

    lmsCourses
      .filter((row) => row.standard_id === selectedStandardId)
      .forEach((row) => {
        if (!subjectsMap.has(row.subject_id)) {
          subjectsMap.set(row.subject_id, row);
        }
      });

    return Array.from(subjectsMap.values()).sort((a, b) =>
      toDisplayText(a.subject_name).localeCompare(toDisplayText(b.subject_name), undefined, {
        sensitivity: 'base',
      })
    );
  }, [lmsCourses, selectedStandardId]);

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

  const conceptOptions = useMemo(() => {
    const selectedChapterSet = new Set(selectedChapters);
    const concepts = new Set<string>();

    chapterOptions.forEach((chapter) => {
      if (!selectedChapterSet.has(chapter.id)) return;

      Object.keys(chapter.content_categories ?? {}).forEach((contentCategory) => {
        if (contentCategory.trim()) {
          concepts.add(contentCategory);
        }
      });
    });

    return Array.from(concepts).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [chapterOptions, selectedChapters]);

  const toggleChapter = (chapterId: number) => {
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
    setSelectedStandard('');
    setSelectedStandardId(null);
    setSelectedSubject('');
    setSelectedSubjectId(null);
    setSelectedChapters([]);
    setSelectedConcepts([]);
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

  const closePracticeAssessmentModal = () => {
    setActivePracticeConceptId(null);
    setPracticeAnswers({});
    setPracticeTimeLeft(0);
  };

  const openOnlineQuestionPaper = (examId: string) => {
    setActiveOnlineExamId(examId);
    setOnlinePaperAnswers({});
  };

  const closeOnlineQuestionPaper = () => {
    setActiveOnlineExamId(null);
    setOnlinePaperAnswers({});
    setIsSubmittingOnlinePaper(false);
  };

  const printOfflineQuestionPaper = () => {
    window.print();
  };

  const openPracticeAssessmentModal = (conceptId: string) => {
    const assessment = studentPracticeAssessments.find((item) => item.conceptId === conceptId);
    if (!assessment) return;

    setActivePracticeConceptId(conceptId);
    setPracticeAnswers({});
    setPracticeTimeLeft(assessment.durationMinutes * 60);
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
      type: examType,
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

    setPublishedExams((current) => [newExam, ...current]);
    closeCreateExamModal();
  };

  const submitPracticeAssessment = () => {
    if (!activePracticeAssessment || !activePracticeConcept || !activeStudentChapter) return;
    if (!hasAnsweredAllPracticeQuestions) return;

    const totalMarks = activePracticeAssessment.questions.reduce(
      (sum, question) => sum + question.marks,
      0
    );
    const earnedMarks = activePracticeAssessment.questions.reduce((sum, question) => {
      return sum + (practiceAnswers[question.id] === question.correctOptionId ? question.marks : 0);
    }, 0);
    const scorePercent = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const nextMastery = Math.max(activePracticeConcept.mastery, scorePercent);
    const didMasterConcept = nextMastery >= activePracticeAssessment.masteryTarget;

    setStudentChapterProgressList((current) =>
      current.map((chapter) => {
        if (chapter.chapterId !== activeStudentChapter.chapterId) return chapter;

        const updatedConcepts = chapter.concepts.map((concept, index, concepts) => {
          if (concept.id === activePracticeConcept.id) {
            const attemptsCount = concept.attemptsCount + 1;

            return {
              ...concept,
              mastery: nextMastery,
              attemptsCount,
              attemptsLabel: `${nextMastery}%`,
              status: didMasterConcept ? 'Mastered' : 'In progress',
              subtitle: didMasterConcept
                ? `Mastered · ${attemptsCount} ${attemptsCount === 1 ? 'attempt' : 'attempts'}`
                : formatPracticeAttemptSubtitle(attemptsCount, activePracticeAssessment.masteryTarget),
              canPractice: !didMasterConcept,
            };
          }

          const previousConcept = concepts[index - 1];
          if (
            didMasterConcept &&
            previousConcept?.id === activePracticeConcept.id &&
            concept.status === 'Locked'
          ) {
            return {
              ...concept,
              status: 'In progress',
              canLearn: true,
              canPractice: true,
              subtitle: formatPracticeAttemptSubtitle(concept.attemptsCount, activePracticeAssessment.masteryTarget),
            };
          }

          return concept;
        });

        const averageMasteryValue = Math.round(
          updatedConcepts.reduce((sum, concept) => sum + concept.mastery, 0) / updatedConcepts.length
        );
        const conceptsMasteredCount = updatedConcepts.filter(
          (concept) => concept.status === 'Mastered'
        ).length;
        const totalAttempts = updatedConcepts.reduce((sum, concept) => sum + concept.attemptsCount, 0);
        const chapterMasteryValue = Math.round(
          updatedConcepts.reduce((sum, concept) => sum + concept.mastery, 0) / updatedConcepts.length
        );

        return {
          ...chapter,
          concepts: updatedConcepts,
          chapterMastery: chapterMasteryValue,
          conceptsMastered: `${conceptsMasteredCount} of ${updatedConcepts.length}`,
          averageMastery: `${averageMasteryValue}%`,
          practiceAttempts: String(totalAttempts),
        };
      })
    );

    closePracticeAssessmentModal();
  };

  const submitOnlineQuestionPaper = async () => {
    if (!activeOnlineExam || !activeOnlineQuestionPaper || !hasAnsweredAllOnlineQuestions) return;

    try {
      setIsSubmittingOnlinePaper(true);

      await new Promise((resolve) => {
        window.setTimeout(resolve, 900);
      });

      setCompletedOnlineExamIds((current) =>
        current.includes(activeOnlineExam.id) ? current : [...current, activeOnlineExam.id]
      );
      closeOnlineQuestionPaper();
    } finally {
      setIsSubmittingOnlinePaper(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const menuContext = getStoredMenuContext();
    const subInstituteId = menuContext?.sub_institute_id || QUESTION_PAPER_DEFAULTS.subInstituteId;
    const userProfileName = menuContext?.user_profile_name || QUESTION_PAPER_DEFAULTS.userProfileName;
    const userId = menuContext?.user_id || QUESTION_PAPER_DEFAULTS.userId;

    const fetchExams = async () => {
      setIsLoadingExams(true);
      setExamLoadError('');

      try {
        const url = new URL(`${API_BASE_URL}/api/question-paper`);
        url.searchParams.set('sub_institute_id', String(subInstituteId));
        url.searchParams.set('syear', String(QUESTION_PAPER_DEFAULTS.syear));
        url.searchParams.set('user_profile_name', userProfileName);
        url.searchParams.set('user_id', String(userId));

        const response = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
        });
        const payload = (await response.json()) as QuestionPaperApiResponse;

        if (!response.ok || payload.status_code !== 1) {
          throw new Error(payload.message || 'Failed to load exams');
        }

        const mappedExams = Array.isArray(payload.data)
          ? payload.data.map(mapQuestionPaperToExam)
          : [];

        setApiExams(mappedExams);
      } catch (error) {
        if (controller.signal.aborted) return;
        setApiExams([]);
        setExamLoadError(error instanceof Error ? error.message : 'Failed to load exams');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingExams(false);
        }
      }
    };

    fetchExams();

    return () => {
      controller.abort();
    };
  }, []);

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
    const menuContext = getStoredMenuContext();
    const subInstituteId = menuContext?.sub_institute_id || QUESTION_PAPER_DEFAULTS.subInstituteId;
    const userProfileName = menuContext?.user_profile_name || QUESTION_PAPER_DEFAULTS.userProfileName;
    const userId = menuContext?.user_id || QUESTION_PAPER_DEFAULTS.userId;

    const fetchLmsCourses = async () => {
      setIsLoadingLmsCourses(true);
      setLmsCoursesError('');

      try {
        const formData = new FormData();
        formData.append('sub_institute_id', String(subInstituteId));
        formData.append('user_profile_name', userProfileName);
        formData.append('user_id', String(userId));

        const response = await fetch(`${API_BASE_URL}/api/lms-courses`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
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
    if (typeof window === 'undefined') return;
    localStorage.setItem('learningManagementAudienceMode', audienceMode);
  }, [audienceMode]);

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

  const studentExamStatusBadgeClasses: Record<StudentExamStatus, string> = {
    Available: 'bg-violet-50 text-violet-700',
    Upcoming: 'bg-amber-50 text-amber-700',
    Completed: 'bg-emerald-50 text-emerald-700',
    Closed: 'bg-slate-100 text-slate-500',
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

            {audienceMode === 'Teacher' ? (
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
                    className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-[12px] bg-[#5846EA] px-4 text-[14px] font-semibold text-white"
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
                  {studentViewTabs.map((tab) => {
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
                                className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.6fr)_170px_120px_auto] lg:items-center"
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

                                <div>
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

                                <div>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${studentStatusBadgeClasses[concept.status]}`}
                                  >
                                    {concept.status}
                                  </span>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                                  <button
                                    type="button"
                                    disabled={!concept.canLearn}
                                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                                      concept.canLearn
                                        ? 'border-[#D6DEEA] bg-white text-[#334155] hover:border-[#B7C5D8]'
                                        : 'cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#A0AEC0]'
                                    }`}
                                  >
                                    <BookOpen size={14} />
                                    Learn content
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!concept.canPractice}
                                    onClick={() => openPracticeAssessmentModal(concept.id)}
                                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                                      concept.canPractice
                                        ? 'border-[#CBD5E1] bg-white text-[#172554] hover:border-[#94A3B8]'
                                        : 'cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#A0AEC0]'
                                    }`}
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
                ) : studentLearningTab === 'Online Exam' ? (
                  activeOnlineExam && activeOnlineQuestionPaper ? (
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 border-b border-[#D9E3F0] pb-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-[26px] font-semibold tracking-[-0.03em] text-[#172554]">
                              {activeOnlineExam.name}
                            </h2>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[12px] font-semibold text-[#5846EA]">
                              <FileText size={12} />
                              {activeOnlineQuestionPaper.badgeLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-[14px] text-[#5F7087]">
                            {activeOnlineExam.subject} - {activeOnlineExam.classLabel} - Chapter: {activeOnlineExam.chapter}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 justify-start rounded-[12px] px-0 text-[#475569] hover:bg-transparent hover:text-[#172554]"
                          onClick={closeOnlineQuestionPaper}
                        >
                          <ArrowLeft size={16} />
                          Back
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        {[
                          { label: 'Total Marks', value: String(activeOnlineExam.marks), icon: Award },
                          { label: 'Total Questions', value: String(activeOnlineExam.questions), icon: FileText },
                          { label: 'Duration', value: `${activeOnlineExam.durationMinutes} min`, icon: Hourglass },
                        ].map((item) => {
                          const SummaryIcon = item.icon;

                          return (
                            <Card
                              key={item.label}
                              className="rounded-[18px] border border-[#D9E3F0] bg-white py-0 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                            >
                              <CardContent className="px-4 py-4">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7B91]">
                                  <SummaryIcon size={14} />
                                  {item.label}
                                </div>
                                <p className="mt-2 text-[28px] font-semibold leading-none text-[#172554]">{item.value}</p>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      <Card className="rounded-[18px] border border-[#D9E3F0] bg-white py-0 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <CardContent className="px-4 py-5 sm:px-6">
                          <div className="space-y-8">
                            {activeOnlineQuestionPaper.questions.map((question, index) => (
                              <div key={question.id}>
                                <div className="flex items-start justify-between gap-4">
                                  <p className="text-[15px] font-semibold leading-7 text-[#172554]">
                                    {index + 1}. {question.question}
                                  </p>
                                  <span className="shrink-0 text-[13px] font-medium text-[#7C6CF4]">
                                    ({question.marks} marks)
                                  </span>
                                </div>

                                <RadioGroup
                                  value={onlinePaperAnswers[question.id] ?? ''}
                                  onValueChange={(value) =>
                                    setOnlinePaperAnswers((current) => ({
                                      ...current,
                                      [question.id]: value,
                                    }))
                                  }
                                  className="mt-4 gap-3"
                                >
                                  {question.options.map((option) => (
                                    <label key={option.id} className="flex items-center gap-3 text-[14px] text-[#24324A]">
                                      <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                                      <span>{option.label}</span>
                                    </label>
                                  ))}
                                </RadioGroup>
                              </div>
                            ))}
                          </div>

                          <div className="mt-8 flex flex-col gap-3 border-t border-[#E5EAF2] pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[14px] text-[#5F7087]">
                              {onlineAnsweredCount} of {activeOnlineQuestionPaper.questions.length} answered
                            </p>

                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-10 rounded-[12px] px-4 text-[#334155]"
                                onClick={closeOnlineQuestionPaper}
                                disabled={isSubmittingOnlinePaper}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                className="h-10 rounded-[12px] bg-[#C8C2FB] px-4 text-white hover:bg-[#B7AFF7] disabled:bg-[#C8C2FB]"
                                disabled={!hasAnsweredAllOnlineQuestions || isSubmittingOnlinePaper}
                                onClick={submitOnlineQuestionPaper}
                              >
                                {isSubmittingOnlinePaper ? 'Submitting...' : 'Submit paper'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="block w-full max-w-[180px]">
                          <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                            Standard
                          </span>
                          <div className="relative">
                            <select
                              value={selectedOnlineStandard}
                              onChange={(event) => {
                                const nextStandard = event.target.value;
                                const nextSubjects = Array.from(
                                  new Set(
                                    studentOnlineExams
                                      .filter((exam) => exam.standard === nextStandard)
                                      .map((exam) => exam.subject)
                                  )
                                );

                                setSelectedOnlineStandard(nextStandard);
                                setSelectedOnlineSubject(nextSubjects[0] ?? '');
                              }}
                              className="h-11 w-full appearance-none rounded-[10px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                            >
                              {onlineStandardOptions.map((standard) => (
                                <option key={standard} value={standard}>
                                  {standard}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          </div>
                        </label>

                        <label className="block w-full max-w-[180px]">
                          <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                            Subject
                          </span>
                          <div className="relative">
                            <select
                              value={selectedOnlineSubject}
                              onChange={(event) => setSelectedOnlineSubject(event.target.value)}
                              className="h-11 w-full appearance-none rounded-[10px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                            >
                              {onlineSubjectOptions.map((subject) => (
                                <option key={subject} value={subject}>
                                  {subject}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          </div>
                        </label>
                      </div>

                      <div className="space-y-4">
                        {filteredStudentOnlineExams.map((exam) => {
                          const isCompleted = completedOnlineExamIds.includes(exam.id);
                          const displayStatus: StudentExamStatus = isCompleted ? 'Completed' : exam.status;
                          const displayAttemptStatus = isCompleted ? 'Completed' : exam.attempts;

                          return (
                            <Card
                              key={exam.id}
                              className="rounded-[18px] border border-[#D9E3F0] bg-white py-0 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                            >
                              <CardContent className="flex flex-col gap-4 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex min-w-0 items-start gap-4">
                                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-[#F4F7FB] text-[#5846EA]">
                                    <FileText size={22} />
                                  </span>

                                  <div className="min-w-0">
                                    <h3 className="text-[18px] font-semibold text-[#172554]">{exam.name}</h3>
                                    <p className="mt-1 text-[14px] text-[#5F7087]">
                                      {exam.subject} - {exam.classLabel} - Chapter: {exam.chapter}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[13px] text-[#475569]">
                                        {exam.questions} questions
                                      </span>
                                      <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[13px] text-[#475569]">
                                        {exam.marks} marks
                                      </span>
                                      <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[13px] text-[#475569]">
                                        {exam.durationMinutes} min
                                      </span>
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-[13px] ${studentExamStatusBadgeClasses[displayStatus]}`}
                                      >
                                        {displayAttemptStatus}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  className="h-11 rounded-[14px] bg-[#5846EA] px-5 text-[14px] font-semibold text-white hover:bg-[#4C3DD3]"
                                  onClick={() => openOnlineQuestionPaper(exam.id)}
                                >
                                  <FileText size={16} />
                                  Open question paper
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="no-print flex items-start gap-2 rounded-[14px] border border-[#D8E5FF] bg-[#F5F8FF] px-4 py-3 text-[13px] text-[#4C63A8]">
                      <Info size={16} className="mt-0.5 shrink-0" />
                      <p>
                        This is a printable question paper for the offline exam. Review all questions, then print or save it as PDF to write your answers on paper.
                      </p>
                    </div>

                    <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="block w-full max-w-[180px]">
                          <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                            Standard
                          </span>
                          <div className="relative">
                            <select
                              value={selectedOfflineStandard}
                              onChange={(event) => {
                                const nextStandard = event.target.value;
                                const nextSubjects = Array.from(
                                  new Set(
                                    studentOfflineExams
                                      .filter((exam) => exam.standard === nextStandard)
                                      .map((exam) => exam.subject)
                                  )
                                );

                                setSelectedOfflineStandard(nextStandard);
                                setSelectedOfflineSubject(nextSubjects[0] ?? '');
                              }}
                              className="h-11 w-full appearance-none rounded-[10px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                            >
                              {offlineStandardOptions.map((standard) => (
                                <option key={standard} value={standard}>
                                  {standard}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          </div>
                        </label>

                        <label className="block w-full max-w-[180px]">
                          <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                            Subject
                          </span>
                          <div className="relative">
                            <select
                              value={selectedOfflineSubject}
                              onChange={(event) => setSelectedOfflineSubject(event.target.value)}
                              className="h-11 w-full appearance-none rounded-[10px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                            >
                              {offlineSubjectOptions.map((subject) => (
                                <option key={subject} value={subject}>
                                  {subject}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          </div>
                        </label>
                      </div>

                      {activeOfflineExam ? (
                        <Button
                          type="button"
                          className="h-11 rounded-[14px] bg-[#5846EA] px-5 text-[14px] font-semibold text-white hover:bg-[#4C3DD3]"
                          onClick={printOfflineQuestionPaper}
                        >
                          <Printer size={16} />
                          Print question paper
                        </Button>
                      ) : null}
                    </div>

                    {activeOfflineExam ? (
                      <>
                        <p className="no-print text-[14px] text-[#5F7087]">
                          {activeOfflineExam.subject} - {activeOfflineExam.classLabel} - Chapter: {activeOfflineExam.chapter}
                        </p>

                        <Card className="offline-question-paper mx-auto w-full max-w-[860px] rounded-[18px] border border-[#D9E3F0] bg-white py-0 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                          <CardContent className="px-5 py-6 sm:px-8 sm:py-7">
                            <div className="text-center">
                              <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#172554]">
                                {activeOfflineExam.name}
                              </h2>
                              <p className="mt-2 text-[14px] text-[#5F7087]">
                                {activeOfflineExam.subject} - {activeOfflineExam.classLabel} - Chapter: {activeOfflineExam.chapter}
                              </p>
                              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-[#475569]">
                                <span>Total questions: {activeOfflineExam.questions}</span>
                                <span>Total marks: {activeOfflineExam.marks}</span>
                                <span>Duration: {activeOfflineExam.durationMinutes} min</span>
                              </div>
                            </div>

                            <div className="my-6 h-px bg-[#D9E3F0]" />

                            <div className="rounded-[12px] border border-[#D9E3F0] bg-[#FAFBFD] px-4 py-3 text-[13px] text-[#475569]">
                              <p className="font-semibold text-[#172554]">Instructions</p>
                              <ol className="mt-2 space-y-1">
                                {(activeOfflineQuestionPaper?.instructions || activeOfflineExam.instructions || []).map(
                                  (instruction, index) => (
                                    <li key={instruction}>{index + 1}. {instruction}</li>
                                  )
                                )}
                              </ol>
                            </div>

                            <div className="mt-6 space-y-6">
                              {activeOfflineQuestionPaper?.questions.map((question, index) => (
                                <div key={question.id} className="offline-question">
                                  <div className="flex items-start justify-between gap-4">
                                    <p className="text-[15px] font-semibold leading-7 text-[#172554]">
                                      {index + 1}. {question.question}
                                    </p>
                                    <span className="shrink-0 text-[13px] text-[#7C6CF4]">
                                      ({question.marks} marks)
                                    </span>
                                  </div>

                                  <div className="mt-3 space-y-2 pl-3 text-[14px] text-[#24324A]">
                                    {question.options.map((option, optionIndex) => (
                                      <p key={option.id}>
                                        {String.fromCharCode(65 + optionIndex)}. {option.label}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <Card className="rounded-[18px] border border-dashed border-[#D9E3F0] bg-white py-0 shadow-none">
                        <CardContent className="px-5 py-8 text-center text-[14px] text-[#64748B]">
                          No offline question paper is available for the selected standard and subject.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          </section>
        </div>
     

      {activePracticeAssessment && activePracticeConcept ? (
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

            <div className="shrink-0 border-t border-[#E4EAF2] bg-white px-5 py-4 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] font-medium text-[#5F7087]">
                  {practiceAnsweredCount} of {activePracticeAssessment.questions.length} answered
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
                    disabled={!hasAnsweredAllPracticeQuestions}
                    onClick={submitPracticeAssessment}
                  >
                    Submit Answers
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                          value={selectedStandardId == null ? '' : String(selectedStandardId)}
                          onChange={(event) => {
                            const nextStandardId = Number(event.target.value);
                            const nextStandard = standardOptions.find(
                              (option) => option.standard_id === nextStandardId
                            );

                            if (!nextStandard) {
                              setSelectedStandard('');
                              setSelectedStandardId(null);
                              setSelectedSubject('');
                              setSelectedSubjectId(null);
                              setSelectedChapters([]);
                              setSelectedConcepts([]);
                              return;
                            }

                            setSelectedStandard(toDisplayText(nextStandard.standard_name));
                            setSelectedStandardId(nextStandard.standard_id);
                            setSelectedSubject('');
                            setSelectedSubjectId(null);
                            setSelectedChapters([]);
                            setSelectedConcepts([]);
                          }}
                          disabled={isLoadingLmsCourses}
                          className="h-12 w-full appearance-none rounded-[12px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                        >
                          <option value="">
                            {isLoadingLmsCourses ? 'Loading standards...' : 'Select standard'}
                          </option>
                          {standardOptions.map((option) => (
                            <option key={option.standard_id} value={option.standard_id}>
                              {toDisplayText(option.standard_name)}
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
                          value={selectedSubjectId == null ? '' : String(selectedSubjectId)}
                          onChange={(event) => {
                            const nextSubjectId = Number(event.target.value);
                            const nextSubject = subjectOptions.find(
                              (option) => option.subject_id === nextSubjectId
                            );

                            if (!nextSubject) {
                              setSelectedSubject('');
                              setSelectedSubjectId(null);
                              setSelectedChapters([]);
                              setSelectedConcepts([]);
                              return;
                            }

                            setSelectedSubject(toDisplayText(nextSubject.subject_name));
                            setSelectedSubjectId(nextSubject.subject_id);
                            setSelectedChapters([]);
                            setSelectedConcepts([]);
                          }}
                          disabled={isLoadingLmsCourses || selectedStandardId == null}
                          className="h-12 w-full appearance-none rounded-[12px] border border-[#C9D4E5] bg-white px-4 pr-10 text-[15px] font-medium text-[#0F172A] outline-none focus:border-[#5B4FE9]"
                        >
                          <option value="">
                            {selectedStandardId == null ? 'Select standard first' : 'Select subject'}
                          </option>
                          {subjectOptions.map((option) => (
                            <option key={option.subject_id} value={option.subject_id}>
                              {toDisplayText(option.subject_name)}
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
                    {lmsCoursesError ? (
                      <p className="mt-3 text-[13px] text-[#B45309]">{lmsCoursesError}</p>
                    ) : null}
                    <div className="mt-3 space-y-3">
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
                                {toDisplayText(chapter.chapter_name) || 'Untitled chapter'}
                              </span>
                              <span className="mt-1 block text-[13px] text-[#64748B]">
                                {toNumber(chapter.total_content)} contents
                              </span>
                            </span>
                          </label>
                        );
                      }))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                      Concepts
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {conceptOptions.length === 0 ? (
                        <p className="text-[14px] text-[#64748B]">
                          Select chapter checkboxes to view related categories.
                        </p>
                      ) : (
                        conceptOptions.map((concept) => {
                        const isSelected = selectedConcepts.includes(concept);

                        return (
                          <button
                            key={concept}
                            type="button"
                            onClick={() => toggleConcept(concept)}
                            className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition ${
                              isSelected
                                ? 'bg-[#5B4FE9] text-white shadow-[0_8px_16px_rgba(91,79,233,0.18)]'
                                : 'bg-[#EEF2F7] text-[#51657F]'
                            }`}
                          >
                            {concept}
                          </button>
                        );
                      }))}
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

      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }

          body * {
            visibility: hidden;
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

          .offline-question {
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
