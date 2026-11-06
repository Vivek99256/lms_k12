'use client';

import React from 'react';
import {
  BarChart3,
  BookOpen,
  FileQuestion,
  GraduationCap,
  Layers,
  LineChart,
  Target,
} from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { TeachLearnDeliveryDashboard } from '../_components/TeachLearnDeliveryDashboard';
import AttainmentReportPage from '@/app/pal/reports/attainment/page';
import ExamProgressReportPage from '@/app/exam/progress-report/page';
import QuestionWiseReportPage from '@/app/lms/question-wise-report/page';
import StudentAnalysisPage from '@/app/lms/student-analysis/page';

/**
 * Teach/Learn -> Reports static screens suite.
 * Provides high-level instructional delivery metrics, curriculum attainment,
 * examination marks progression, question item analysis, and student learning curves.
 */
export const TEACH_LEARN_REPORT_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'instructional-delivery',
    label: 'Instructional Delivery & Syllabus',
    icon: GraduationCap,
    render: () => <TeachLearnDeliveryDashboard />,
  },
  {
    id: 'curriculum-attainment',
    label: 'Curriculum & Attainment',
    icon: Target,
    render: () => (
      <div className="p-4" style={{ ['--primary' as string]: '#5846EA', ['--primary-foreground' as string]: '#ffffff' }}>
        <AttainmentReportPage />
      </div>
    ),
  },
  {
    id: 'exam-progress',
    label: 'Exam Progress & Marks',
    icon: BarChart3,
    render: () => (
      <div className="p-4" style={{ ['--primary' as string]: '#5846EA', ['--primary-foreground' as string]: '#ffffff' }}>
        <ExamProgressReportPage />
      </div>
    ),
  },
  {
    id: 'question-wise',
    label: 'Question-Wise Analysis',
    icon: FileQuestion,
    render: () => <QuestionWiseReportPage />,
  },
  {
    id: 'student-analysis',
    label: 'Student Academic Analysis',
    icon: LineChart,
    render: () => <StudentAnalysisPage />,
  },
];

