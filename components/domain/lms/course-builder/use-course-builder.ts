'use client';

/**
 * Ported from G2G's `hooks/use-course-builder.ts` (`useCourseBuilder`).
 *
 * Adaptations:
 * - `useAuth()` / `getLaravelContext(user)` -> `buildSessionContext()`.
 * - `lmsCatalogService.getFilterOptions` / `.getCourses` (Package 1's
 *   Learning Catalog service) -> this package's own
 *   `lmsCourseBuilderService.options()`, which serves the same reference
 *   data (categories/types/departments/job roles/languages/certificate
 *   templates/course list for the prerequisite picker) from
 *   `CourseBuilderController::options()` — see that controller's
 *   doc-comment for why it does not depend on Package 1's catalog.
 * - Every `profileName` parameter G2G threaded through for
 *   `user_profile_name` gating is dropped: this repo's backend resolves the
 *   actor from the hydrated session (`ResolvesLmsIdentity`), never from a
 *   client-supplied profile name.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildSessionContext,
  lmsCourseBuilderService,
  type AssessmentPayload,
  type BuilderAssessment,
  type BuilderCoursePayload,
  type BuilderModule,
  type CatalogDepartment,
  type CatalogJobRole,
  type ContentKind,
  type CourseSettings,
  type CoursePrerequisite,
  type CourseVisibility,
  type EnrollmentRule,
  type PaperQuestion,
  type QuestionPayload,
} from './course-builder-service';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* ─── Form shape ───────────────────────────────────────────────────────────── */

export interface CourseBuilderForm {
  // Step 1
  display_name: string;
  subject_code: string;
  description: string;
  subject_type: string;
  duration: string;
  subject_category: string;
  language: string;
  is_mandatory: boolean;
  discussion_enabled: boolean;
  visibility: CourseVisibility;
  standard_id: string;
  jobrole: string;
  thumbnail: File | null;

  // Step 3
  passing_score: string;
  max_attempts: string;

  // Step 4
  issue_certificate: boolean;
  certificate_template: string;
  certificate_validity_months: string;
  recert_alerts: boolean;
  /** Passing this course writes the mapped competency rating without a review step. */
  auto_apply_rating: boolean;

  // Step 5
  enrollment_rule: EnrollmentRule;
  restrict_departments: number[];
  restrict_roles: string[];
  available_from: string;
  available_until: string;
}

const EMPTY_FORM: CourseBuilderForm = {
  display_name: '',
  subject_code: '',
  description: '',
  subject_type: '',
  duration: '',
  subject_category: '',
  language: '',
  is_mandatory: false,
  discussion_enabled: false,
  visibility: 'all',
  standard_id: '',
  jobrole: '',
  thumbnail: null,
  passing_score: '',
  max_attempts: '',
  issue_certificate: true,
  certificate_template: '',
  certificate_validity_months: '',
  recert_alerts: false,
  auto_apply_rating: false,
  enrollment_rule: 'open',
  restrict_departments: [],
  restrict_roles: [],
  available_from: '',
  available_until: '',
};

export const BUILDER_STEPS = [
  { id: 1, label: 'Basic Information' },
  { id: 2, label: 'Content & Modules' },
  { id: 3, label: 'Assessments' },
  { id: 4, label: 'Certification' },
  { id: 5, label: 'Publish Settings' },
] as const;

export type BuilderErrors = Partial<Record<keyof CourseBuilderForm, string>>;

