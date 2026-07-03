'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronRight,
  Plus,
  X,
  BookOpen,
  Pencil,
  Trash2,
  ChevronDown,
  BarChart3,
  FileText,
  GraduationCap,
  Lightbulb,
  PlusCircle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { courses } from '../../data/courses';
import { getChaptersByCourseid } from '../../data/chapters';
import { getChapterKeyConcepts } from '../../data/chapterKeyConcepts';
import type { Chapter } from '../../data/chapters';

const CHAPTER_COLORS = [
  '#0EA5E9', // Sky blue
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#FBBF24', // Amber
  '#10B981', // Emerald
  '#A78BFA', // Purple
  '#FB7185', // Rose
  '#64748B', // Slate
];

const TEACHING_METHODOLOGIES = [
  'Inquiry Based Teaching',
  'Experiential Based Teaching',
  'Art Initiated Teaching',
  'Game Based, Activity Based Teaching, Project Based Teaching',
  'Flashcard Based Teaching/Flipped Classroom Teaching',
  'Scenario Based Teaching',
  'Spiritual Science Teaching',
  'Skill/Competency Based Teaching',
  'Concept Based Teaching Sports',
];

const RESOURCE_SECTIONS = [
  'My Course',
  'Videos',
  'Recorded Videos',
  'Remedial Class',
  'Classroom Presentation',
  'Classroom Activity',
  'Revision Notes',
] as const;

function getChapterSummary(chapterTitle: string) {
  if (chapterTitle === 'Chemical Reactions and Equations') {
    return {
      mappedUnit: 'Chemical Substances-Nature and Behaviour (ID: 22)',
      chapterName: chapterTitle,
      academicYear: '2026',
    };
  }

  return {
    mappedUnit: `${chapterTitle} (Mapped Unit)`,
    chapterName: chapterTitle,
    academicYear: '2026',
  };
}

function getChapterColor(chapterNumber: number): string {
  return CHAPTER_COLORS[(chapterNumber - 1) % CHAPTER_COLORS.length];
}

