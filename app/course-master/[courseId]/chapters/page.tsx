'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  ChevronRight,
  Plus,
  X,
  BookOpen,
  Pencil,
  Trash2,
  ChevronDown,
  Brain,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Search,
  Upload,
  FileText,
  Link2,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

const EMPTY_CHAPTER_FORM = {
  chapterName: '',
  chapterDescription: '',
  sortOrder: '',
  availability: true,
  show: true,
};

const RESOURCE_MAPPING_TYPES = ['Pedagogical Process', 'Material Type', 'Learning Outcome'] as const;
const RESOURCE_MATERIAL_TYPES = ['Mindmap', 'Teacher Training', 'Worksheet', 'Reference Notes', 'Assessment Aid'] as const;
const RESOURCE_FILE_TYPES = ['PDF', 'PPT', 'DOCX', 'Video Link'] as const;

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

function buildTeacherResources(chapterTitle: string) {
  return [
    {
      id: 'tr-1',
      title: 'Mindmap',
      file: 'chemical-reactions-mindmap.pdf',
      type: 'PDF',
      mappedValues: [
        'Pedagogical Process / Instructor-led',
        'Material Type / Mindmap',
      ],
      updatedAt: 'Updated 2 days ago',
    },
    {
      id: 'tr-2',
      title: 'Teacher Training',
      file: 'teacher-training-module.pptx',
      type: 'PPT',
      mappedValues: [
        'Pedagogical Process / Guided practice',
        'Content Type / Training Deck',
      ],
      updatedAt: 'Updated 5 days ago',
    },
    {
      id: 'tr-3',
      title: `${chapterTitle} Notes`,
      file: 'chapter-reference-notes.docx',
      type: 'DOCX',
      mappedValues: [
        'Material Type / Reference Notes',
        'Learning Outcome / Chapter Reinforcement',
      ],
      updatedAt: 'Updated 1 week ago',
    },
  ];
}

