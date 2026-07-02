'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
   LayoutGrid,
  List,
  Search,
  BookOpen,
  FlaskConical,
  Calculator,
  Globe,
  PenTool,
  Music,
  Dumbbell,
  Briefcase,
  Palette,
  Library,
  Cpu,
  Compass,
  MoreHorizontal,
  Plus,
  X,
  ArrowRight,
  ClipboardList,
  FileCheck,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { courses, categories } from './data/courses';
import type { Course } from './data/courses';

const ICON_MAP: Record<string, React.ElementType> = {
  'book-open': BookOpen,
  'flask-conical': FlaskConical,
  'calculator': Calculator,
  'globe': Globe,
  'pen-tool': PenTool,
  'music': Music,
  'dumbbell': Dumbbell,
  'briefcase': Briefcase,
  'palette': Palette,
  'library': Library,
  'cpu': Cpu,
  'compass': Compass,
};

const SECTION_STANDARDS: Record<string, string[]> = {
  KG: ['NR', 'JR', 'SR'],
  PRIMARY: ['1', '2', '3', '4', '5'],
  SECONDARY: ['6', '7', '8', '9', '10'],
  HIGHER_SECONDARY: ['11', '12'],
};

function getSectionFromClassGrade(classGrade: string): string {
  const gradeNumber = classGrade.replace('Class ', '').trim();
  const grade = parseInt(gradeNumber, 10);
  if (grade >= 1 && grade <= 5) return 'PRIMARY';
  if (grade >= 6 && grade <= 10) return 'SECONDARY';
  if (grade >= 11 && grade <= 12) return 'HIGHER_SECONDARY';
  return 'KG';
}

function getSectionLabel(section: string): string {
  switch (section) {
    case 'KG':
      return 'KG';
    case 'PRIMARY':
      return 'Primary Section';
    case 'SECONDARY':
      return 'Secondary Section';
    case 'HIGHER_SECONDARY':
      return 'Higher Section';
    case 'all':
      return 'All Sections';
    default:
      return section;
  }
}

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