export default function ChapterListPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethodologies, setSelectedMethodologies] = useState<string[]>([]);
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [openResourceTab, setOpenResourceTab] = useState<string | null>(null);
  const [chapterForm, setChapterForm] = useState({
    chapterName: '',
    chapterDescription: '',
    sortOrder: '',
    availability: true,
    show: true,
  });

  const course = courses.find((c) => c.id === courseId);
  const allChapters = getChaptersByCourseid(courseId);

  const filteredChapters = useMemo(() => {
    return allChapters.filter((chapter) => {
      const matchesSearch = chapter.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesMethodology =
        selectedMethodologies.length === 0 ||
        selectedMethodologies.some((method) =>
          chapter.teachingMethodologies.includes(method)
        );

      return matchesSearch && matchesMethodology;
    });
  }, [searchTerm, selectedMethodologies]);

  const uniqueMethodologies = useMemo(() => {
    const methods = new Set<string>();
    allChapters.forEach((chapter) => {
      chapter.teachingMethodologies.forEach((method) => {
        methods.add(method);
      });
    });
    return Array.from(methods);
  }, [allChapters]);

  useEffect(() => {
    if (!isAddChapterOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAddChapterOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isAddChapterOpen]);

  const closeAddChapterModal = () => {
    setIsAddChapterOpen(false);
    setChapterForm({
      chapterName: '',
      chapterDescription: '',
      sortOrder: '',
      availability: true,
      show: true,
    });
  };

  const toggleResourceTab = (section: string) => {
    setOpenResourceTab((current) => (current === section ? null : section));
  };

  if (!course) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Course not found</h2>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => router.back()}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              LMS
            </button>
            <ChevronRight size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">{course.classGrade.replace('Class ', '')}</span>
            <ChevronRight size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-blue-600">{course.subject}</span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Chapter List</h1>
              <p className="text-slate-600 mt-1">{course.title}</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedMethodologies([]);
                }}
                className="rounded-xl h-11 px-4 font-semibold text-slate-600 border-slate-200"
              >
                <X size={16} className="mr-2" />
                Clear Search
              </Button>
              <Button
                onClick={() => setIsAddChapterOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 rounded-xl h-11 px-5 font-semibold"
              >
                <Plus size={18} className="mr-2" />
                Add Chapter
              </Button>
            </div>
          </div>
        </div>

        {/* Teaching Methodologies Filter */}
        {uniqueMethodologies.length > 0 && (
          <div className="mb-8 rounded-2xl border border-slate-200/60 bg-white shadow-sm p-6">
            <div
              className="flex flex-nowrap gap-2 overflow-x-auto pb-1 pr-1 [&::-webkit-scrollbar]:hidden"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {uniqueMethodologies.map((method) => (
                <button
                  key={method}
                  onClick={() => {
                    setSelectedMethodologies((prev) =>
                      prev.includes(method)
                        ? prev.filter((m) => m !== method)
                        : [...prev, method]
                    );
                  }}
                  className={cn(
                    'shrink-0 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 whitespace-nowrap',
                    selectedMethodologies.includes(method)
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30'
                      : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border border-cyan-200'
                  )}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chapters List */}
        {filteredChapters.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/60 bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <BookOpen size={28} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No chapters found</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Try adjusting your search criteria or clearing filters to see chapters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChapters.map((chapter) => {
              const chapterColor = getChapterColor(chapter.number);
              const isExpanded = expandedChapterId === chapter.id;
              const chapterSummary = getChapterSummary(chapter.title);

              return (
                <div
                  key={chapter.id}
                  className="rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
                >
                  {/* Chapter Header */}
                  <div
                    onClick={() =>
                      setExpandedChapterId(isExpanded ? null : chapter.id)
                    }
                    className="flex items-center gap-4 p-6 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Chapter Number Circle */}
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white font-bold text-lg shadow-md"
                      style={{ backgroundColor: chapterColor }}
                    >
                      {chapter.number}
                    </div>

                    {/* Chapter Title */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        {chapter.title}
                      </h3>
                    </div>

                    {/* Chevron */}
                    <ChevronDown
                      size={20}
                      className={cn(
                        'shrink-0 text-slate-400 transition-transform duration-300',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </div>

                  {/* Chapter Details (Expandable) */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/30 p-6">
                      {/* Teaching Methodologies */}
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                          Teaching Methodologies
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {chapter.teachingMethodologies.map((method) => (
                            <span
                              key={method}
                              className="inline-flex rounded-full bg-cyan-100 text-cyan-700 px-3 py-1 text-xs font-semibold"
                            >
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                          Actions & Resources
                        </h4>
                        <div
                          className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1 pr-1 [&::-webkit-scrollbar]:hidden"
                          style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                          }}
                        >
                          <button className="shrink-0 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                            <GraduationCap size={14} />
                            <span className="hidden sm:inline">Teacher Resource</span>
                            <span className="sm:hidden">{chapter.resources.teacherResource}</span>
                          </button>

                          <button className="shrink-0 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
                            <BookOpen size={14} />
                            <span className="hidden sm:inline">Lesson Planning</span>
                            <span className="sm:hidden">{chapter.resources.lessonPlanning}</span>
                          </button>

                          <button className="shrink-0 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700">
                            <BarChart3 size={14} />
                            <span className="hidden sm:inline">Chapter-wise Mapping</span>
                            <span className="sm:hidden">{chapter.resources.chapterMapping}</span>
                          </button>

                          <button className="shrink-0 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700">
                            <Lightbulb size={14} />
                            <span className="hidden sm:inline">H5P Content</span>
                            <span className="sm:hidden">{chapter.resources.hspContent}</span>
                          </button>

                          <button className="shrink-0 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition-all hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700">
                            <PlusCircle size={14} />
                            <span className="hidden sm:inline">Add Content</span>
                          </button>

                          <button className="shrink-0 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                            <MessageSquare size={14} />
                            <span className="hidden sm:inline">Question Answer</span>
                            <span className="sm:hidden">{chapter.resources.questions}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/course-master/lesson-plan/${course.id}?view=key-concepts&chapterId=${chapter.id}`
                              )
                            }
                            className="shrink-0 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Lightbulb size={14} />
                            <span className="hidden sm:inline">Key Concepts</span>
                            <span className="sm:hidden">KC</span>
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 space-y-3">
                        {RESOURCE_SECTIONS.map((section) => (
                          <button
                            key={section}
                            type="button"
                            onClick={() => toggleResourceTab(section)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                              openResourceTab === section
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <span>{section}</span>
                            <ChevronDown
                              size={16}
                              className={cn(
                                'text-slate-400 transition-transform',
                                openResourceTab === section && 'rotate-180 text-blue-500'
                              )}
                            />
                          </button>
                        ))}
                      </div>


                      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="border-b border-slate-200/70 bg-slate-50 px-5 py-4">
                          <h4 className="text-base font-semibold text-slate-900">Chapter Summary</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left">
                            <thead className="bg-slate-50/90">
                              <tr className="border-b border-slate-200/80">
                                <th className="px-5 py-4 text-sm font-semibold text-slate-800">Mapped Unit</th>
                                <th className="px-5 py-4 text-sm font-semibold text-slate-800">Chapter Name</th>
                                <th className="px-5 py-4 text-sm font-semibold text-slate-800">Academic Year</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-100 last:border-b-0">
                                <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                  {chapterSummary.mappedUnit}
                                </td>
                                <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                  {chapterSummary.chapterName}
                                </td>
                                <td className="px-5 py-4 text-sm text-slate-700">
                                  {chapterSummary.academicYear}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Edit and Delete */}
                      <div className="mt-4 flex gap-2 justify-end">
                        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all">
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition-all">
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAddChapterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md"
          onClick={closeAddChapterModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-chapter-title"
            className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4">
              <h2 id="add-chapter-title" className="text-lg font-semibold tracking-tight text-slate-900">
                Add Chapter
              </h2>
              <button
                type="button"
                onClick={closeAddChapterModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2">
                <Label htmlFor="chapter-name" className="text-sm font-medium text-slate-700">
                  Chapter Name
                </Label>
                <Input
                  id="chapter-name"
                  value={chapterForm.chapterName}
                  onChange={(event) =>
                    setChapterForm((prev) => ({ ...prev, chapterName: event.target.value }))
                  }
                  className="h-11 rounded-xl border-slate-300 bg-slate-50/60 px-3 text-slate-900 placeholder:text-slate-400 focus-visible:bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chapter-description" className="text-sm font-medium text-slate-700">
                  Chapter Description
                </Label>
                <Textarea
                  id="chapter-description"
                  value={chapterForm.chapterDescription}
                  onChange={(event) =>
                    setChapterForm((prev) => ({ ...prev, chapterDescription: event.target.value }))
                  }
                  className="min-h-28 rounded-xl border-slate-300 bg-slate-50/60 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus-visible:bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort-order" className="text-sm font-medium text-slate-700">
                  Sort Order
                </Label>
                <Input
                  id="sort-order"
                  type="number"
                  value={chapterForm.sortOrder}
                  onChange={(event) =>
                    setChapterForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                  }
                  className="h-11 rounded-xl border-slate-300 bg-slate-50/60 px-3 text-slate-900 placeholder:text-slate-400 focus-visible:bg-white"
                />
              </div>

              <div className="space-y-4 pt-1">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={chapterForm.availability}
                    onChange={(event) =>
                      setChapterForm((prev) => ({ ...prev, availability: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Availability
                </label>

                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={chapterForm.show}
                    onChange={(event) =>
                      setChapterForm((prev) => ({ ...prev, show: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Show
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-200/80 bg-slate-50/60 px-6 py-4">
              <Button
                onClick={closeAddChapterModal}
                className="h-10 rounded-xl bg-cyan-500 px-5 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-600"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
