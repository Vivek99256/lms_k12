'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  ChevronRight,
  ChevronUp,
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
  Lightbulb,
  CircleDot,
  Target,
  BriefcaseBusiness,
  TriangleAlert,
  ClipboardList,
  Orbit,
  WandSparkles,
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
import { courses, type Course } from '../../data/courses';
import {
  getChaptersByCourseid,
  getSubjectAndChapters,
  type SubjectWithChapters,
} from '../../data/chapters';
import { getChapterKeyConcepts } from '../../data/chapterKeyConcepts';
import type { Chapter } from '../../data/chapters';

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
const UPLOAD_CONTENT_TYPES = ['Presentation', 'Worksheet', 'Reference notes', 'Assessment video'] as const;
const ACCEPTED_UPLOAD_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
];
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

function getConceptIntelligence(conceptTitle: string, chapterTitle: string, index: number) {
  const conceptKey = conceptTitle.toLowerCase();
  const isForceConcept =
    conceptKey.includes('contact') ||
    conceptKey.includes('pressure') ||
    conceptKey.includes('force');
  const isSoundConcept =
    conceptKey.includes('sound') ||
    conceptKey.includes('vibration') ||
    conceptKey.includes('pitch');
  const sectionTopic = isForceConcept ? 'Force and pressure' : isSoundConcept ? 'Sound' : chapterTitle;

  return {
    domain: index % 2 === 0 ? 'Bloom · Understand' : 'Bloom · Apply',
    dok: 'DOK 2 — Skills & concepts',
    topic: sectionTopic,
    knowledge: isForceConcept
      ? [
          'A force is a push or a pull acting on an object',
          'Contact forces need physical touch — muscular force, friction',
          'Non-contact forces act at a distance — magnetic, electrostatic, gravitational',
        ]
      : [
          'Sound is produced by vibrating objects',
          'Pitch changes with frequency while loudness changes with amplitude',
          'Sound needs a medium to travel and can reflect or be absorbed',
        ],
    abilities: isForceConcept
      ? [
          'Classify everyday forces as contact or non-contact',
          "Predict the effect of a force on an object's state of motion",
        ]
      : [
          'Relate vibration patterns to the sound produced',
          'Compare pitch and loudness in everyday listening situations',
        ],
    skills: isForceConcept
      ? ['Observation', 'Reasoning', 'Communication']
      : ['Observation', 'Analysis', 'Pattern recognition'],
    misconceptions: isForceConcept
      ? [
          'A moving object always has a force acting on it',
          'Only living things can exert forces',
        ]
      : [
          'Loud sounds always have high pitch',
          'Sound can travel equally well through a vacuum',
        ],
    prerequisites: isForceConcept ? ['Push and pull (Grade 7)', 'States of motion'] : ['Vibrations', 'Properties of materials'],
    learningOutcomes: isForceConcept
      ? [
          'Identifies the type of force acting in a given situation',
          'Relates force to change in speed, direction or shape',
        ]
      : [
          'Explains how vibrations produce sound in different sources',
          'Distinguishes between pitch, loudness and audibility with examples',
        ],
    competencies: isForceConcept ? ['Scientific inquiry', 'Evidence-based thinking'] : ['Critical thinking', 'Scientific communication'],
    learningObjectives: isForceConcept
      ? [
          'Define force and give two everyday examples',
          'Differentiate contact from non-contact forces with examples',
        ]
      : [
          'Describe how vibration produces sound in simple systems',
          'Use examples to distinguish amplitude from frequency',
        ],
    teachingPedagogies: isForceConcept ? ['Demonstration', 'Inquiry-based', 'Think-pair-share'] : ['Guided practice', 'Hands-on activity', 'Discussion'],
    realWorldApplications: isForceConcept
      ? ['Magnetic door catches', 'Vehicle braking and seat-belt safety']
      : ['Tuning musical instruments', 'Designing quieter classrooms and cities'],
  };
}

function getCourseSectionLabel(courseId: string) {
  const numeric = Number(courseId.replace(/\D/g, '')) || 0;
  return numeric % 2 === 0 ? 'Section A' : 'Section B';
}

