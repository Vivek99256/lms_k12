'use client';

import React from 'react';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileQuestion,
  LineChart,
} from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import ReportsPage from '@/app/lms/reports/page';
import QuestionWiseReportPage from '@/app/lms/question-wise-report/page';
import StudentHomeworkReportPage from '@/app/lms/homework/report/page';
import StudentAnalysisPage from '@/app/lms/student-analysis/page';
import { LmsDashboard } from '@/components/domain/lms/dashboard/lms-dashboard';

/**
 * LMS -> Reports static screens suite.
 * Provides comprehensive reporting across:
 * 1. Lesson Planning & Delivery completion analytics
 * 2. Course & Learner Analytics Dashboard
 * 3. Question-Wise Exam Performance & item analysis
 * 4. Homework & Assignment submission tracking
 * 5. Student Academic Analysis & progression reports
 */
export const LMS_REPORT_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'lesson-planning',
    label: 'Lesson Planning & Delivery',
    icon: BookOpen,
    render: () => <ReportsPage />,
  },
  {
    id: 'course-analytics',
    label: 'Course & Learner Analytics',
    icon: BarChart3,
    render: () => (
      <div className="p-4" style={{ ['--primary' as string]: '#5846EA', ['--primary-foreground' as string]: '#ffffff' }}>
        <LmsDashboard />
      </div>
    ),
  },
  {
    id: 'question-wise',
    label: 'Question-Wise Exam Report',
    icon: FileQuestion,
    render: () => <QuestionWiseReportPage />,
  },
  {
    id: 'homework-report',
    label: 'Homework & Assignment Report',
    icon: ClipboardList,
    render: () => <StudentHomeworkReportPage />,
  },
  {
    id: 'student-analysis',
    label: 'Student Academic Analysis',
    icon: LineChart,
    render: () => <StudentAnalysisPage />,
  },
];

