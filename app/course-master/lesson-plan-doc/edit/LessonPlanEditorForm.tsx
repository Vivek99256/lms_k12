'use client';

/**
 * The Lesson Plan document editor: create or edit every field the old
 * `/lms/lms_lessonplan/create` Blade screen covered, redesigned as a five-section
 * form (Summary / Teaching / Learning / Day Planning / Map & Alignment) instead of one
 * long page, color-matched to the read-only document panel via its CATEGORY_META/
 * DAY_META. One save posts the whole document at once, matching the old screen's
 * single-submit-everything behaviour (no autosave, no per-section save).
 *
 * Form state intentionally mirrors the READ shapes (LessonPlanDocument/
 * LessonPlanDaySection/LessonPlanActivity, with activities as `{id, title}`) rather
 * than the write wire format (id arrays) - so a plan loaded from the server keeps its
 * activity titles on screen. `inputFromForm` converts down to the wire shape only at
 * save time, the same converter-function pattern PrayogshalaEditorDialog uses.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CurriculumSession } from '../../data/curriculum';
import type { LessonPlanActivity, LessonPlanDaySection, LessonPlanDocument } from '../../data/lessonPlanDocument';
import {
  LessonPlanDocumentApiError,
  saveLessonPlanDocument,
  type LessonPlanDocumentInput,
  type LessonPlanMappingInput,
  type LessonPlanMappingOptions,
  type LessonPlanTopicOption,
} from '../../data/lessonPlanDocumentWrite';
import { CATEGORY_META, DAY_META, type Category } from '../LessonPlanDocumentPanel';
import { ActivityPicker } from './ActivityPicker';
import { DayPlanRow } from './DayPlanRow';
import { MappingRow } from './MappingRow';
import { RichTextField } from './RichTextField';

type Section = Category | 'days';

interface LessonPlanFormState {
  id: number | null;
  standard_id: string;
  subject_id: string;
  chapter_id: string;
  topic_id: string;
  summary: {
    number_of_periods: string;
    teaching_time: string;
    assessment_time: string;
    learning_time: string;
    assessment_qualifying: string;
    mapping: LessonPlanMappingInput[];
  };
  teaching: {
    focus_point: string;
    pedagogical_process: string;
    resource: string;
    classroom_presentation: string;
    classroom_diversity: string;
    classroom_activity: LessonPlanActivity[];
  };
  learning: {
    learning_objective: string;
    learning_knowledge: string;
    learning_skill: string;
    prerequisite: string;
    self_study_homework: string;
    self_study_activity: LessonPlanActivity[];
    assessment: string;
    assessment_activity: LessonPlanActivity[];
  };
  days: LessonPlanDaySection[];
  map_and_alignment: {
    hard_word: string;
    tag_metatag: string;
    value_integration: string;
    global_connection: string;
    sel: string;
    stem: string;
    vocational_training: string;
    simulation: string;
    games: string;
    activities: string;
    real_life_application: string;
  };
}

function blankDay(day: number): LessonPlanDaySection {
  return {
    day,
    topic_name: '',
    class_time: '',
    during_content: '',
    assessment_qualifying: '',
    learning_objective: '',
    learning_outcome: '',
    pedagogical_process: '',
    resource: '',
    closure: '',
    self_study_homework: '',
    self_study_activity: [],
    assessment: '',
    assessment_activity: [],
  };
}

function formFromDocument(
  plan: LessonPlanDocument | null,
  ctx: { standardId: string; subjectId: string; chapterId: string }
): LessonPlanFormState {
  if (!plan) {
    return {
      id: null,
      standard_id: ctx.standardId,
      subject_id: ctx.subjectId,
      chapter_id: ctx.chapterId,
      topic_id: '',
      summary: {
        number_of_periods: '',
        teaching_time: '',
        assessment_time: '',
        learning_time: '',
        assessment_qualifying: '',
        mapping: [],
      },
      teaching: {
        focus_point: '',
        pedagogical_process: '',
        resource: '',
        classroom_presentation: '',
        classroom_diversity: '',
        classroom_activity: [],
      },
      learning: {
        learning_objective: '',
        learning_knowledge: '',
        learning_skill: '',
        prerequisite: '',
        self_study_homework: '',
        self_study_activity: [],
        assessment: '',
        assessment_activity: [],
      },
      days: [],
      map_and_alignment: {
        hard_word: '',
        tag_metatag: '',
        value_integration: '',
        global_connection: '',
        sel: '',
        stem: '',
        vocational_training: '',
        simulation: '',
        games: '',
        activities: '',
        real_life_application: '',
      },
    };
  }

  return {
    id: plan.id,
    standard_id: String(plan.standard_id ?? ctx.standardId),
    subject_id: String(plan.subject_id ?? ctx.subjectId),
    chapter_id: String(plan.chapter_id ?? ctx.chapterId),
    topic_id: plan.topic_id ? String(plan.topic_id) : '',
    summary: {
      number_of_periods: plan.summary.number_of_periods != null ? String(plan.summary.number_of_periods) : '',
      teaching_time: plan.summary.teaching_time ?? '',
      assessment_time: plan.summary.assessment_time ?? '',
      learning_time: plan.summary.learning_time ?? '',
      assessment_qualifying: plan.summary.assessment_qualifying ?? '',
      mapping: plan.summary.mapping
        .filter((entry) => entry.type_id && entry.value_id)
        .map((entry) => ({ type_id: entry.type_id as number, value_id: entry.value_id as number })),
    },
    teaching: {
      focus_point: plan.teaching.focus_point ?? '',
      pedagogical_process: plan.teaching.pedagogical_process ?? '',
      resource: plan.teaching.resource ?? '',
      classroom_presentation: plan.teaching.classroom_presentation ?? '',
      classroom_diversity: plan.teaching.classroom_diversity ?? '',
      classroom_activity: plan.teaching.classroom_activity,
    },
    learning: {
      learning_objective: plan.learning.learning_objective ?? '',
      learning_knowledge: plan.learning.learning_knowledge ?? '',
      learning_skill: plan.learning.learning_skill ?? '',
      prerequisite: plan.learning.prerequisite ?? '',
      self_study_homework: plan.learning.self_study_homework ?? '',
      self_study_activity: plan.learning.self_study_activity,
      assessment: plan.learning.assessment ?? '',
      assessment_activity: plan.learning.assessment_activity,
    },
    days: plan.days,
    map_and_alignment: {
      hard_word: plan.map_and_alignment.hard_word ?? '',
      tag_metatag: plan.map_and_alignment.tag_metatag ?? '',
      value_integration: plan.map_and_alignment.value_integration ?? '',
      global_connection: plan.map_and_alignment.global_connection ?? '',
      sel: plan.map_and_alignment.sel ?? '',
      stem: plan.map_and_alignment.stem ?? '',
      vocational_training: plan.map_and_alignment.vocational_training ?? '',
      simulation: plan.map_and_alignment.simulation ?? '',
      games: plan.map_and_alignment.games ?? '',
      activities: plan.map_and_alignment.activities ?? '',
      real_life_application: plan.map_and_alignment.real_life_application ?? '',
    },
  };
}

function inputFromForm(form: LessonPlanFormState, session: CurriculumSession): LessonPlanDocumentInput {
  const toDayInput = (day: LessonPlanDaySection) => ({
    day: day.day,
    topic_name: day.topic_name || null,
    class_time: day.class_time || null,
    during_content: day.during_content || null,
    assessment_qualifying: day.assessment_qualifying || null,
    learning_objective: day.learning_objective || null,
    learning_outcome: day.learning_outcome || null,
    pedagogical_process: day.pedagogical_process || null,
    resource: day.resource || null,
    closure: day.closure || null,
    self_study_homework: day.self_study_homework || null,
    self_study_activity_ids: day.self_study_activity.map((item) => item.id),
    assessment: day.assessment || null,
    assessment_activity_ids: day.assessment_activity.map((item) => item.id),
  });

  return {
    id: form.id,
    sub_institute_id: session.subInstituteId,
    syear: session.academicYearId,
    standard_id: form.standard_id,
    subject_id: form.subject_id,
    chapter_id: form.chapter_id,
    topic_id: form.topic_id ? Number(form.topic_id) : null,
    summary: {
      number_of_periods: form.summary.number_of_periods ? Number(form.summary.number_of_periods) : null,
      teaching_time: form.summary.teaching_time || null,
      assessment_time: form.summary.assessment_time || null,
      learning_time: form.summary.learning_time || null,
      assessment_qualifying: form.summary.assessment_qualifying || null,
      mapping: form.summary.mapping.filter((entry) => entry.type_id && entry.value_id),
    },
    teaching: {
      focus_point: form.teaching.focus_point,
      pedagogical_process: form.teaching.pedagogical_process,
      resource: form.teaching.resource,
      classroom_presentation: form.teaching.classroom_presentation,
      classroom_diversity: form.teaching.classroom_diversity,
      classroom_activity_ids: form.teaching.classroom_activity.map((item) => item.id),
    },
    learning: {
      learning_objective: form.learning.learning_objective || null,
      learning_knowledge: form.learning.learning_knowledge || null,
      learning_skill: form.learning.learning_skill || null,
      prerequisite: form.learning.prerequisite || null,
      self_study_homework: form.learning.self_study_homework || null,
      self_study_activity_ids: form.learning.self_study_activity.map((item) => item.id),
      assessment: form.learning.assessment || null,
      assessment_activity_ids: form.learning.assessment_activity.map((item) => item.id),
    },
    days: form.days.map(toDayInput),
    map_and_alignment: { ...form.map_and_alignment },
  };
}

type RequiredTeachingField = Exclude<keyof LessonPlanFormState['teaching'], 'classroom_activity'>;

const REQUIRED_TEACHING_FIELDS: { key: RequiredTeachingField; label: string }[] = [
  { key: 'focus_point', label: 'Focus point' },
  { key: 'pedagogical_process', label: 'Pedagogical process' },
  { key: 'resource', label: 'Resource' },
  { key: 'classroom_presentation', label: 'Classroom presentation' },
  { key: 'classroom_diversity', label: 'Classroom diversity' },
];

function validate(form: LessonPlanFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  REQUIRED_TEACHING_FIELDS.forEach(({ key, label }) => {
    if (!form.teaching[key].trim()) errors[key] = `${label} is required.`;
  });
  return errors;
}

const MAP_ALIGNMENT_FIELDS: { key: keyof LessonPlanFormState['map_and_alignment']; label: string }[] = [
  { key: 'hard_word', label: 'Hard word with image' },
  { key: 'tag_metatag', label: 'Tag & metatag' },
  { key: 'value_integration', label: 'Value integrations' },
  { key: 'global_connection', label: 'Global connection' },
  { key: 'sel', label: 'SEL (Social & emotional learning)' },
  { key: 'stem', label: 'STEM' },
  { key: 'vocational_training', label: 'Vocational training' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'games', label: 'Games' },
  { key: 'activities', label: 'Activities' },
  { key: 'real_life_application', label: 'Real-life application' },
];

const SECTIONS: { key: Section; label: string; accent: string; soft: string; border: string }[] = [
  { key: 'summary', ...CATEGORY_META.summary },
  { key: 'teaching', ...CATEGORY_META.teaching },
  { key: 'learning', ...CATEGORY_META.learning },
  { key: 'days', label: DAY_META.label, accent: DAY_META.accent, soft: DAY_META.soft, border: DAY_META.border },
  { key: 'map', ...CATEGORY_META.map },
];

export interface LessonPlanEditorFormProps {
  session: CurriculumSession;
  subjectId: string;
  standardId: string;
  chapterId: string;
  subjectName: string;
  standardName: string;
  initialDocument: LessonPlanDocument | null;
  topics: LessonPlanTopicOption[];
  mappingOptions: LessonPlanMappingOptions;
  onSaved: () => void;
  onCancel: () => void;
}

export function LessonPlanEditorForm({
  session,
  subjectId,
  standardId,
  chapterId,
  subjectName,
  standardName,
  initialDocument,
  topics,
  mappingOptions,
  onSaved,
  onCancel,
}: LessonPlanEditorFormProps) {
  const [form, setForm] = useState<LessonPlanFormState>(() =>
    formFromDocument(initialDocument, { standardId, subjectId, chapterId })
  );
  const [activeSection, setActiveSection] = useState<Section>('summary');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const patchSummary = (change: Partial<LessonPlanFormState['summary']>) =>
    setForm((current) => ({ ...current, summary: { ...current.summary, ...change } }));
  const patchTeaching = (change: Partial<LessonPlanFormState['teaching']>) =>
    setForm((current) => ({ ...current, teaching: { ...current.teaching, ...change } }));
  const patchLearning = (change: Partial<LessonPlanFormState['learning']>) =>
    setForm((current) => ({ ...current, learning: { ...current.learning, ...change } }));
  const patchMap = (change: Partial<LessonPlanFormState['map_and_alignment']>) =>
    setForm((current) => ({ ...current, map_and_alignment: { ...current.map_and_alignment, ...change } }));

  const addMapping = () =>
    setForm((current) => ({ ...current, summary: { ...current.summary, mapping: [...current.summary.mapping, { type_id: 0, value_id: 0 }] } }));
  const updateMapping = (index: number, next: LessonPlanMappingInput) =>
    setForm((current) => ({
      ...current,
      summary: { ...current.summary, mapping: current.summary.mapping.map((entry, i) => (i === index ? next : entry)) },
    }));
  const removeMapping = (index: number) =>
    setForm((current) => ({ ...current, summary: { ...current.summary, mapping: current.summary.mapping.filter((_, i) => i !== index) } }));

  const addDay = () =>
    setForm((current) => {
      const nextDayNumber = current.days.length ? Math.max(...current.days.map((day) => day.day)) + 1 : 1;
      return { ...current, days: [...current.days, blankDay(nextDayNumber)] };
    });
  const updateDay = (index: number, next: LessonPlanDaySection) =>
    setForm((current) => ({ ...current, days: current.days.map((day, i) => (i === index ? next : day)) }));
  const removeDay = (index: number) =>
    setForm((current) => ({ ...current, days: current.days.filter((_, i) => i !== index) }));

  const save = async () => {
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setActiveSection('teaching');
      setFormError('Please fill in the required Teaching fields before saving.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await saveLessonPlanDocument(session, inputFromForm(form, session));
      onSaved();
    } catch (caught) {
      setFormError(caught instanceof LessonPlanDocumentApiError ? caught.message : 'Failed to save the lesson plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
          <span className="font-medium text-slate-700">{subjectName}</span>
          {standardName ? <span>· Class {standardName}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => {
            const active = activeSection === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className="rounded-full border px-4 py-2 text-[13px] font-semibold transition"
                style={
                  active
                    ? { backgroundColor: section.soft, borderColor: section.accent, color: section.accent }
                    : { backgroundColor: '#FAFBFC', borderColor: '#E7EAF0', color: '#64748B' }
                }
              >
                {section.label}
                {section.key === 'days' ? ` · ${form.days.length}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {formError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        {activeSection === 'summary' ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <Label className="text-[13px] font-semibold text-slate-700">Topic</Label>
                <Select
                  value={form.topic_id || undefined}
                  onValueChange={(value) => setForm((current) => ({ ...current, topic_id: value ?? '' }))}
                >
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Whole chapter">
                      {() => topics.find((topic) => String(topic.id) === form.topic_id)?.name ?? 'Whole chapter'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={String(topic.id)}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5">
                <Label className="text-[13px] font-semibold text-slate-700">Number of periods</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.summary.number_of_periods}
                  onChange={(event) => patchSummary({ number_of_periods: event.target.value })}
                  className="h-10 rounded-lg"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <Label className="text-[13px] font-semibold text-slate-700">Teaching time</Label>
                <Input value={form.summary.teaching_time} onChange={(event) => patchSummary({ teaching_time: event.target.value })} className="h-10 rounded-lg" />
              </label>
              <label className="block space-y-1.5">
                <Label className="text-[13px] font-semibold text-slate-700">Assessment time</Label>
                <Input value={form.summary.assessment_time} onChange={(event) => patchSummary({ assessment_time: event.target.value })} className="h-10 rounded-lg" />
              </label>
              <label className="block space-y-1.5">
                <Label className="text-[13px] font-semibold text-slate-700">Learning time</Label>
                <Input value={form.summary.learning_time} onChange={(event) => patchSummary({ learning_time: event.target.value })} className="h-10 rounded-lg" />
              </label>
            </div>

            <RichTextField
              label="Assessment qualifying"
              value={form.summary.assessment_qualifying}
              onChange={(html) => patchSummary({ assessment_qualifying: html })}
              ai={{ fieldType: 'description', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-[13px] font-semibold text-slate-700">Mapping</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addMapping}>
                  Add mapping
                </Button>
              </div>
              <div className="space-y-2">
                {form.summary.mapping.map((entry, index) => (
                  <MappingRow
                    key={index}
                    mapping={entry}
                    options={mappingOptions}
                    onChange={(next) => updateMapping(index, next)}
                    onRemove={() => removeMapping(index)}
                  />
                ))}
                {form.summary.mapping.length === 0 ? <p className="text-sm italic text-slate-400">No mapping values set.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === 'teaching' ? (
          <div className="space-y-5">
            <RichTextField
              label="Focus point"
              required
              value={form.teaching.focus_point}
              error={fieldErrors.focus_point}
              onChange={(html) => patchTeaching({ focus_point: html })}
              ai={{ fieldType: 'lesson_content', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <RichTextField
              label="Pedagogical process"
              required
              value={form.teaching.pedagogical_process}
              error={fieldErrors.pedagogical_process}
              onChange={(html) => patchTeaching({ pedagogical_process: html })}
              ai={{ fieldType: 'lesson_content', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <RichTextField
              label="Resource"
              required
              value={form.teaching.resource}
              error={fieldErrors.resource}
              onChange={(html) => patchTeaching({ resource: html })}
              ai={{ fieldType: 'lesson_content', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <RichTextField
              label="Classroom presentation"
              required
              value={form.teaching.classroom_presentation}
              error={fieldErrors.classroom_presentation}
              onChange={(html) => patchTeaching({ classroom_presentation: html })}
              ai={{ fieldType: 'lesson_content', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-slate-700">Classroom activity</Label>
              <ActivityPicker
                kind="content"
                session={session}
                standardId={standardId}
                subjectId={subjectId}
                chapterId={chapterId}
                topicId={form.topic_id || undefined}
                value={form.teaching.classroom_activity}
                onChange={(next) => patchTeaching({ classroom_activity: next })}
                placeholder="Attach content…"
              />
            </div>
            <RichTextField
              label="Classroom diversity"
              required
              value={form.teaching.classroom_diversity}
              error={fieldErrors.classroom_diversity}
              onChange={(html) => patchTeaching({ classroom_diversity: html })}
              ai={{ fieldType: 'instructions', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
          </div>
        ) : null}

        {activeSection === 'learning' ? (
          <div className="space-y-5">
            <RichTextField
              label="Prerequisite lessons"
              value={form.learning.prerequisite}
              onChange={(html) => patchLearning({ prerequisite: html })}
              ai={{ fieldType: 'description', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <RichTextField
              label="Learning objective"
              value={form.learning.learning_objective}
              onChange={(html) => patchLearning({ learning_objective: html })}
              ai={{ fieldType: 'learning_objective', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <RichTextField
              label="Learning outcome: knowledge"
              value={form.learning.learning_knowledge}
              onChange={(html) => patchLearning({ learning_knowledge: html })}
              ai={{ fieldType: 'learning_objective', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <RichTextField
              label="Learning outcome: skill"
              value={form.learning.learning_skill}
              onChange={(html) => patchLearning({ learning_skill: html })}
              ai={{ fieldType: 'learning_objective', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <RichTextField
              label="Self-study & homework"
              value={form.learning.self_study_homework}
              onChange={(html) => patchLearning({ self_study_homework: html })}
              ai={{ fieldType: 'instructions', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-slate-700">Self-study activity</Label>
              <ActivityPicker
                kind="content"
                session={session}
                standardId={standardId}
                subjectId={subjectId}
                chapterId={chapterId}
                topicId={form.topic_id || undefined}
                value={form.learning.self_study_activity}
                onChange={(next) => patchLearning({ self_study_activity: next })}
                placeholder="Attach content…"
              />
            </div>
            <RichTextField
              label="Assessment"
              value={form.learning.assessment}
              onChange={(html) => patchLearning({ assessment: html })}
              ai={{ fieldType: 'instructions', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
            />
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-slate-700">Assessment activity</Label>
              <ActivityPicker
                kind="question"
                session={session}
                standardId={standardId}
                subjectId={subjectId}
                value={form.learning.assessment_activity}
                onChange={(next) => patchLearning({ assessment_activity: next })}
                placeholder="Attach question paper…"
              />
            </div>
          </div>
        ) : null}

        {activeSection === 'days' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-slate-900">Day Planning</h3>
              <Button type="button" variant="outline" size="sm" onClick={addDay}>
                Add day
              </Button>
            </div>
            {form.days.length === 0 ? (
              <p className="text-sm italic text-slate-400">No days added yet.</p>
            ) : (
              <div className="space-y-3">
                {form.days.map((day, index) => (
                  <DayPlanRow
                    key={index}
                    day={day}
                    session={session}
                    standardId={standardId}
                    subjectId={subjectId}
                    chapterId={chapterId}
                    topicId={form.topic_id || undefined}
                    onChange={(next) => updateDay(index, next)}
                    onRemove={() => removeDay(index)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {activeSection === 'map' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {MAP_ALIGNMENT_FIELDS.map(({ key, label }) => (
              <RichTextField
                key={key}
                label={label}
                value={form.map_and_alignment[key]}
                onChange={(html) => patchMap({ [key]: html } as Partial<LessonPlanFormState['map_and_alignment']>)}
                ai={{ fieldType: 'generic', entityType: 'lesson_plan_document', grade: standardName, subject: subjectName }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel} className="h-11 rounded-xl px-5">
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saving}
          onClick={save}
          className={cn('h-11 rounded-xl bg-[#5648E8] px-6 font-semibold text-white hover:bg-[#4738c9]')}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save lesson plan'}
        </Button>
      </div>
    </div>
  );
}