function getCourseGradeLabel(classGrade: string) {
  return `Grade ${classGrade.replace('Class', '').trim()}`;
}

function getCurriculumLabel() {
  return 'CBSE curriculum';
}

function getChapterWindow(chapterNumber: number) {
  const ranges = ['Apr W1-W3', 'Apr W4-May W2', 'Jun W3-Jul W3', 'Aug W1-Sep W2', 'Sep W3-Oct W4'];
  return ranges[(chapterNumber - 1) % ranges.length];
}

function getConceptSkillBadge(index: number) {
  return index % 2 === 0 ? 'Understand' : 'Apply';
}

function getConceptSupportMeta(index: number) {
  return {
    misconceptions: index % 2 === 0 ? 2 : 1,
    prerequisites: 2,
    dok: 'DOK 2',
  };
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

  const [subjectData, setSubjectData] = useState<SubjectWithChapters | null>(null);
  const [subjectLoading, setSubjectLoading] = useState(true);

  const courseIdParts = courseId.includes('-') ? courseId.split('-', 2) : [courseId];
  const subjectId = courseIdParts[0];
  const standardId = courseIdParts[1] ?? undefined;

  useEffect(() => {
    let cancelled = false;
    setSubjectLoading(true);
    getSubjectAndChapters(subjectId, standardId)
      .then((data) => {
        if (!cancelled) setSubjectData(data);
      })
      .finally(() => {
        if (!cancelled) setSubjectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, standardId]);

  const staticCourse = courses.find((c) => c.id === courseId);
  const apiSubject = subjectData?.subject ?? null;
  const course: Course | undefined =
    staticCourse ??
    (apiSubject
      ? {
          id: courseId,
          title: apiSubject.subject_name,
          code: '',
          subject: apiSubject.subject_name,
          category: apiSubject.content_category,
          classGrade: `Class ${apiSubject.standard_name}`,
          status: 'Active',
          chapters: subjectData?.chapters.length ?? 0,
          enrollments: 0,
          progress: 0,
          instructor: '',
          createdAt: '',
          accentColor: '#5648E8',
          icon: 'book-open',
        }
      : undefined);
  const allChapters = subjectData?.chapters ?? getChaptersByCourseid(courseId);

  const [searchTerm] = useState('');
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [uploadChapter, setUploadChapter] = useState<Chapter | null>(null);
  const [conceptDrawer, setConceptDrawer] = useState<{
    chapter: Chapter;
    conceptTitle: string;
    conceptIndex: number;
  } | null>(null);
  const [isPresentationMenuOpen, setIsPresentationMenuOpen] = useState(false);
  const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);
  const [isPresentationReady, setIsPresentationReady] = useState(false);
  const [uploadContentType, setUploadContentType] = useState<string>(UPLOAD_CONTENT_TYPES[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [chapterForm, setChapterForm] = useState(EMPTY_CHAPTER_FORM);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceMappingType, setResourceMappingType] = useState('');
  const [resourceMappingValue, setResourceMappingValue] = useState('');
  const [resourceFileType, setResourceFileType] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');

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

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const presentationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnyModalOpen =
    isAddChapterOpen || editingChapter !== null || uploadChapter !== null || conceptDrawer !== null;
  const expandedChapterId = view === 'teacher-resource' ? null : expandedChapterParam;

  useEffect(() => {
    if (!isAnyModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAddChapterOpen(false);
        setEditingChapter(null);
        setUploadChapter(null);
        setConceptDrawer(null);
        setIsPresentationMenuOpen(false);
        setIsGeneratingPresentation(false);
        setIsPresentationReady(false);
        setUploadContentType(UPLOAD_CONTENT_TYPES[0]);
        setUploadFile(null);
        setUploadError('');
        setIsDraggingUpload(false);
        if (presentationTimerRef.current) {
          clearTimeout(presentationTimerRef.current);
          presentationTimerRef.current = null;
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    return () => {
      if (presentationTimerRef.current) {
        clearTimeout(presentationTimerRef.current);
      }
    };
  }, []);

  const closeAddChapterModal = () => {
    setIsAddChapterOpen(false);
    setChapterForm(EMPTY_CHAPTER_FORM);
  };

  const closeUploadContentModal = () => {
    setUploadChapter(null);
    setUploadContentType(UPLOAD_CONTENT_TYPES[0]);
    setUploadFile(null);
    setUploadError('');
    setIsDraggingUpload(false);
  };

  const closeConceptDrawer = () => {
    setConceptDrawer(null);
    setIsPresentationMenuOpen(false);
    setIsGeneratingPresentation(false);
    setIsPresentationReady(false);
    if (presentationTimerRef.current) {
      clearTimeout(presentationTimerRef.current);
      presentationTimerRef.current = null;
    }
  };

  const closeEditChapterModal = () => {
    setEditingChapter(null);
    setChapterForm(EMPTY_CHAPTER_FORM);
  };

  const openUploadContentModal = (chapter: Chapter) => {
    setUploadChapter(chapter);
    setUploadContentType(UPLOAD_CONTENT_TYPES[0]);
    setUploadFile(null);
    setUploadError('');
    setIsDraggingUpload(false);
  };

  const openConceptDrawer = (chapter: Chapter, conceptTitle: string, conceptIndex: number) => {
    setConceptDrawer({
      chapter,
      conceptTitle,
      conceptIndex,
    });
    setIsPresentationMenuOpen(false);
    setIsGeneratingPresentation(false);
    setIsPresentationReady(false);
    if (presentationTimerRef.current) {
      clearTimeout(presentationTimerRef.current);
      presentationTimerRef.current = null;
    }
  };

  const generateTeacherTrainingPresentation = () => {
    setIsPresentationMenuOpen(false);
    setIsPresentationReady(false);
    setIsGeneratingPresentation(true);

    if (presentationTimerRef.current) {
      clearTimeout(presentationTimerRef.current);
    }

    presentationTimerRef.current = setTimeout(() => {
      setIsGeneratingPresentation(false);
      setIsPresentationReady(true);
      presentationTimerRef.current = null;
    }, 1800);
  };

  const validateUploadFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const extensionAllowed = ['pdf', 'pptx', 'docx', 'mp4'].includes(extension ?? '');
    const mimeAllowed = ACCEPTED_UPLOAD_TYPES.includes(file.type);

    if (!mimeAllowed && !extensionAllowed) {
      return 'Only PDF, PPTX, DOCX, and MP4 files are supported.';
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return 'Each file must be 100 MB or smaller.';
    }

    return '';
  };

  const handleUploadFileSelection = (file: File | null) => {
    if (!file) return;

    const validationError = validateUploadFile(file);
    if (validationError) {
      setUploadError(validationError);
      setUploadFile(null);
      return;
    }

    setUploadFile(file);
    setUploadError('');
  };

  const saveUploadContent = () => {
    if (!uploadFile) {
      setUploadError('Please select a file before saving.');
      return;
    }

    closeUploadContentModal();
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

  if (subjectLoading && !course) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8D3E3] border-t-[#5648E8]" />
          <p className="text-sm font-medium text-slate-500">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-10">
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
      <div className="min-h-full">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
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
    <div className="min-h-screen bg-[#E9EEF7] rounded-t-3xl">
      <div className="mx-auto w-full max-w-[1460px] px-4 py-7 sm:px-6 lg:px-8 ">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/course-master')}
              className="font-medium transition-colors hover:text-slate-900"
            >
              Teach / learn
            </button>
            <ChevronRight size={14} className="text-slate-400" />
            <button
              type="button"
              onClick={() => router.push('/course-master')}
              className="font-medium transition-colors hover:text-slate-900"
            >
              Subjects
            </button>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-semibold text-slate-900">
              {course.subject} - {getCourseGradeLabel(course.classGrade).replace('Grade ', 'Grade ')}{' '}
              {getCourseSectionLabel(course.id).replace('Section ', '')}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-[#4f46e5] shadow-sm ring-1 ring-white/80">
            <BookOpen size={14} />
            248 questions in bank
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#4f46e5] shadow-sm ring-1 ring-slate-200/70">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-slate-950">
                {course.subject} - {getCourseGradeLabel(course.classGrade)} - {getCourseSectionLabel(course.id)}
              </h1>
              <p className="mt-1 text-[15px] text-slate-600">
                {allChapters.length} chapters -{' '}
                {allChapters.reduce((total, chapter) => {
                  const chapterConcepts = getChapterKeyConcepts(course.id, chapter.id);
                  return total + (chapterConcepts?.count ?? 0);
                }, 0)}{' '}
                key concepts - {getCurriculumLabel()}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 border-b border-slate-200/80">
          <div className="flex flex-wrap items-center gap-6 text-[15px]">
            <button
              type="button"
              onClick={() => router.push(`/course-master/lesson-plan/${course.id}`)}
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-1 py-3 font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <BookOpen size={16} />
              Lesson plans
            </button>
            <button
              type="button"
              onClick={() => router.push(`/course-master/lesson-plan/${course.id}/curriculum`)}
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-1 py-3 font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <FileText size={16} />
              Curriculum
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 border-b-2 border-[#4f46e5] px-1 py-3 font-medium text-[#4f46e5]"
            >
              <BookOpen size={16} />
              Chapters
            </button>
          </div>
        </div>

        {subjectLoading && getChaptersByCourseid(courseId).length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((skeleton) => (
              <div
                key={skeleton}
                className="overflow-hidden rounded-[14px] border border-slate-200/90 bg-white p-6 shadow-sm"
              >
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-3/4 rounded-lg bg-slate-200" />
                  <div className="h-4 w-1/2 rounded-lg bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChapters.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <BookOpen size={28} className="text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">No chapters found</h3>
            <p className="mx-auto max-w-md text-slate-500">
              Try adjusting your search criteria or clearing filters to see chapters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChapters.map((chapter) => {
              const isExpanded = expandedChapterId === chapter.id;
              const chapterConcepts = getChapterKeyConcepts(course.id, chapter.id);
              const conceptCount = chapterConcepts?.count ?? 0;
              const chapterContentLabel =
                chapter.title === 'Chemical Reactions and Equations'
                  ? 'Presentation - Core chapter walk-through'
                  : `Presentation - ${chapter.title.split(' ').slice(0, 2).join(' ')} demos`;

              return (
                <div
                  key={chapter.id}
                  className="overflow-hidden rounded-[14px] border border-slate-200/90 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
                >
                  <button
                    type="button"
                    onClick={() => updateExpandedChapter(isExpanded ? null : chapter.id)}
                    className="flex w-full items-start gap-3 px-6 py-5 text-left transition-colors hover:bg-slate-50/70"
                  >
                    <ChevronDown
                      size={18}
                      className={cn(
                        'mt-1 shrink-0 text-slate-500 transition-transform duration-200',
                        !isExpanded && '-rotate-90'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[19px] font-bold leading-tight text-slate-950">
                        Chapter {chapter.number} - {chapter.title}
                      </h3>
                      <p className="mt-1 text-[15px] text-slate-600">
                        {getChapterWindow(chapter.number)} - {conceptCount} concepts
                      </p>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200/80 bg-white px-6 py-5">
                      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Chapter Content
                          </span>
                          <span className="inline-flex items-center rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-medium text-[#3157ff]">
                            {chapterContentLabel}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => openUploadContentModal(chapter)}
                          className="h-10 rounded-full bg-[#eef2ff] px-4 text-sm font-semibold text-[#4f46e5] hover:bg-[#e3e9ff] hover:text-[#4338ca]"
                        >
                          <Upload size={16} className="mr-2" />
                          Upload content
                        </Button>
                      </div>

                      <div className="divide-y divide-slate-200/80">
                        {chapterConcepts?.concepts.map((concept, index) => {
                          const supportMeta = getConceptSupportMeta(index);
                          const skillBadge = getConceptSkillBadge(index);

                          return (
                            <div
                              key={concept.title}
                              className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                            >
                              <div className="flex min-w-0 gap-3">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                                  {index + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-medium text-slate-950">{concept.title}</p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {supportMeta.misconceptions} known misconceptions - {supportMeta.prerequisites}{' '}
                                    prerequisites
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                <Badge className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-medium text-[#3157ff] hover:bg-[#eef2ff]">
                                  {skillBadge}
                                </Badge>
                                <Badge className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                                  {supportMeta.dok}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => openConceptDrawer(chapter, concept.title, index)}
                                  className="h-10 rounded-full bg-[#eef2ff] px-4 text-sm font-medium text-[#4f46e5] hover:bg-[#e3e9ff] hover:text-[#4338ca]"
                                >
                                  <Brain size={16} className="mr-2" />
                                  Concept intelligence
                                </Button>
                              </div>
                            </div>
                          );
                        })}

                        {!chapterConcepts?.concepts.length && (
                          <div className="py-8 text-sm text-slate-500">No concepts available for this chapter yet.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {uploadChapter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8 backdrop-blur-[2px]"
          onClick={closeUploadContentModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-content-title"
            className="relative w-full max-w-[690px] rounded-[18px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-8 pb-6 pt-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="upload-content-title" className="text-[24px] font-bold tracking-tight text-slate-950">
                    Upload chapter content
                  </h2>
                  <p className="mt-1 text-[15px] text-slate-600">
                    Chapter {uploadChapter.number} - {uploadChapter.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUploadContentModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-5 space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Content Type
                  </Label>
                  <Select value={uploadContentType} onValueChange={(value) => typeof value === 'string' && setUploadContentType(value)}>
                    <SelectTrigger className="h-11 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                    <SelectContent>
                      {UPLOAD_CONTENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".pdf,.pptx,.docx,.mp4,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4"
                  className="hidden"
                  onChange={(event) => handleUploadFileSelection(event.target.files?.[0] ?? null)}
                />

                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingUpload(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDraggingUpload(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingUpload(false);
                    handleUploadFileSelection(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={cn(
                    'flex min-h-[140px] w-full flex-col items-center justify-center rounded-[12px] border border-dashed px-6 py-8 text-center transition-colors',
                    isDraggingUpload
                      ? 'border-[#8b85ff] bg-[#f4f3ff]'
                      : 'border-[#d4dcf0] bg-[#f8fbff] hover:border-[#b9c6eb] hover:bg-[#f5f8ff]'
                  )}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                    <Upload size={20} />
                  </div>
                  <p className="mt-4 text-[14px] text-slate-600">
                    <span className="font-medium text-[#4f46e5]">Click to upload</span> or drag and drop
                  </p>
                  <p className="mt-1 text-sm text-slate-500">PDF, PPTX, DOCX or MP4 - up to 100 MB each</p>
                  {uploadFile && (
                    <p className="mt-3 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/70">
                      {uploadFile.name}
                    </p>
                  )}
                </button>

                {uploadError && <p className="text-sm font-medium text-rose-600">{uploadError}</p>}
              </div>

              <div className="mt-6 flex items-center justify-end gap-4 border-t border-slate-200/80 pt-4">
                <button
                  type="button"
                  onClick={closeUploadContentModal}
                  className="text-[15px] font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  onClick={saveUploadContent}
                  className="h-10 rounded-xl bg-[#aea8ff] px-5 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(99,91,255,0.28)] hover:bg-[#978fff]"
                >
                  <Upload size={16} className="mr-2" />
                  Save content
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {conceptDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[1px]"
          onClick={closeConceptDrawer}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="concept-intelligence-title"
            className="flex h-full w-full max-w-[500px] flex-col border-l border-slate-200/80 bg-white shadow-[-18px_0_50px_rgba(15,23,42,0.16)] transition-transform duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const details = getConceptIntelligence(
                conceptDrawer.conceptTitle,
                conceptDrawer.chapter.title,
                conceptDrawer.conceptIndex
              );

              const detailSections = [
                { title: 'Knowledge', icon: BookOpen, items: details.knowledge, kind: 'list' as const },
                { title: 'Abilities', icon: Lightbulb, items: details.abilities, kind: 'list' as const },
                { title: 'Skills', icon: WandSparkles, items: details.skills, kind: 'tags' as const },
                { title: 'Misconceptions', icon: TriangleAlert, items: details.misconceptions, kind: 'list' as const },
                { title: 'Prerequisites', icon: Orbit, items: details.prerequisites, kind: 'tags' as const },
                { title: 'Learning outcomes', icon: Target, items: details.learningOutcomes, kind: 'list' as const },
                { title: 'Competencies', icon: BriefcaseBusiness, items: details.competencies, kind: 'tags' as const },
                { title: 'Learning objectives', icon: CircleDot, items: details.learningObjectives, kind: 'list' as const },
                { title: 'Teaching pedagogies', icon: ClipboardList, items: details.teachingPedagogies, kind: 'tags' as const },
                { title: 'Real-world applications', icon: GraduationCap, items: details.realWorldApplications, kind: 'list' as const },
              ];

              return (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-5">
                    <div>
                      <h2 id="concept-intelligence-title" className="text-[18px] font-bold tracking-tight text-slate-950">
                        {conceptDrawer.conceptTitle}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={closeConceptDrawer}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Close drawer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="pointer-events-none fixed right-5 top-5 z-20 flex w-[min(420px,calc(100vw-2.5rem))] flex-col gap-3">
                      <div
                        className={cn(
                          'pointer-events-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition-all duration-300',
                          isGeneratingPresentation
                            ? 'translate-y-0 opacity-100'
                            : '-translate-y-2 opacity-0'
                        )}
                      >
                        <div className="flex gap-3 border-l-4 border-[#4f46e5] px-4 py-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#4f46e5]">
                            <Sparkles size={16} className="animate-pulse" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold text-slate-900">
                              Generating Teacher Training Presentation...
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              &quot;{conceptDrawer.chapter.title}&quot;
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsGeneratingPresentation(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Dismiss generating notification"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'pointer-events-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition-all duration-300',
                          isPresentationReady
                            ? 'translate-y-0 opacity-100'
                            : '-translate-y-2 opacity-0'
                        )}
                      >
                        <div className="flex gap-3 border-l-4 border-emerald-500 px-4 py-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <CheckCircle2 size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold text-slate-900">
                              Teacher Training Presentation Ready
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Added chapter content for &quot;{conceptDrawer.chapter.title}&quot; to the presentation.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsPresentationReady(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Dismiss success notification"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-medium text-[#3157ff] hover:bg-[#eef2ff]">
                        {details.domain}
                      </Badge>
                      <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                        {details.dok}
                      </Badge>
                      <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                        {details.topic}
                      </Badge>
                    </div>

                    <div className="mt-5 rounded-[14px] border border-slate-200/80 bg-[#f8fbff] p-3">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          type="button"
                          className="h-10 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.28)] hover:bg-[#4338ca]"
                        >
                          <Sparkles size={16} className="mr-2" />
                          Generate questions
                        </Button>
                        <div className="relative flex-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsPresentationMenuOpen((prev) => !prev)}
                            className="h-10 w-full justify-between rounded-xl border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                          >
                            <span>Generate classroom presentation</span>
                            {isPresentationMenuOpen ? (
                              <ChevronUp size={16} className="text-slate-500" />
                            ) : (
                              <ChevronDown size={16} className="text-slate-500" />
                            )}
                          </Button>

                          <div
                            className={cn(
                              'absolute left-0 top-[calc(100%+8px)] z-10 w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.12)] transition-all duration-200',
                              isPresentationMenuOpen
                                ? 'pointer-events-auto translate-y-0 opacity-100'
                                : 'pointer-events-none -translate-y-2 opacity-0'
                            )}
                          >
                            <button
                              type="button"
                              onClick={generateTeacherTrainingPresentation}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
                            >
                              <BriefcaseBusiness size={16} className="text-slate-500" />
                              Teacher training presentation
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-5">
                      {detailSections.map((section) => {
                        const SectionIcon = section.icon;

                        return (
                          <section key={section.title}>
                            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              <SectionIcon size={14} className="text-slate-500" />
                              {section.title}
                            </div>

                            {section.kind === 'list' ? (
                              <ul className="space-y-2 text-[15px] leading-6 text-slate-700">
                                {section.items.map((item) => (
                                  <li key={item} className="flex gap-2">
                                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {section.items.map((item) => (
                                  <Badge
                                    key={item}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                  >
                                    {item}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </aside>
        </div>
      )}

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
