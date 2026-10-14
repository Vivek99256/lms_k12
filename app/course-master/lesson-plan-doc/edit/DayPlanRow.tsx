'use client';

/**
 * One day-wise planning row in the lesson-plan editor. Topic/class-time as `Input`s,
 * the eight free-text fields as plain `Textarea`s (the old day-wise form used plain
 * textareas, not TinyMCE, for these - see day_wise_lesson_plan.blade.php - so this
 * stays plain text too, no rich text), two `ActivityPicker`s for the self-study and
 * assessment activity lists, and a remove button. No reordering: the old screen only
 * ever supported add/remove.
 *
 * Operates on the same `LessonPlanDaySection` shape the read API already returns
 * (activities as `{id, title}`, not bare ids) so a day loaded from an existing plan
 * keeps its activity titles on screen instead of falling back to "#501" until the user
 * happens to re-search for it. `LessonPlanEditorForm` converts this down to the
 * id-array wire shape only at save time.
 */

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CurriculumSession } from '../../data/curriculum';
import type { LessonPlanDaySection } from '../../data/lessonPlanDocument';
import { ActivityPicker } from './ActivityPicker';

export interface DayPlanRowProps {
  day: LessonPlanDaySection;
  onChange: (next: LessonPlanDaySection) => void;
  onRemove: () => void;
  session: CurriculumSession;
  standardId?: string | number;
  subjectId?: string | number;
  chapterId?: string | number;
  topicId?: string | number;
  disabled?: boolean;
}

const TEXT_FIELDS: { key: keyof LessonPlanDaySection; label: string }[] = [
  { key: 'during_content', label: 'During content' },
  { key: 'learning_objective', label: 'Learning objective' },
  { key: 'learning_outcome', label: 'Learning outcome' },
  { key: 'pedagogical_process', label: 'Pedagogical process' },
  { key: 'resource', label: 'Resource' },
  { key: 'closure', label: 'Closure' },
  { key: 'assessment_qualifying', label: 'Assessment qualifying' },
];

export function DayPlanRow({
  day,
  onChange,
  onRemove,
  session,
  standardId,
  subjectId,
  chapterId,
  topicId,
  disabled,
}: DayPlanRowProps) {
  const patch = (change: Partial<LessonPlanDaySection>) => onChange({ ...day, ...change });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[14px] font-semibold text-slate-900">Day {day.day}</h4>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove} className="text-slate-500 hover:text-rose-600">
          <Trash2 size={14} />
          Remove day
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <Label className="text-[13px] font-semibold text-slate-700">Topic name</Label>
          <Input
            value={day.topic_name ?? ''}
            disabled={disabled}
            onChange={(event) => patch({ topic_name: event.target.value })}
            className="h-10 rounded-lg"
          />
        </label>
        <label className="block space-y-1.5">
          <Label className="text-[13px] font-semibold text-slate-700">Class time</Label>
          <Input
            value={day.class_time ?? ''}
            disabled={disabled}
            placeholder="e.g. 40 min"
            onChange={(event) => patch({ class_time: event.target.value })}
            className="h-10 rounded-lg"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map(({ key, label }) => (
          <label key={key} className="block space-y-1.5">
            <Label className="text-[13px] font-semibold text-slate-700">{label}</Label>
            <Textarea
              rows={3}
              disabled={disabled}
              value={(day[key] as string | null) ?? ''}
              onChange={(event) => patch({ [key]: event.target.value } as Partial<LessonPlanDaySection>)}
              className="rounded-lg"
            />
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold text-slate-700">Self-study & homework</Label>
          <Textarea
            rows={3}
            disabled={disabled}
            value={day.self_study_homework ?? ''}
            onChange={(event) => patch({ self_study_homework: event.target.value })}
            className="rounded-lg"
          />
          <ActivityPicker
            kind="content"
            session={session}
            standardId={standardId}
            subjectId={subjectId}
            chapterId={chapterId}
            topicId={topicId}
            disabled={disabled}
            placeholder="Attach content…"
            value={day.self_study_activity}
            onChange={(next) => patch({ self_study_activity: next })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold text-slate-700">Assessment</Label>
          <Textarea
            rows={3}
            disabled={disabled}
            value={day.assessment ?? ''}
            onChange={(event) => patch({ assessment: event.target.value })}
            className="rounded-lg"
          />
          <ActivityPicker
            kind="question"
            session={session}
            standardId={standardId}
            subjectId={subjectId}
            disabled={disabled}
            placeholder="Attach question paper…"
            value={day.assessment_activity}
            onChange={(next) => patch({ assessment_activity: next })}
          />
        </div>
      </div>
    </div>
  );
}