export default function ChapterListPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const expandedChapterParam = searchParams.get('expandedChapterId');

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterForm, setChapterForm] = useState(EMPTY_CHAPTER_FORM);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceMappingType, setResourceMappingType] = useState('');
  const [resourceMappingValue, setResourceMappingValue] = useState('');
  const [resourceFileType, setResourceFileType] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');

  const course = courses.find((c) => c.id === courseId);
  const allChapters = getChaptersByCourseid(courseId);
  const view = searchParams.get('view');
  const activeChapterId = searchParams.get('chapterId') ?? '';
  const resourceChapter =
    allChapters.find((chapter) => chapter.id === activeChapterId) || allChapters[0] || null;

  const filteredChapters = useMemo(() => {
    return allChapters.filter((chapter) => {
      return chapter.title.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [allChapters, searchTerm]);

  const teacherResources = useMemo(
    () =>
      resourceChapter
        ? buildTeacherResources(resourceChapter.title)
        : [],
    [resourceChapter]
  );

  const filteredTeacherResources = useMemo(() => {
    return teacherResources.filter((resource) => {
      const haystack = [
        resource.title,
        resource.file,
        resource.type,
        resource.mappedValues.join(' '),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = haystack.includes(resourceSearch.toLowerCase());
      const matchesFileType = !resourceFileType || resource.type === resourceFileType;

      return matchesSearch && matchesFileType;
    });
  }, [resourceFileType, resourceSearch, teacherResources]);

  const isAnyModalOpen = isAddChapterOpen || editingChapter !== null;
  const expandedChapterId = view === 'teacher-resource' ? null : expandedChapterParam;

  useEffect(() => {
    if (!isAnyModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAddChapterOpen(false);
        setEditingChapter(null);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  const closeAddChapterModal = () => {
    setIsAddChapterOpen(false);
    setChapterForm(EMPTY_CHAPTER_FORM);
  };

  const openEditChapterModal = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setChapterForm({
      chapterName: chapter.title,
      chapterDescription: `Curriculum-aligned chapter covering ${chapter.title.toLowerCase()} with classroom activities and assessment support.`,
      sortOrder: String(chapter.number),
      availability: true,
      show: true,
    });
  };

  const closeEditChapterModal = () => {
    setEditingChapter(null);
    setChapterForm(EMPTY_CHAPTER_FORM);
  };

  const updateExpandedChapter = (chapterId: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (chapterId) {
      nextParams.set('expandedChapterId', chapterId);
    } else {
      nextParams.delete('expandedChapterId');
    }

    const nextQuery = nextParams.toString();
    router.replace(`/course-master/${courseId}/chapters${nextQuery ? `?${nextQuery}` : ''}`);
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

  if (view === 'teacher-resource' && resourceChapter) {
    const mappingValueOptions =
      resourceMappingType === 'Pedagogical Process'
        ? ['Instructor-led', 'Guided practice', 'Independent reinforcement']
        : resourceMappingType === 'Material Type'
          ? [...RESOURCE_MATERIAL_TYPES]
          : ['Chapter Reinforcement', 'Concept Mastery', 'Assessment Readiness'];

    return (
      <div className="min-h-screen bg-slate-50/50">
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => router.push(`/course-master/${course.id}/chapters`)}
                className="font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                LMS
              </button>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-medium text-slate-500">{course.subject}</span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-medium text-slate-500">{resourceChapter.title}</span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-semibold text-blue-600">Teacher Resources</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                  <Sparkles size={13} />
                  Resource Studio
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Teacher Resources</h1>
                <p className="mt-2 text-slate-600">
                  Curate supporting assets for <span className="font-semibold text-slate-900">{resourceChapter.title}</span> with a cleaner upload flow and a professional resource library.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/course-master/${course.id}/chapters`)}
                  className="h-11 rounded-2xl border-slate-200 bg-white px-5 font-semibold text-slate-700"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Chapters
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-2xl bg-slate-900 px-5 font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                >
                  <Download size={16} className="mr-2" />
                  Export List
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Teacher Assets</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{resourceChapter.resources.teacherResource}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Link2 size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mapped Values</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{filteredTeacherResources.length * 2}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active Files</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{teacherResources.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Chapter Code</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{course.code}-{resourceChapter.number}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 rounded-[28px] border border-slate-200/70 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.05),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-6 py-5 sm:px-8">
              <h2 className="text-xl font-bold text-slate-900">Add Teacher Resource</h2>
              <p className="mt-1 text-sm text-slate-500">Upload files, tag them to the right pedagogy, and keep instructor materials easy to discover.</p>
            </div>

            <div className="grid gap-8 px-6 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resource-title" className="text-sm font-medium text-slate-700">
                    Title
                  </Label>
                  <Input
                    id="resource-title"
                    value={resourceTitle}
                    onChange={(event) => setResourceTitle(event.target.value)}
                    placeholder="Enter resource title"
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-slate-900 focus-visible:bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resource-file" className="text-sm font-medium text-slate-700">
                    Resource File
                  </Label>
                  <div className="flex h-12 items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 transition hover:border-blue-300 hover:bg-white">
                    <input
                      id="resource-file"
                      type="file"
                      className="w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Mapping Type</Label>
                  <Select value={resourceMappingType} onValueChange={(val) => setResourceMappingType(val ?? '')}>
                    <SelectTrigger variant="soft" size="lg">
                      <SelectValue placeholder="Select mapping type" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCE_MAPPING_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Mapping Value</Label>
                  <Select value={resourceMappingValue} onValueChange={(val) => setResourceMappingValue(val ?? '')}>
                    <SelectTrigger variant="soft" size="lg">
                      <SelectValue placeholder="Select mapping value" />
                    </SelectTrigger>
                    <SelectContent>
                      {mappingValueOptions.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    type="button"
                    className="h-11 rounded-2xl bg-cyan-500 px-5 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-600"
                  >
                    <Plus size={16} className="mr-2" />
                    Save Resource
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl border-slate-200 bg-white px-5 font-semibold text-slate-700"
                  >
                    Save and Add Another
                  </Button>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/70 p-5">
                <h3 className="text-base font-semibold text-slate-900">Chapter Mapping Summary</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Chapter</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{resourceChapter.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recommended Focus</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['Mindmap', 'Reference Notes', 'Assessment Aid'].map((method) => (
                        <Badge key={method} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Teacher Resource Target</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Aim to keep at least {resourceChapter.resources.teacherResource} curated assets available for instructors in this chapter.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Resource Library</h2>
                <p className="mt-1 text-sm text-slate-500">Review uploaded files, mapped values, and quick actions for this chapter.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {['PDF', 'CSV', 'Excel', 'Print'].map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {action}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={resourceSearch}
                  onChange={(event) => setResourceSearch(event.target.value)}
                  placeholder="Search title, file, type, or mapped values"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50/70 pl-11 text-slate-900 focus-visible:bg-white"
                />
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <Select value={resourceFileType} onValueChange={(val) => setResourceFileType(val ?? '')}>
                  <SelectTrigger variant="soft" className="min-w-[180px]">
                    <SelectValue placeholder="Filter by file type" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {RESOURCE_FILE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResourceSearch('');
                    setResourceFileType('');
                  }}
                  className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="min-w-[80px] font-semibold text-slate-700">Sr No</TableHead>
                    <TableHead className="min-w-[240px] font-semibold text-slate-700">Chapter Name</TableHead>
                    <TableHead className="min-w-[180px] font-semibold text-slate-700">Title</TableHead>
                    <TableHead className="min-w-[180px] font-semibold text-slate-700">File</TableHead>
                    <TableHead className="min-w-[300px] font-semibold text-slate-700">Mapped Values</TableHead>
                    <TableHead className="min-w-[140px] font-semibold text-slate-700">Updated</TableHead>
                    <TableHead className="min-w-[130px] text-right font-semibold text-slate-700">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeacherResources.map((resource, index) => (
                    <TableRow key={resource.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-medium text-slate-800">{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-900">{resourceChapter.title}</TableCell>
                      <TableCell className="text-slate-700">{resource.title}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                        >
                          View {resource.file}
                        </button>
                        <div className="mt-1 text-xs text-slate-400">{resource.type}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {resource.mappedValues.map((value) => (
                            <Badge
                              key={value}
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs font-semibold',
                                value.startsWith('Pedagogical Process')
                                  ? 'border-cyan-100 bg-cyan-50 text-cyan-700'
                                  : 'border-slate-200 bg-slate-100 text-slate-700'
                              )}
                            >
                              {value}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{resource.updatedAt}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
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
              const chapterConcepts = getChapterKeyConcepts(course.id, chapter.id);
              return (
                <div
                  key={chapter.id}
                  className="rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
                >
                  {/* Chapter Header */}
                  <div
                    onClick={() => updateExpandedChapter(isExpanded ? null : chapter.id)}
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
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h3 className="min-w-0 text-lg font-bold leading-tight text-slate-900">
                          {chapter.title}
                        </h3>
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <FileText size={12} />
                          Content
                        </button>
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <MessageSquare size={12} />
                          Question & Answer
                        </button>
                      </div>
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
                      {/* Action Buttons */}
<div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="border-b border-slate-200/70 bg-slate-50 px-5 py-4">
                          <h4 className="text-base font-semibold text-slate-900">
                            Key Concepts ({chapterConcepts?.count ?? 0})
                          </h4>
                        </div>

                       <div className="p-4 sm:p-5">
                          {chapterConcepts ? (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              {chapterConcepts.concepts.map((concept) => (
                                <div
                                  key={concept.title}
                                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <h3 className="text-lg font-semibold leading-tight text-slate-900">
                                      {concept.title}
                                    </h3>
                                    <Badge className="shrink-0 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                                      {concept.mastery}
                                    </Badge>
                                  </div>

                                  <p className="mt-3 text-sm leading-6 text-slate-600">
                                    {concept.description}
                                  </p>

                                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-500">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] leading-none text-slate-500">
                                      T
                                    </span>
                                    {concept.time}
                                  </div>

                                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={(event) => {
                                        event.currentTarget.blur();
                                        router.push(
                                          `/course-master/lesson-plan/${course.id}?view=semantic-intelligence&chapterId=${chapter.id}&concept=${encodeURIComponent(
                                            concept.title
                                          )}`
                                        );
                                      }}
                                      className="h-11 rounded-2xl border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                                    >
                                      <Brain size={16} className="mr-2" />
                                      Semantic
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                              <p className="text-sm font-medium text-slate-600">
                                No key concepts are available for this chapter.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
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
                        <button
                          type="button"
                          onClick={() => openEditChapterModal(chapter)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all"
                        >
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

      {editingChapter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-md"
          onClick={closeEditChapterModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-chapter-title"
            className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_35px_120px_rgba(15,23,42,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="relative overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(160deg,#0f172a_0%,#0f766e_48%,#22d3ee_100%)] p-6 text-white lg:border-b-0 lg:border-r">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_34%)]" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
                    <Sparkles size={13} />
                    Update Chapter
                  </div>
                  <h2 id="edit-chapter-title" className="mt-5 text-2xl font-bold tracking-tight">
                    {editingChapter.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/80">
                    Refresh chapter details, adjust visibility, and keep the sequence aligned with your lesson plan flow.
                  </p>

                  <div className="mt-8 space-y-3">
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Chapter Order</p>
                      <p className="mt-2 text-lg font-semibold">#{editingChapter.number}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Resource Links</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-white/90">
                        {editingChapter.resources.teacherResource} teacher resources connected
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Questions Bank</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-white/90">
                        {editingChapter.resources.questions} question resources linked
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white">
                <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Chapter Editor</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Modern Update Panel</h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditChapterModal}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto px-6 py-6">
                  <div className="grid gap-6">
                    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_160px]">
                      <div className="space-y-2">
                        <Label htmlFor="edit-chapter-name" className="text-sm font-medium text-slate-700">
                          Chapter Name
                        </Label>
                        <Input
                          id="edit-chapter-name"
                          value={chapterForm.chapterName}
                          onChange={(event) =>
                            setChapterForm((prev) => ({ ...prev, chapterName: event.target.value }))
                          }
                          className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-slate-900 shadow-sm transition focus-visible:bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-sort-order" className="text-sm font-medium text-slate-700">
                          Sort Order
                        </Label>
                        <Input
                          id="edit-sort-order"
                          type="number"
                          value={chapterForm.sortOrder}
                          onChange={(event) =>
                            setChapterForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                          }
                          className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-slate-900 shadow-sm transition focus-visible:bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-chapter-description" className="text-sm font-medium text-slate-700">
                        Chapter Description
                      </Label>
                      <Textarea
                        id="edit-chapter-description"
                        value={chapterForm.chapterDescription}
                        onChange={(event) =>
                          setChapterForm((prev) => ({ ...prev, chapterDescription: event.target.value }))
                        }
                        className="min-h-32 rounded-2xl border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 shadow-sm transition focus-visible:bg-white"
                      />
                    </div>

                    <div className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Visibility Controls
                        </h4>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-200">
                          <input
                            type="checkbox"
                            checked={chapterForm.availability}
                            onChange={(event) =>
                              setChapterForm((prev) => ({ ...prev, availability: event.target.checked }))
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Available to learners</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Keep this chapter accessible across linked lesson plan views.
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-200">
                          <input
                            type="checkbox"
                            checked={chapterForm.show}
                            onChange={(event) =>
                              setChapterForm((prev) => ({ ...prev, show: event.target.checked }))
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Show in chapter list</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Surface the chapter in the LMS list and connected curriculum summaries.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Changes are local to this prototype view until backend save is connected.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeEditChapterModal}
                      className="h-11 rounded-2xl border-slate-200 bg-white px-5 font-semibold text-slate-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={closeEditChapterModal}
                      className="h-11 rounded-2xl bg-slate-900 px-5 font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                    >
                      Update Chapter
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
