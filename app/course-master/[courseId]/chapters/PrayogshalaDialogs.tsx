'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createPrayogshalaActivity,
  fetchPrayogshalaForChapter,
  updatePrayogshalaActivity,
  type PrayogshalaActivity,
  type PrayogshalaActivityInput,
  type PrayogshalaChapterResponse,
  type PrayogshalaResource,
  type PrayogshalaResourceType,
} from '../../data/prayogshala';

/**
 * Prayogshala's detail view and editor.
 *
 * Prayogshala activities are ordinary Classroom Resource content items - the backend
 * merges them into the chapter content list, so they are listed, searched, counted and
 * carded by the same code as every other type. What a card cannot show is the whole
 * activity (objective, materials, procedure, safety...), so opening one lands here. The
 * activity arrives with the list, so viewing needs no further request; only the editor
 * asks the server for the chapter's topics and the activity-type vocabulary.
 */

export const PRAYOGSHALA_EMPTY_MESSAGE = 'No Prayogshala activity added for this chapter yet.';

const RESOURCE_TYPE_OPTIONS: { value: PrayogshalaResourceType; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'pdf', label: 'PDF' },
  { value: 'link', label: 'Link' },
];

const SELECT_CLASS =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-[#4f46e5]';

type FormState = {
  title: string;
  activity_type: string;
  topic_id: string;
  description: string;
  objective: string;
  materials_required: string;
  procedure_steps: string;
  observation: string;
  result: string;
  safety_instructions: string;
  teacher_instructions: string;
  student_instructions: string;
  estimated_minutes: string;
  resources: PrayogshalaResource[];
  published: boolean;
  status: 'draft' | 'review' | 'published';
};

const joinLines = (lines: string[]) => lines.join('\n');
const splitLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function emptyForm(): FormState {
  return {
    title: '',
    activity_type: '',
    topic_id: '',
    description: '',
    objective: '',
    materials_required: '',
    procedure_steps: '',
    observation: '',
    result: '',
    safety_instructions: '',
    teacher_instructions: '',
    student_instructions: '',
    estimated_minutes: '',
    resources: [],
    published: true,
    status: 'published',
  };
}

function formFromActivity(activity: PrayogshalaActivity): FormState {
  return {
    title: activity.title,
    activity_type: activity.activity_type,
    topic_id: activity.topic_id != null ? String(activity.topic_id) : '',
    description: activity.description ?? '',
    objective: activity.objective ?? '',
    materials_required: joinLines(activity.materials_required),
    procedure_steps: joinLines(activity.procedure_steps),
    observation: activity.observation ?? '',
    result: activity.result ?? '',
    safety_instructions: activity.safety_instructions ?? '',
    teacher_instructions: activity.teacher_instructions ?? '',
    student_instructions: activity.student_instructions ?? '',
    estimated_minutes: activity.estimated_minutes != null ? String(activity.estimated_minutes) : '',
    resources: activity.resources.map((resource) => ({ ...resource })),
    published: activity.show_hide === 1,
    status: activity.status,
  };
}

function inputFromForm(form: FormState): PrayogshalaActivityInput {
  const minutes = Number(form.estimated_minutes);
  return {
    title: form.title.trim(),
    ...(form.activity_type ? { activity_type: form.activity_type } : {}),
    // null clears the topic on edit; the server treats an empty id as "chapter-wide".
    topic_id: form.topic_id ? Number(form.topic_id) : null,
    description: form.description,
    objective: form.objective,
    materials_required: splitLines(form.materials_required),
    procedure_steps: splitLines(form.procedure_steps),
    observation: form.observation,
    result: form.result,
    safety_instructions: form.safety_instructions,
    teacher_instructions: form.teacher_instructions,
    student_instructions: form.student_instructions,
    estimated_minutes: form.estimated_minutes.trim() && Number.isFinite(minutes) ? minutes : null,
    resources: form.resources
      .filter((resource) => resource.url.trim())
      .map((resource) => ({ ...resource, title: resource.title.trim(), url: resource.url.trim() })),
    show_hide: form.published,
    status: form.status,
  };
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</h4>
      <div className="text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}

const Prose = ({ text }: { text: string }) => <p className="whitespace-pre-line">{text}</p>;

// --------------------------------------------------------------------------- detail

interface DetailProps {
  activity: PrayogshalaActivity | null;
  /** Advisory: shows Edit / Remove. The server decides whether the action is allowed. */
  canManage: boolean;
  onClose: () => void;
  onEdit: (activity: PrayogshalaActivity) => void;
  onRemove: (activity: PrayogshalaActivity) => void;
}

export function PrayogshalaDetailDialog({ activity, canManage, onClose, onEdit, onRemove }: DetailProps) {
  return (
    <Dialog open={activity !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-2xl bg-white">
        {activity ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-100 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700">
                  <FlaskConical size={12} />
                  {activity.activity_type_label}
                </span>
                {activity.topic_name ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    Topic: {activity.topic_name}
                  </span>
                ) : null}
                {activity.concept_name ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    Concept: {activity.concept_name}
                  </span>
                ) : null}
                {activity.estimated_minutes ? (
                  <span className="text-xs text-slate-500">{activity.estimated_minutes} min</span>
                ) : null}
                {activity.status !== 'published' ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    {activity.status === 'review' ? 'Pending review' : 'Draft'}
                  </span>
                ) : null}
                {activity.show_hide !== 1 ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    Hidden from students
                  </span>
                ) : null}
              </div>
              <DialogTitle className="pr-6 text-xl font-semibold text-slate-950">{activity.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {activity.description ? <Prose text={activity.description} /> : null}
              {activity.objective ? (
                <Section label="Objective">
                  <Prose text={activity.objective} />
                </Section>
              ) : null}
              {activity.materials_required.length ? (
                <Section label="Materials required">
                  <ul className="list-disc space-y-1 pl-5">
                    {activity.materials_required.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}
              {activity.safety_instructions ? (
                <Section label="Safety instructions">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    <Prose text={activity.safety_instructions} />
                  </div>
                </Section>
              ) : null}
              {activity.procedure_steps.length ? (
                <Section label="Procedure">
                  <ol className="list-decimal space-y-1 pl-5">
                    {activity.procedure_steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </Section>
              ) : null}
              {activity.observation ? (
                <Section label="Observation">
                  <Prose text={activity.observation} />
                </Section>
              ) : null}
              {activity.result ? (
                <Section label="Result">
                  <Prose text={activity.result} />
                </Section>
              ) : null}
              {activity.student_instructions ? (
                <Section label="Student instructions">
                  <Prose text={activity.student_instructions} />
                </Section>
              ) : null}
              {activity.teacher_instructions ? (
                <Section label="Teacher instructions">
                  <Prose text={activity.teacher_instructions} />
                </Section>
              ) : null}
              {activity.resources.length ? (
                <Section label="Resources">
                  <ul className="space-y-1.5">
                    {activity.resources.map((resource, index) => (
                      <li key={index}>
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 font-medium text-[#4f46e5] hover:underline"
                        >
                          <ExternalLink size={14} />
                          {resource.title || resource.url}
                          <span className="text-xs uppercase text-slate-400">{resource.type}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </div>

            {canManage && activity.editable ? (
              <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
                <Button type="button" variant="ghost" onClick={() => onRemove(activity)} className="rounded-full text-rose-600 hover:bg-rose-50">
                  <Trash2 size={14} className="mr-2" />
                  Remove
                </Button>
                <Button type="button" variant="ghost" onClick={() => onEdit(activity)} className="rounded-full bg-slate-100 hover:bg-slate-200">
                  <Pencil size={14} className="mr-2" />
                  Edit
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------------- editor

interface EditorProps {
  chapterId: number;
  /** null = create a new activity for the chapter. */
  activity: PrayogshalaActivity | null;
  onClose: () => void;
  /** Called after a successful save so the caller can reload the content list. */
  onSaved: () => void;
}

export function PrayogshalaEditorDialog({ chapterId, activity, onClose, onSaved }: EditorProps) {
  const [context, setContext] = useState<PrayogshalaChapterResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<FormState>(() => (activity ? formFromActivity(activity) : emptyForm()));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // The chapter's topics and the activity-type vocabulary come from the server.
  useEffect(() => {
    let cancelled = false;
    fetchPrayogshalaForChapter(chapterId)
      .then((response) => {
        if (cancelled) return;
        setContext(response);
        setForm((current) =>
          current.activity_type || !response.activity_types[0]
            ? current
            : { ...current, activity_type: response.activity_types[0].value }
        );
        if (!response.can_manage) setLoadError('Your role cannot add or edit Prayogshala activities.');
      })
      .catch((caught: unknown) => {
        if (!cancelled) setLoadError(caught instanceof Error ? caught.message : 'Failed to load the editor.');
      });
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const patch = (change: Partial<FormState>) => setForm((current) => ({ ...current, ...change }));

  const save = async () => {
    if (!form.title.trim()) {
      setFormError('Please give the activity a title.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const input = inputFromForm(form);
      if (activity) await updatePrayogshalaActivity(activity.id, input);
      else await createPrayogshalaActivity(chapterId, input);
      onSaved();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Failed to save the activity.');
    } finally {
      setSaving(false);
    }
  };

  const types = context?.activity_types ?? [];
  const topics = context?.topics ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-950">
            {activity ? 'Edit Prayogshala activity' : 'Add Prayogshala activity'}
          </DialogTitle>
          {context ? (
            <p className="text-sm text-slate-500">
              {[
                context.chapter.subject_name,
                context.chapter.standard_name ? `Standard ${context.chapter.standard_name}` : null,
                context.chapter.chapter_name,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </DialogHeader>

        {loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</div>
        ) : null}

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <label className="block text-sm font-medium text-slate-700">
              Title
              <Input value={form.title} onChange={(event) => patch({ title: event.target.value })} maxLength={250} className="mt-1.5 h-11 rounded-xl" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Type
              <select value={form.activity_type} onChange={(event) => patch({ activity_type: event.target.value })} className={`${SELECT_CLASS} mt-1.5`}>
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Topic
            <select value={form.topic_id} onChange={(event) => patch({ topic_id: event.target.value })} className={`${SELECT_CLASS} mt-1.5`}>
              <option value="">Whole chapter</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>

          {(
            [
              ['description', 'Description', 2],
              ['objective', 'Objective', 2],
              ['materials_required', 'Materials required (one per line)', 3],
              ['safety_instructions', 'Safety instructions', 2],
              ['procedure_steps', 'Procedure (one step per line)', 4],
              ['observation', 'Observation', 2],
              ['result', 'Result', 2],
              ['student_instructions', 'Student instructions', 2],
              ['teacher_instructions', 'Teacher instructions', 2],
            ] as const
          ).map(([key, label, rows]) => (
            <label key={key} className="block text-sm font-medium text-slate-700">
              {label}
              <Textarea value={form[key]} onChange={(event) => patch({ [key]: event.target.value } as Partial<FormState>)} rows={rows} className="mt-1.5 rounded-xl" />
            </label>
          ))}

          <label className="block text-sm font-medium text-slate-700 sm:max-w-[200px]">
            Estimated minutes
            <Input type="number" min={1} max={1440} value={form.estimated_minutes} onChange={(event) => patch({ estimated_minutes: event.target.value })} className="mt-1.5 h-11 rounded-xl" />
          </label>

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Images, videos and PDFs (links)</p>
            <div className="space-y-2">
              {form.resources.map((resource, index) => {
                const update = (change: Partial<PrayogshalaResource>) => {
                  const next = form.resources.slice();
                  next[index] = { ...resource, ...change };
                  patch({ resources: next });
                };
                return (
                  <div key={index} className="grid gap-2 sm:grid-cols-[110px_1fr_1.4fr_auto]">
                    <select value={resource.type} onChange={(event) => update({ type: event.target.value as PrayogshalaResourceType })} className={SELECT_CLASS} aria-label="Resource type">
                      {RESOURCE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Input value={resource.title} placeholder="Title" aria-label="Resource title" onChange={(event) => update({ title: event.target.value })} className="h-11 rounded-xl" />
                    <Input value={resource.url} placeholder="https://…" aria-label="Resource URL" onChange={(event) => update({ url: event.target.value })} className="h-11 rounded-xl" />
                    <Button type="button" variant="ghost" aria-label="Remove resource" onClick={() => patch({ resources: form.resources.filter((_, i) => i !== index) })} className="h-11 rounded-xl text-slate-500">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="ghost" onClick={() => patch({ resources: [...form.resources, { type: 'link', title: '', url: '' }] })} className="mt-2 h-9 rounded-full bg-slate-100 px-4 text-sm">
              <Plus size={14} className="mr-2" />
              Add resource
            </Button>
          </div>

          <label className="block text-sm font-medium text-slate-700 sm:max-w-[260px]">
            Status
            <select value={form.status} onChange={(event) => patch({ status: event.target.value as FormState['status'] })} className={`${SELECT_CLASS} mt-1.5`}>
              <option value="draft">Draft (teachers only)</option>
              <option value="review">Pending review (teachers only)</option>
              <option value="published">Published (students can see it)</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.published} onChange={(event) => patch({ published: event.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            Visible to students
          </label>

          {formError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div> : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose} className="rounded-full">
              Cancel
            </Button>
            <Button type="button" disabled={saving || context?.can_manage === false} onClick={save} className="rounded-full bg-[#4f46e5] px-5 font-semibold text-white hover:bg-[#4338ca]">
              {saving ? 'Saving…' : 'Save activity'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
