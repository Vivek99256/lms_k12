'use client';

/**
 * WHO THIS COURSE IS FOR — chosen while the course is being made.
 * Ported from G2G's `components/domain/lms/course-builder/
 * course-audience-panel.tsx` (`CourseAudiencePanel`). Adapted to
 * `buildSessionContext()` / `lmsCourseBuilderService` (this package's own
 * port); `Select`/`Button` come from `@/components/ui/g2g/*`, matching the
 * rest of this screen.
 */

import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/g2g/button';
import { Select } from '@/components/ui/g2g/select';
import { cn } from '@/lib/utils';
import { buildSessionContext, lmsCourseBuilderService, type AudiencePreview } from './course-builder-service';
import type { CatalogDepartment, CatalogJobRole } from './course-builder-service';

export function CourseAudiencePanel({
  courseId,
  departments,
  jobRoles,
}: {
  /** Null until the course has been saved once - there is nothing to assign to yet. */
  courseId: number | null;
  departments: CatalogDepartment[];
  jobRoles: CatalogJobRole[];
}) {
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [jobroleIds, setJobroleIds] = useState<number[]>([]);
  const [assignmentType, setAssignmentType] = useState('Mandatory');
  const [dueDate, setDueDate] = useState('');

  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const nothingChosen = departmentIds.length === 0 && jobroleIds.length === 0;

  useEffect(() => {
    if (!courseId || nothingChosen) {
      setPreview(null);
      return;
    }
    const session = buildSessionContext();
    if (!session.token) return;

    const timer = setTimeout(() => {
      lmsCourseBuilderService
        .previewAudience(session, courseId, { user_ids: [], department_ids: departmentIds, jobrole_ids: jobroleIds })
        .then((response) => setPreview(response.data ?? null))
        .catch(() => setPreview(null));
    }, 250);

    return () => clearTimeout(timer);
  }, [courseId, departmentIds, jobroleIds, nothingChosen]);

  const assign = async () => {
    if (!courseId) return;
    const session = buildSessionContext();
    if (!session.token) {
      setMessage({ ok: false, text: 'Your ERP session is unavailable. Please sign in again.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await lmsCourseBuilderService.assignAudience(session, courseId, {
        user_ids: [],
        department_ids: departmentIds,
        jobrole_ids: jobroleIds,
        assignment_type: assignmentType,
        due_date: dueDate || null,
      });
      const result = response.data;
      setMessage({
        ok: true,
        text: result
          ? `Assigned to ${result.assigned} of ${result.reached}. ${result.already_had_it} already had it.`
          : 'Assigned.',
      });
    } catch (reason) {
      setMessage({ ok: false, text: reason instanceof Error ? reason.message : 'Unable to assign this course.' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (list: number[], set: (next: number[]) => void, id: number) =>
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  if (!courseId) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Save the course first, then choose who it is for. There is nothing to assign to yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Picker
          label="Departments"
          hint="Everyone in the department, including people who join it later."
          options={departments.map((d) => ({ id: d.id, label: d.department }))}
          selected={departmentIds}
          onToggle={(id) => toggle(departmentIds, setDepartmentIds, id)}
        />
        <Picker
          label="Job roles"
          hint="Everyone holding the role."
          options={jobRoles.map((r) => ({ id: r.id, label: r.jobrole }))}
          selected={jobroleIds}
          onToggle={(id) => toggle(jobroleIds, setJobroleIds, id)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Assignment type</span>
          <Select
            value={assignmentType}
            onChange={setAssignmentType}
            options={[
              { value: 'Mandatory', label: 'Mandatory' },
              { value: 'Recommended', label: 'Recommended' },
              { value: 'Optional', label: 'Optional' },
            ]}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
          />
        </label>
      </div>

      {preview && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="tabular-nums">{preview.will_assign}</span>
            {preview.will_assign === 1 ? ' person' : ' people'} will be assigned
            {preview.already_enrolled > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                · <span className="tabular-nums">{preview.already_enrolled}</span> already have it
              </span>
            )}
          </p>
          {preview.sample.length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {preview.sample.map((person) => person.name).join(', ')}
              {preview.count > preview.sample.length && ` and ${preview.count - preview.sample.length} more`}
            </p>
          )}
        </div>
      )}

      {message && (
        <p
          role="status"
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            message.ok
              ? 'border-success/30 bg-success/5 text-success'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          )}
        >
          {message.text}
        </p>
      )}

      <Button onClick={() => void assign()} disabled={busy || nothingChosen}>
        {busy ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Assigning…
          </>
        ) : (
          'Assign course'
        )}
      </Button>
    </div>
  );
}

/** A checkbox list with a filter, for lists that run to hundreds. */
function Picker({
  label,
  hint,
  options,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  options: { id: number; label: string }[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const visible = query.trim()
    ? options.filter(
        (option) => option.label.toLowerCase().includes(query.trim().toLowerCase()) || selected.includes(option.id)
      )
    : options;

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">
        {label}
        {selected.length > 0 && <span className="ml-1.5 tabular-nums text-primary">{selected.length} selected</span>}
      </span>
      <div className="rounded-lg border">
        {options.length >= 8 && (
          <div className="border-b p-1.5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${options.length}…`}
              aria-label={`Filter ${label}`}
              className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/50"
            />
          </div>
        )}
        <div className="max-h-40 overflow-y-auto p-2">
          {visible.length === 0 ? (
            <span className="text-xs text-muted-foreground">Nothing matches "{query}"</span>
          ) : (
            visible.map((option) => (
              <label key={option.id} className="flex gap-2 py-1 text-sm">
                <input type="checkbox" checked={selected.includes(option.id)} onChange={() => onToggle(option.id)} />
                <span className="min-w-0 truncate">{option.label}</span>
              </label>
            ))
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
