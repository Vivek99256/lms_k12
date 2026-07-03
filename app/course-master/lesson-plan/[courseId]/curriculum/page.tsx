'use client';

import React, { useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BookOpen, Calendar, Clock, Users, Award, Target, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { courses } from '../../../data/courses';
import type { Course } from '../../../data/courses';

const ICON_MAP: Record<string, React.ElementType> = {
  'book-open': BookOpen,
  'flask-conical': BookOpen,
  'calculator': BookOpen,
  'globe': BookOpen,
  'pen-tool': BookOpen,
  'music': BookOpen,
  'dumbbell': BookOpen,
  'briefcase': BookOpen,
  'palette': BookOpen,
  'library': BookOpen,
  'cpu': BookOpen,
  'compass': BookOpen,
};

function getStatusColor(status: Course['status']) {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Draft':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Archived':
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getSectionLabel(classGrade: string): string {
  const grade = parseInt(classGrade.replace('Class ', '').trim(), 10);
  if (grade >= 1 && grade <= 5) return 'Primary Section';
  if (grade >= 6 && grade <= 10) return 'Secondary Section';
  if (grade >= 11 && grade <= 12) return 'Higher Section';
  return 'KG';
}

function generateCurriculumUnits(course: Course) {
  const base = course.title.split(' ').slice(0, 3).join(' ');
  return Array.from({ length: course.chapters }, (_, i) => ({
    id: i + 1,
    name: i === 0 ? `${base} Fundamentals` : `${base} Part ${i + 1}`,
    topics: 5,
    duration: `${Math.floor(Math.random() * 3) + 1} weeks`,
    status: i < 3 ? 'Completed' : i < course.chapters ? 'In Progress' : 'Not Started',
  }));
}

interface LearningOutcome {
  code: string;
  type: 'Goal' | 'competency';
  description: string;
  parentCode?: string;
}

const learningOutcomes: LearningOutcome[] = [
  {
    code: 'CG 1',
    type: 'Goal',
    description: 'Explores the world of matter, its interactions, and properties at the atomic level',
  },
  {
    code: 'C 1.1',
    type: 'competency',
    description: 'Describes classification of elements in the Periodic Table, and explains how compounds are formed based on atomic structure and properties.',
    parentCode: 'CG 1',
  },
  {
    code: 'C 1.2',
    type: 'competency',
    description: 'Investigates the nature and properties of chemical substances.',
    parentCode: 'CG 1',
  },
  {
    code: 'C 1.3',
    type: 'competency',
    description: 'Describes and represents chemical interactions and changes using symbols and chemical equations.',
    parentCode: 'CG 1',
  },
  {
    code: 'CG 2',
    type: 'Goal',
    description: 'Explores the physical world around them and understands scientific principles and laws.',
  },
  {
    code: 'C 2.1',
    type: 'competency',
    description: "Applies Newton's laws to explain the effect of forces and analyses motion representations.",
    parentCode: 'CG 2',
  },
];

interface CurriculumPageProps {
}

export default function CurriculumPage({}: CurriculumPageProps) {
  const router = useRouter();
  const { courseId } = useParams();
  const course = courses.find((c) => c.id === courseId);

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Course not found</h2>
          <p className="text-slate-500">The requested course could not be found.</p>
        </div>
      </div>
    );
  }

  const IconComponent = ICON_MAP[course.icon] || BookOpen;
  const units = generateCurriculumUnits(course);

  const stats = [
    { label: 'Total Units', value: course.chapters, icon: BookOpen },
    { label: 'Enrollments', value: course.enrollments, icon: Users },
    { label: 'Duration', value: `${Math.floor(course.chapters * 1.5)} weeks`, icon: Clock },
    { label: 'Completion', value: `${course.progress}%`, icon: Target },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${course.accentColor}15`, color: course.accentColor }}
              >
                <IconComponent size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{course.title}</h1>
                <p className="text-slate-600 mt-1">Curriculum Overview</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              >
                Back to Courses
              </Button>
              <Button
                className="h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25"
              >
                Export Curriculum
              </Button>
            </div>
          </div>
        </div>

        {/* Course Overview Card */}
        <div className="mb-8 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-500">Course Code:</span>
                <span className="font-mono text-sm font-semibold text-slate-800 bg-slate-50 px-3 py-1 rounded-lg">
                  {course.code}
                </span>
                <Badge className={cn('text-xs font-semibold', getStatusColor(course.status))}>
                  {course.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  <span className="text-slate-600">Instructor:</span>
                  <span className="font-medium text-slate-800">{course.instructor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400" />
                  <span className="text-slate-600">Class:</span>
                  <span className="font-medium text-slate-800">{course.classGrade}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Category:</span>
                  <span className="font-medium text-slate-800">{course.category}</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-4 lg:w-auto w-full">
              {stats.map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                      <StatIcon size={18} />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-900">{stat.value}</div>
                      <div className="text-xs text-slate-500">{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Curriculum Overview Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ClipboardList size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Curriculum Overview</h2>
              <p className="text-sm text-slate-500">Detailed breakdown of units and chapters</p>
            </div>
          </div>

       
        </div>

        {/* Units Breakdown Table */}
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/30 px-6 py-4">
            <h3 className="text-lg font-bold text-slate-800">Units Breakdown</h3>
            <p className="text-sm text-slate-500">Manage and track curriculum progress</p>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-600">Unit </TableHead>
                  <TableHead className="font-semibold text-slate-600">Unit Name</TableHead>
                  <TableHead className="font-semibold text-slate-600">Topics</TableHead>
                  <TableHead className="font-semibold text-slate-600">Duration</TableHead>
                  <TableHead className="font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => {
                  const statusColors = {
                    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
                    'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
                  };
                  
                  return (
                    <TableRow key={unit.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-medium text-slate-900"># {unit.id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{unit.name}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600">{unit.topics} topics</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600">{unit.duration}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs font-semibold', statusColors[unit.status as keyof typeof statusColors])}>
                          {unit.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* LMS Learning Outcomes Breakup */}
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Target size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">LMS Learning Outcomes Breakup</h3>
                <p className="text-sm text-slate-500">Goals and competencies for this course</p>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {learningOutcomes.map((outcome) => {
              const isGoal = outcome.type === 'Goal';
              const isCompetency = outcome.type === 'competency';
              
              return (
                <div
                  key={outcome.code}
                  className={cn(
                    'transition-colors',
                    isGoal && 'bg-indigo-50/40',
                    !isGoal && 'pl-12 md:pl-16'
                  )}
                >
                  <div className="px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                      <div className="flex items-center gap-2 sm:w-24 sm:flex-shrink-0">
                        <span className="font-mono text-sm font-semibold text-slate-800">
                          {outcome.code}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                              isGoal &&
                                'bg-indigo-100 text-indigo-700 border border-indigo-200',
                              isCompetency &&
                                'bg-blue-50 text-blue-700 border border-blue-100'
                            )}
                          >
                            {outcome.type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {outcome.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}