export default function CourseMasterPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('My Course');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [standardFilter, setStandardFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const standardOptions = SECTION_STANDARDS[sectionFilter] || [];

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const generateTopics = (course: Course): string[] => {
    const base = course.title.split(' ').slice(0, 3).join(' ');
    return Array.from({ length: course.chapters }, (_, i) => {
      const suffix = i + 1;
      return `Chapter ${suffix}: ${base} ${i === 0 ? 'Fundamentals' : `Part ${suffix}`}`;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.more-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesCategory =
        activeCategory === 'All' || course.category === activeCategory;

      const matchesSearch =
        course.title.toLowerCase().includes(search.toLowerCase()) ||
        course.code.toLowerCase().includes(search.toLowerCase()) ||
        course.instructor.toLowerCase().includes(search.toLowerCase());

      const matchesSection =
        sectionFilter === 'all' || getSectionFromClassGrade(course.classGrade) === sectionFilter;

      const classNumber = course.classGrade.replace('Class ', '').trim();
      const matchesStandard =
        standardFilter === 'all' || classNumber === standardFilter;

      return matchesCategory && matchesSection && matchesStandard && matchesSearch;
    });
  }, [search, activeCategory, sectionFilter, standardFilter]);

  const activeCount = courses.filter((course) => course.status === 'Active').length;
  const draftCount = courses.filter((course) => course.status === 'Draft').length;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Course Master</h1>
              <p className="text-slate-600 mt-1">Manage and organize your course catalog</p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 rounded-xl px-5 h-11 font-semibold">
              <Plus size={18} className="mr-2" />
              Create New Course
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-8 rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          {/* Category Tabs */}
          <div className="border-b border-slate-100 bg-slate-50/30">
            <div className="px-6 py-4 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-2">
                {['All', ...categories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
                      activeCategory === cat
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search Fields */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0D6EFD]">
                <Search size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight">Search & Filter</h3>
                <p className="text-xs text-slate-500 leading-tight">Refine courses by section and standard</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Search Section Dropdown */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">§</span>
                  Search Section
                </label>

                <Select
                  value={sectionFilter}
                  onValueChange={(value) => {
                    setSectionFilter(value as string);
                    setStandardFilter('all');
                  }}
                >
                  <SelectTrigger variant="soft" size="default" icon={<Search size={16} />}>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="PRIMARY">Primary Section</SelectItem>
                    <SelectItem value="SECONDARY">Secondary Section</SelectItem>
                    <SelectItem value="HIGHER_SECONDARY">Higher Section</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Standard Dropdown */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">#</span>
                  Search Standard
                </label>

                <Select
                  value={standardFilter}
                  onValueChange={(value) => setStandardFilter(value as string)}
                >
                  <SelectTrigger variant="soft" size="default" icon={<BookOpen size={16} />}>
                    <SelectValue placeholder="Select Standard" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All Standards</SelectItem>

                    {standardOptions.map((standard) => (
                      <SelectItem key={standard} value={standard}>
                        {standard}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Stats and Actions Row */}
          <div className="mx-6 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">{filteredCourses.length}</span> of {courses.length} courses
              </span>
              <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active: {activeCount}
              </span>
              <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                Drafts: {draftCount}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {(standardFilter !== 'all' || sectionFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSectionFilter('all');
                    setStandardFilter('all');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                >
                  <X size={14} />
                  Clear
                </button>
              )}

              <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/60 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'rounded-md p-2 transition-all',
                    viewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'
                  )}
                  title="Grid view"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'rounded-md p-2 transition-all',
                    viewMode === 'list'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'
                  )}
                  title="List view"
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Courses Grid/List */}
        {filteredCourses.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/60 bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Search size={28} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No courses found</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Try adjusting your search criteria or clearing filters to see more results.
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'grid gap-6',
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1'
            )}
          >
            {filteredCourses.map((course) => {
              const IconComponent = ICON_MAP[course.icon] || BookOpen;

              return (
                <div
                  key={course.id}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:border-slate-300',
                    viewMode === 'list'
                      ? 'flex flex-col lg:flex-row lg:items-center'
                      : 'flex flex-col'
                  )}
                >
                  <div
                    className="h-1.5 w-full shrink-0"
                    style={{ backgroundColor: course.accentColor }}
                  />

                  <div className={cn('flex flex-1 flex-col', viewMode === 'grid' ? '' : 'lg:flex-row lg:items-center')}>
                    <div className={cn('flex-1 p-5', viewMode === 'list' && 'lg:flex lg:items-center lg:gap-4')}>
                      <div className="flex items-start gap-3.5">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100"
                          style={{ backgroundColor: `${course.accentColor}12`, color: course.accentColor }}
                        >
                          <IconComponent size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                                {course.title}
                              </h3>
                              <p className="mt-0.5 text-xs text-slate-500">{course.code}</p>
                            </div>
                            <div className="more-menu-container relative shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(prev => prev === course.id ? null : course.id);
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <MoreHorizontal size={16} />
                              </button>

                              {openMenuId === course.id && (
                                <div
                                  className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-900/5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="max-h-72 overflow-y-auto p-2">
                                    {generateTopics(course).map((topic, index) => (
                                      <button
                                        key={index}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                                      >
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                                          {index + 1}
                                        </span>
                                        <span className="line-clamp-1 font-medium">{topic}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                const section = getSectionFromClassGrade(course.classGrade);
                                setSectionFilter(section);
                                setStandardFilter('all');
                              }}
                              className="inline-flex items-center rounded-md border border-indigo-100 bg-indigo-50/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer"
                            >
                              {getSectionLabel(getSectionFromClassGrade(course.classGrade))}
                            </button>
                            <span className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                              {course.classGrade}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
                                getStatusColor(course.status)
                              )}
                            >
                              {course.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      'border-t border-slate-100 bg-slate-50/40 p-4',
                      viewMode === 'list'
                        ? 'lg:border-t-0 lg:border-l lg:w-auto lg:min-w-fit lg:p-5'
                        : ''
                    )}>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/course-master/lesson-plan/${course.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all"
                        >
                          <ClipboardList size={12} />
                          Lesson Planning
                        </button>
                        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all">
                          <FileCheck size={12} />
                          Assessment
                        </button>
                        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all">
                          <GraduationCap size={12} />
                          Curriculum
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}