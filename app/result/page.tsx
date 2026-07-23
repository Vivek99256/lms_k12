'use client';

/**
 * Result module hub — categorised launcher for all 31 screens
 * (Entry · Masters · Reports), searchable, keyboard friendly.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, Award, BarChart3, BookOpenCheck, CalendarCheck2, CalendarRange, CheckSquare,
  ClipboardCheck, ClipboardList, FileBadge, FileCode2, FileSpreadsheet, FileText, GraduationCap,
  Grid3x3, Layers3, ListChecks, MessageSquareText, Printer, Scale, School, Search, Sheet,
  Smartphone, Table2, TrendingUp, Upload, Users, type LucideIcon,
} from 'lucide-react';
import PageHeader from '@/components/result/PageHeader';
import { EmptyState } from '@/components/result/primitives';
import { Input } from '@/components/ui/input';

type Screen = { title: string; description: string; href: string; icon: LucideIcon };
type Category = { id: string; label: string; blurb: string; screens: Screen[] };

const CATEGORIES: Category[] = [
  {
    id: 'entry',
    label: 'Entry',
    blurb: 'Day-to-day marks and result data entry',
    screens: [
      { title: 'Mark entry', description: 'Enter, save and approve subject marks per exam', href: '/result/marks-entry', icon: ClipboardList },
      { title: 'Co-scholastic marks', description: 'Grade or mark based co-scholastic entry with approval', href: '/result/co-scholastic-marks', icon: Award },
      { title: 'Result templates', description: 'HTML report-card templates with placeholder tags', href: '/result/templates', icon: FileCode2 },
      { title: 'HPC activity entry', description: 'Assign activity groups per student and skillset', href: '/result/hpc-activity-entry', icon: Activity },
      { title: 'HPC entry v1', description: 'Hierarchical activity × student marks matrix', href: '/result/hpc-entry-v1', icon: Grid3x3 },
      { title: 'Approve mobile result', description: 'Publish student results to the mobile app', href: '/result/approve-mobile-result', icon: Smartphone },
      { title: 'Upload result', description: 'Attach result files per student and term', href: '/result/upload-result', icon: Upload },
    ],
  },
  {
    id: 'master',
    label: 'Masters',
    blurb: 'Configuration that drives exams, grading and report cards',
    screens: [
      { title: 'Exam master', description: 'Exam types, standards, terms, weightage and codes', href: '/result/master/exam-master', icon: BookOpenCheck },
      { title: 'Exam creation', description: 'Create exams with marks, dates and app visibility', href: '/result/master/exam-creation', icon: ClipboardCheck },
      { title: 'Grade master', description: 'Grading scales with break-offs, GP values and comments', href: '/result/master/grade-master', icon: Scale },
      { title: 'Standard grade mapping', description: 'Map grade scales to sections and standards', href: '/result/master/standard-grade-mapping', icon: ListChecks },
      { title: 'Result master', description: 'Result dates, vacation window, display rules, signatures', href: '/result/master/result-master', icon: CalendarRange },
      { title: 'Result book master', description: 'Report card letterhead lines and trust logos', href: '/result/master/result-book-master', icon: FileBadge },
      { title: 'Student result remark', description: 'Reusable remark titles for report cards', href: '/result/master/student-result-remark', icon: MessageSquareText },
      { title: 'Co-scholastic master', description: 'Top-level co-scholastic areas', href: '/result/master/co-scholastic-master', icon: Award },
      { title: 'Co-scholastic setup', description: 'Co-scholastic items per standard — mark or grade based', href: '/result/master/co-scholastic-setup', icon: Award },
      { title: 'Working day master', description: 'Total working days per term and standard', href: '/result/master/working-day-master', icon: CalendarCheck2 },
      { title: 'Student attendance master', description: 'Present days, working days and remarks per student', href: '/result/student-attendance', icon: Users },
      { title: 'HPC activity', description: 'Holistic progress card activities and sub-activities', href: '/result/master/hpc-activity', icon: Activity },
      { title: 'HPC skillset', description: 'Skill groups behind HPC activities', href: '/result/master/hpc-skillset', icon: Layers3 },
    ],
  },
  {
    id: 'report',
    label: 'Reports',
    blurb: 'Analysis, approvals and printable report cards',
    screens: [
      { title: 'Result report', description: 'Merit, progress, classwise, overall, marks and more', href: '/result/reports', icon: BarChart3 },
      { title: 'Marks approval report', description: 'Scholastic and co-scholastic approval status matrix', href: '/result/reports/marks-approval', icon: CheckSquare },
      { title: 'Classwise grade report', description: 'Subject-wise grades with rank, attendance and conduct', href: '/result/reports/classwise-grade', icon: Table2 },
      { title: 'Consolidate report', description: 'Term → exam → subject consolidated marks with Excel export', href: '/result/reports/consolidate', icon: FileSpreadsheet },
      { title: 'WRT report', description: 'Weekly recap test report cards per student', href: '/result/reports/wrt', icon: FileText },
      { title: 'WRT progress report', description: 'WRT trends with totals, grades, rank and ribbons', href: '/result/reports/wrt-progress', icon: TrendingUp },
      { title: 'New report card', description: 'Generate template-based report cards for students', href: '/result/report-card', icon: Printer },
      { title: 'Student result remarks', description: 'Assign promotion remarks per student and term', href: '/result/student-result-remarks', icon: MessageSquareText },
      { title: 'CBSE report card (1–5)', description: 'Two-term CBSE format for classes 1 to 5', href: '/result/report-card/cbse-1t5', icon: School },
      { title: 'CBSE report card (Term 2)', description: 'Term 2 / academic year CBSE format', href: '/result/report-card/cbse-t2', icon: School },
      { title: 'CBSE class 11 report card', description: 'Unit tests, half yearly and yearly exam format', href: '/result/report-card/cbse-11', icon: GraduationCap },
      { title: 'CNSE class 11 report card', description: 'CNSE variant of the class 11 report card', href: '/result/report-card/cnse-11', icon: Sheet },
    ],
  },
];

export default function ResultModulePage() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CATEGORIES;
    return CATEGORIES.map((category) => ({
      ...category,
      screens: category.screens.filter(
        (screen) =>
          screen.title.toLowerCase().includes(needle) || screen.description.toLowerCase().includes(needle),
      ),
    })).filter((category) => category.screens.length > 0);
  }, [query]);

  const total = CATEGORIES.reduce((sum, category) => sum + category.screens.length, 0);

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-8">
        <PageHeader
          icon={GraduationCap}
          title="Result"
          subtitle={`Exams, marks entry, grading and report cards — ${total} screens`}
          breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Result' }]}
          actions={
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search screens…"
                aria-label="Search result screens"
                className="h-10 pl-9"
              />
            </div>
          }
        />

        {filtered.length === 0 && (
          <EmptyState title="No screens match your search" message="Try a different keyword, e.g. “marks”, “report card” or “exam”." />
        )}

        {filtered.map((category) => (
          <section key={category.id} aria-labelledby={`section-${category.id}`} className="space-y-4">
            <div>
              <h2 id={`section-${category.id}`} className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {category.label}
              </h2>
              <p className="text-sm text-slate-500">{category.blurb}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {category.screens.map((screen) => (
                <Link
                  key={screen.href}
                  href={screen.href}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <screen.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{screen.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{screen.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
