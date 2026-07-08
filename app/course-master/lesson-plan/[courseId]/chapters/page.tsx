'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BookOpen, Calendar, Clock, Users, Target, ClipboardList, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function generateChapters(course: Course) {
  const base = course.title.split(' ').slice(0, 3).join(' ');
  return Array.from({ length: course.chapters }, (_, i) => ({
    id: i + 1,
    name: i === 0 ? `${base} Fundamentals` : `${base} Part ${i + 1}`,
    topics: 5,
    duration: `${Math.floor(Math.random() * 3) + 1} weeks`,
    status: i < 3 ? 'Completed' : i < course.chapters ? 'In Progress' : 'Not Started',
  }));
}

interface ChapterCardProps {
  chapter: {
    id: number;
    name: string;
    topics: number;
    duration: string;
    status: string;
  };
  accentColor: string;
}

function ChapterCard({ chapter, accentColor }: ChapterCardProps) {
  const statusConfig = {
    Completed: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-700',
      dot: 'bg-emerald-500',
    },
    'In Progress': {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-700',
      dot: 'bg-blue-500',
    },
    'Not Started': {
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      border: 'border-slate-200',
      badge: 'bg-slate-100 text-slate-600',
      dot: 'bg-slate-400',
    },
  };

  const config = statusConfig[chapter.status as keyof typeof statusConfig];

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white',
        'shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/60',
        'hover:border-slate-300 overflow-hidden'
      )}
    >
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                config.bg,
                config.text,
                config.border
              )}
            >
              <span className="text-sm font-bold">{chapter.id}</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 leading-tight group-hover:text-blue-700 transition-colors">
                {chapter.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {chapter.topics} topics · {chapter.duration}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn('inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold', config.badge)}>
              <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', config.dot)} />
              {chapter.status}
            </span>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-4 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold flex-1"
          >
            <ClipboardList size={14} className="mr-1.5" />
            View Details
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-lg text-xs font-semibold text-white flex-1"
            style={{ backgroundColor: accentColor }}
          >
            Start Learning
            <ChevronRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ChaptersPage() {
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
  const chapters = generateChapters(course);

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        
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
                <p className="text-slate-600 mt-1">Chapter List</p>
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
            </div>
          </div>
        </div>

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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:w-auto w-full">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                  <BookOpen size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{course.chapters}</div>
                  <div className="text-xs text-slate-500">Total Chapters</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                  <Users size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{course.enrollments}</div>
                  <div className="text-xs text-slate-500">Enrollments</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                  <Clock size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{Math.floor(course.chapters * 1.5)} weeks</div>
                  <div className="text-xs text-slate-500">Duration</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                  <Target size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{course.progress}%</div>
                  <div className="text-xs text-slate-500">Completion</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ClipboardList size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Chapter List</h2>
              <p className="text-sm text-slate-500">Detailed breakdown of chapters and units</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {chapters.map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                accentColor={course.accentColor}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
