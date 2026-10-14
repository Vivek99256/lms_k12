'use client';

/**
 * The lesson-plan editor's "activity" picker: attaches content-bank or question-bank
 * items to a field (classroom / self-study / assessment activity, chapter-level or
 * per-day). Copies FormatMultiSelect.tsx's Combobox-chip structure, but - unlike that
 * component's small fixed catalogue - searches the server as the user types (debounced,
 * ~300ms, the same pattern app/alumni/_components/entity-picker.tsx uses), since the
 * content and question-paper universes are full DB tables, not a short static list.
 *
 * Base UI's own client-side filtering is turned off (`filter={null}`) because the
 * server has already filtered by `q`; what it returns is shown as-is.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsActions,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import type { CurriculumSession } from '../../data/curriculum';
import type { LessonPlanActivity } from '../../data/lessonPlanDocument';
import { searchLessonPlanContent, searchLessonPlanQuestionPapers } from '../../data/lessonPlanDocumentWrite';

export interface ActivityPickerProps {
  kind: 'content' | 'question';
  value: LessonPlanActivity[];
  onChange: (next: LessonPlanActivity[]) => void;
  session: CurriculumSession;
  standardId?: string | number;
  subjectId?: string | number;
  chapterId?: string | number;
  topicId?: string | number;
  disabled?: boolean;
  placeholder?: string;
}

export function ActivityPicker({
  kind,
  value,
  onChange,
  session,
  standardId,
  subjectId,
  chapterId,
  topicId,
  disabled,
  placeholder,
}: ActivityPickerProps) {
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LessonPlanActivity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const search = kind === 'content' ? searchLessonPlanContent : searchLessonPlanQuestionPapers;
      search(session, { standardId, subjectId, chapterId, topicId, q: query })
        .then((found) => {
          if (!controller.signal.aborted) setResults(found);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind, session.token, standardId, subjectId, chapterId, topicId]);

  // The combobox's known-items universe must include whatever is already selected,
  // even when it falls outside the latest search results, or a previously-picked chip
  // would render with no label and look unselected.
  const items = useMemo(() => {
    const byId = new Map<number, LessonPlanActivity>();
    value.forEach((item) => byId.set(item.id, item));
    results.forEach((item) => byId.set(item.id, item));
    return Array.from(byId.values());
  }, [value, results]);

  const ids = items.map((item) => String(item.id));
  const selectedIds = value.map((item) => String(item.id));
  const labelFor = (id: string) => items.find((item) => String(item.id) === id)?.title ?? `#${id}`;

  return (
    <Combobox
      multiple
      items={ids}
      filter={null}
      value={selectedIds}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(next) => {
        const nextIds = Array.isArray(next) ? (next as string[]) : [];
        onChange(
          nextIds
            .map((id) => items.find((item) => String(item.id) === id))
            .filter((item): item is LessonPlanActivity => Boolean(item))
        );
      }}
      itemToStringLabel={labelFor}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(selected: string[]) => (
            <>
              {selected.map((id) => (
                <ComboboxChip key={id} removeLabel={`Remove ${labelFor(id)}`}>
                  {labelFor(id)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                aria-label={kind === 'content' ? 'Search content' : 'Search question papers'}
                placeholder={selected.length === 0 ? (placeholder ?? 'Type to search…') : ''}
              />
            </>
          )}
        </ComboboxValue>
        <ComboboxChipsActions hasValue={value.length > 0} clearLabel="Clear all" />
      </ComboboxChips>

      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{loading ? 'Searching…' : query.trim() ? 'No matches' : 'Type to search'}</ComboboxEmpty>
        <ComboboxList>
          {(id: string) => (
            <ComboboxItem key={id} value={id}>
              {labelFor(id)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