function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes(':')) {
    const [hours, minutes] = trimmed.split(':').map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  }

  const minutes = Number(trimmed);
  return Number.isFinite(minutes) ? minutes : null;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '';
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useCourseBuilder(editingId?: number | null) {
  const session = useMemo(() => buildSessionContext(), []);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CourseBuilderForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<BuilderErrors>({});

  const [courseId, setCourseId] = useState<number | null>(null);
  const [prerequisites, setPrerequisites] = useState<CoursePrerequisite[]>([]);

  const [modules, setModules] = useState<BuilderModule[]>([]);
  const [assessments, setAssessments] = useState<BuilderAssessment[]>([]);
  /**
   * The questions on ONE paper — whichever the author has open.
   *
   * Loaded per paper rather than for all of them at once: a course can carry
   * several quizzes, and only one is being edited at a time.
   */
  const [openPaperId, setOpenPaperId] = useState<number | null>(null);
  const [paperQuestions, setPaperQuestions] = useState<PaperQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [departments, setDepartments] = useState<CatalogDepartment[]>([]);
  const [jobRoles, setJobRoles] = useState<CatalogJobRole[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [certificateTemplates, setCertificateTemplates] = useState<{ value: string; label: string }[]>([]);
  const [courseOptions, setCourseOptions] = useState<CoursePrerequisite[]>([]);

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = useMemo(() => editingId != null && editingId > 0, [editingId]);

  const setField = useCallback(
    <K extends keyof CourseBuilderForm>(key: K, value: CourseBuilderForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
    },
    []
  );

  /* ── Reference data ── */

  const loadOptions = useCallback(async () => {
    if (!session.token) {
      setLoadingOptions(false);
      setError('Your session has expired. Sign in again to build a course.');
      return;
    }

    setLoadingOptions(true);

    try {
      const response = await lmsCourseBuilderService.options(session);
      const data = response.data;

      setCategories(data.categories ?? []);
      setTypes(data.subject_types ?? []);
      setDepartments(data.departments ?? []);
      setJobRoles(data.job_roles ?? []);
      setLanguages(data.languages ?? []);
      setCertificateTemplates(data.certificate_templates ?? []);
      setCourseOptions((data.courses ?? []).map((course) => ({ id: course.id, title: course.display_name })));
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the course options.'));
    } finally {
      setLoadingOptions(false);
    }
  }, [session]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOptions();
    });
  }, [loadOptions]);

  /* ── Validation, mirroring the Laravel rules ── */

  const validateStep = useCallback(
    (target: number): BuilderErrors => {
      const found: BuilderErrors = {};

      if (target === 1) {
        if (!form.display_name.trim()) found.display_name = 'Course title is required.';
        else if (form.display_name.length > 191) found.display_name = 'Keep the title under 191 characters.';

        if (!form.standard_id) found.standard_id = 'Select a department.';

        if (form.description.length > 2000) found.description = 'Keep the description under 2000 characters.';

        if (form.duration.trim() && parseDuration(form.duration) === null) {
          found.duration = 'Use HH:MM, or a number of minutes.';
        }
      }

      if (target === 3) {
        const score = toNumberOrNull(form.passing_score);
        if (form.passing_score.trim() && (score === null || score < 0 || score > 100)) {
          found.passing_score = 'Passing score must be between 0 and 100.';
        }

        const attempts = toNumberOrNull(form.max_attempts);
        if (form.max_attempts.trim() && (attempts === null || attempts < 1 || attempts > 100)) {
          found.max_attempts = 'Attempts must be between 1 and 100.';
        }
      }

      if (target === 4) {
        const months = toNumberOrNull(form.certificate_validity_months);
        if (form.certificate_validity_months.trim() && (months === null || months < 1 || months > 600)) {
          found.certificate_validity_months = 'Validity must be between 1 and 600 months.';
        }
      }

      if (target === 5) {
        if (form.available_from && form.available_until && form.available_until < form.available_from) {
          found.available_until = 'The end date cannot be before the start date.';
        }
      }

      return found;
    },
    [form]
  );

  /* ── Saving ── */

  const buildPayload = useCallback(
    (status: number): BuilderCoursePayload => ({
      display_name: form.display_name.trim(),
      standard_id: Number(form.standard_id),
      subject_category: form.subject_category || null,
      subject_code: form.subject_code || null,
      subject_type: form.subject_type || null,
      jobrole: form.jobrole || null,
      certificate_validity_months: toNumberOrNull(form.certificate_validity_months),
      status,
      settings: {
        description: form.description || null,
        duration_minutes: parseDuration(form.duration),
        language: form.language || null,
        is_mandatory: form.is_mandatory,
        discussion_enabled: form.discussion_enabled,
        visibility: form.visibility,
        passing_score: toNumberOrNull(form.passing_score),
        max_attempts: toNumberOrNull(form.max_attempts),
        issue_certificate: form.issue_certificate,
        certificate_template: form.certificate_template || null,
        recert_alerts: form.recert_alerts,
        auto_apply_rating: form.auto_apply_rating,
        enrollment_rule: form.enrollment_rule,
        restrict_departments: form.restrict_departments.length ? form.restrict_departments : null,
        restrict_roles: form.restrict_roles.length ? form.restrict_roles : null,
        available_from: form.available_from || null,
        available_until: form.available_until || null,
      },
      prerequisites: prerequisites.map((item) => item.id),
    }),
    [form, prerequisites]
  );

  const save = useCallback(
    async (status: number, successMessage: string) => {
      if (!session.token) {
        const failure = 'Your session has expired. Sign in again to save.';
        setError(failure);
        return { ok: false, message: failure };
      }

      const found = validateStep(1);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setStep(1);
        const failure = 'Check the highlighted fields on Basic Information.';
        setError(failure);
        return { ok: false, message: failure };
      }

      setSaving(true);
      setError(null);
      setMessage(null);

      try {
        const payload = buildPayload(status);

        const response = courseId
          ? await lmsCourseBuilderService.update(session, courseId, payload)
          : form.thumbnail
            ? await lmsCourseBuilderService.createWithImage(session, payload, form.thumbnail)
            : await lmsCourseBuilderService.create(session, payload);

        const savedId = response.course_id ?? courseId;
        if (savedId) setCourseId(savedId);
        if (response.prerequisites) setPrerequisites(response.prerequisites);

        setMessage(successMessage);
        return { ok: true, message: successMessage, courseId: savedId };
      } catch (saveError) {
        const failure = toMessage(saveError, 'Failed to save the course.');
        setError(failure);
        return { ok: false, message: failure };
      } finally {
        setSaving(false);
      }
    },
    [session, validateStep, buildPayload, courseId, form.thumbnail]
  );

  const saveDraft = useCallback(() => save(0, 'Draft saved.'), [save]);
  const publish = useCallback(() => save(1, 'Course published.'), [save]);

  /* ── Modules and content ── */

  const reloadModules = useCallback(
    async (id: number) => {
      try {
        const response = await lmsCourseBuilderService.modules(session, id);
        setModules(response.data?.chapters ?? []);
      } catch {
        setModules([]);
      }
    },
    [session]
  );

  const run = useCallback(
    async (operation: () => Promise<void | string>, success: string | null, fallback: string) => {
      setSaving(true);
      setError(null);
      setMessage(null);

      try {
        const returned = await operation();
        const outcome = success ?? (typeof returned === 'string' ? returned : 'Done.');
        setMessage(outcome);
        return { ok: true, message: outcome };
      } catch (writeError) {
        const failure = toMessage(writeError, fallback);
        setError(failure);
        return { ok: false, message: failure };
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const addModule = useCallback(
    (name: string) =>
      run(
        async () => {
          if (!courseId) throw new Error('Save the course before adding modules.');
          await lmsCourseBuilderService.createModule(session, courseId, {
            chapter_name: name,
            sort_order: modules.length + 1,
          });
          await reloadModules(courseId);
        },
        `"${name}" added.`,
        'Failed to add the module.'
      ),
    [run, session, courseId, modules.length, reloadModules]
  );

  const renameModule = useCallback(
    (moduleId: number, name: string) =>
      run(
        async () => {
          await lmsCourseBuilderService.updateModule(session, moduleId, { chapter_name: name });
          if (courseId) await reloadModules(courseId);
        },
        'Module renamed.',
        'Failed to rename the module.'
      ),
    [run, session, courseId, reloadModules]
  );

  const removeModule = useCallback(
    (moduleId: number) =>
      run(
        async () => {
          await lmsCourseBuilderService.deleteModule(session, moduleId);
          if (courseId) await reloadModules(courseId);
        },
        'Module removed.',
        'Failed to remove the module.'
      ),
    [run, session, courseId, reloadModules]
  );

  const addContent = useCallback(
    (moduleId: number, kind: ContentKind, title: string, url: string) =>
      run(
        async () => {
          await lmsCourseBuilderService.createContent(session, {
            chapter_id: moduleId,
            title,
            file_type: kind,
            filename: url || null,
            url: url || null,
          });
          if (courseId) await reloadModules(courseId);
        },
        `"${title}" added.`,
        'Failed to add the content item.'
      ),
    [run, session, courseId, reloadModules]
  );

  const removeContent = useCallback(
    (contentId: number) =>
      run(
        async () => {
          await lmsCourseBuilderService.deleteContent(session, contentId);
          if (courseId) await reloadModules(courseId);
        },
        'Content removed.',
        'Failed to remove the content item.'
      ),
    [run, session, courseId, reloadModules]
  );

  /* ── Assessments ── */

  const reloadAssessments = useCallback(
    async (id: number) => {
      try {
        const response = await lmsCourseBuilderService.assessments(session, id);
        setAssessments(response.data ?? []);
      } catch {
        setAssessments([]);
      }
    },
    [session]
  );

  const addAssessment = useCallback(
    (payload: Omit<AssessmentPayload, 'course_id'>) =>
      run(
        async () => {
          if (!courseId) throw new Error('Save the course before adding assessments.');
          await lmsCourseBuilderService.createAssessment(session, { ...payload, course_id: courseId });
          await reloadAssessments(courseId);
        },
        `"${payload.paper_name}" added.`,
        'Failed to add the assessment.'
      ),
    [run, session, courseId, reloadAssessments]
  );

  const removeAssessment = useCallback(
    (id: number) =>
      run(
        async () => {
          await lmsCourseBuilderService.deleteAssessment(session, id);
          if (courseId) await reloadAssessments(courseId);
        },
        'Assessment removed.',
        'Failed to remove the assessment.'
      ),
    [run, session, courseId, reloadAssessments]
  );

  /* ── Questions on a quiz ── */

  const reloadQuestions = useCallback(
    async (paperId: number) => {
      setQuestionsLoading(true);
      try {
        const response = await lmsCourseBuilderService.paperQuestions(session, paperId);
        setPaperQuestions(response.data ?? []);
      } catch {
        setPaperQuestions([]);
      } finally {
        setQuestionsLoading(false);
      }
    },
    [session]
  );

  /** Open a paper for question editing, or close the one that is open. */
  const openPaper = useCallback(
    (paperId: number | null) => {
      setOpenPaperId(paperId);
      setPaperQuestions([]);
      if (paperId !== null) void reloadQuestions(paperId);
    },
    [reloadQuestions]
  );

  /**
   * Ask the AI to write this quiz from the course's content.
   *
   * Reports what actually happened rather than a flat "done": a run that
   * wrote fewer than asked has to say so.
   */
  const generateQuestions = useCallback(
    (paperId: number, count: number) =>
      run(
        async () => {
          const response = await lmsCourseBuilderService.generateQuestions(session, paperId, count);
          await reloadQuestions(paperId);
          if (courseId) await reloadAssessments(courseId);
          return response.message;
        },
        null,
        'The questions could not be generated.'
      ),
    [run, session, reloadQuestions, reloadAssessments, courseId]
  );

  const addQuestion = useCallback(
    (paperId: number, payload: QuestionPayload) =>
      run(
        async () => {
          await lmsCourseBuilderService.addQuestion(session, paperId, payload);
          await reloadQuestions(paperId);
          // total_ques changed on the paper, so the list above it must agree.
          if (courseId) await reloadAssessments(courseId);
        },
        'Question added.',
        'Failed to add the question.'
      ),
    [run, session, reloadQuestions, reloadAssessments, courseId]
  );

  const updateQuestion = useCallback(
    (paperId: number, questionId: number, payload: QuestionPayload) =>
      run(
        async () => {
          await lmsCourseBuilderService.updateQuestion(session, paperId, questionId, payload);
          await reloadQuestions(paperId);
          if (courseId) await reloadAssessments(courseId);
        },
        'Question updated.',
        'Failed to update the question.'
      ),
    [run, session, reloadQuestions, reloadAssessments, courseId]
  );

  const removeQuestion = useCallback(
    (paperId: number, questionId: number) =>
      run(
        async () => {
          await lmsCourseBuilderService.deleteQuestion(session, paperId, questionId);
          await reloadQuestions(paperId);
          if (courseId) await reloadAssessments(courseId);
        },
        'Question removed.',
        'Failed to remove the question.'
      ),
    [run, session, reloadQuestions, reloadAssessments, courseId]
  );

  const loadCourse = useCallback(
    async (id: number) => {
      if (!session.token) {
        setError('Your session has expired. Sign in again to load this course.');
        return;
      }

      setLoadingOptions(true);
      setError(null);
      setMessage(null);

      try {
        const response = await lmsCourseBuilderService.load(session, id);
        const course = response.data as Record<string, unknown> | undefined;
        const settings = response.settings;

        if (!course) {
          setError('Course not found.');
          return;
        }

        setForm((current) => ({
          ...current,
          display_name: (course.display_name as string) ?? '',
          subject_code: (course.subject_code as string) ?? '',
          short_name: (course.short_name as string) ?? '',
          sort_order: course.sort_order != null ? String(course.sort_order) : '1',
          description: (settings?.description as string) ?? '',
          subject_type: (course.subject_type as string) ?? '',
          duration: settings?.duration_minutes != null ? formatDuration(Number(settings.duration_minutes)) : '',
          subject_category: (course.subject_category as string) ?? '',
          language: (settings?.language as string) ?? '',
          is_mandatory: Boolean(settings?.is_mandatory),
          discussion_enabled: Boolean(settings?.discussion_enabled),
          visibility: (settings?.visibility as CourseVisibility) ?? 'all',
          standard_id: course.standard_id != null ? String(course.standard_id) : '',
          jobrole: (course.jobrole as string) ?? '',
          status: Boolean((course.status as number) ?? 1),
          thumbnail: null,
          passing_score: settings?.passing_score != null ? String(settings.passing_score) : '',
          max_attempts: settings?.max_attempts != null ? String(settings.max_attempts) : '',
          issue_certificate: settings?.issue_certificate ?? true,
          certificate_template: (settings?.certificate_template as string) ?? '',
          certificate_validity_months: course.certificate_validity_months != null ? String(course.certificate_validity_months) : '',
          recert_alerts: Boolean(settings?.recert_alerts),
          auto_apply_rating: Boolean(settings?.auto_apply_rating),
          enrollment_rule: (settings?.enrollment_rule as EnrollmentRule) ?? 'open',
          restrict_departments: (settings?.restrict_departments as number[]) ?? [],
          restrict_roles: (settings?.restrict_roles as string[]) ?? [],
          available_from: (settings?.available_from as string) ?? '',
          available_until: (settings?.available_until as string) ?? '',
        }));

        setPrerequisites(response.prerequisites ?? []);
        setCourseId(id);
        await reloadModules(id);
        await reloadAssessments(id);
        setStep(1);
      } catch (loadError) {
        setError(toMessage(loadError, 'Failed to load the course.'));
      } finally {
        setLoadingOptions(false);
      }
    },
    [session, reloadModules, reloadAssessments]
  );

  useEffect(() => {
    if (editingId && editingId > 0) {
      void loadCourse(editingId);
    }
  }, [editingId, loadCourse]);

  /* ── Step navigation ── */

  const goNext = useCallback(async () => {
    const found = validateStep(step);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setError('Check the highlighted fields before continuing.');
      return;
    }

    const result = await save(0, 'Progress saved.');
    if (!result.ok) return;

    const id = result.courseId;
    if (id) {
      if (step === 1) await reloadModules(id);
      if (step === 2) await reloadAssessments(id);
    }

    setStep((current) => Math.min(current + 1, BUILDER_STEPS.length));
  }, [validateStep, step, save, reloadModules, reloadAssessments]);

  const goBack = useCallback(() => setStep((current) => Math.max(current - 1, 1)), []);

  const goToStep = useCallback((target: number) => {
    setStep(Math.min(Math.max(target, 1), BUILDER_STEPS.length));
  }, []);

  /* ── Derived: the right-rail panels ── */

  const preview = useMemo(
    () => ({
      title: form.display_name.trim() || 'New Course Title',
      category: form.subject_category || '--',
      type: form.subject_type || '--',
      duration: form.duration.trim() || '--',
      language: form.language || '--',
      status: courseId ? 'Draft' : 'Unsaved',
      thumbnailName: form.thumbnail?.name ?? null,
    }),
    [form, courseId]
  );

  const checklist = useMemo(
    () => [
      { id: 1, label: 'Basic information', completed: Boolean(form.display_name.trim() && form.standard_id) },
      { id: 2, label: 'Add content modules', completed: modules.length > 0 },
      { id: 3, label: 'Add assessments', completed: assessments.length > 0 },
      { id: 4, label: 'Configure certification', completed: !form.issue_certificate || Boolean(form.certificate_template) },
      { id: 5, label: 'Publish settings', completed: Boolean(form.enrollment_rule && form.available_from) },
    ],
    [form, modules.length, assessments.length]
  );

  const contentCount = useMemo(
    () => modules.reduce((total, module) => total + (module.content?.length ?? 0), 0),
    [modules]
  );

  return {
    step,
    steps: BUILDER_STEPS,
    goNext,
    goBack,
    goToStep,

    form,
    setField,
    errors,

    courseId,
    prerequisites,
    setPrerequisites,
    courseOptions,

    modules,
    contentCount,
    addModule,
    renameModule,
    removeModule,
    addContent,
    removeContent,

    assessments,
    addAssessment,
    removeAssessment,

    openPaperId,
    openPaper,
    paperQuestions,
    questionsLoading,
    generateQuestions,
    addQuestion,
    updateQuestion,
    removeQuestion,

    categories,
    types,
    departments,
    jobRoles,
    languages,
    certificateTemplates,

    loadingOptions,
    loadingCourse,
    isEditing,
    saving,
    message,
    error,
    dismiss: () => {
      setMessage(null);
      setError(null);
    },

    saveDraft,
    publish,

    preview,
    checklist,
    formatDuration,
    loadCourse,
  };
}

export type CourseBuilderState = ReturnType<typeof useCourseBuilder>;
export type { CourseSettings };
