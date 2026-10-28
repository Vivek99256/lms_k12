'use client';

import { useEffect, useMemo, useState } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchDropdown, type SearchDropdownValues, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import { fetchChapterOptions, type ChapterOption } from '../../data/class-journey';
import SectionCard from '../../_components/SectionCard';

function single(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : '';
  return value ? String(value) : '';
}

export interface ClassMapScope {
  standardId: string;
  sectionId: string;
  subjectId: string;
  chapterId: string;
  syear: string;
}

/**
 * Grade → Standard → Division → Subject → Chapter, for the class-wide
 * learning map. Modelled on `StudentPicker.tsx`'s existing section/standard/
 * division cascade (not `CurriculumScopePicker.tsx`, which is live on the
 * Knowledge Graph page and has no division field) — this picker adds
 * `subject` alongside it, plus a chapter dropdown chapters have no field of
 * their own in `<SearchDropdown>`.
 *
 * `sectionId` in the returned scope is `<SearchDropdown>`'s **Division**
 * value, not its "Grade" field (confusingly also internally named
 * `section`) — `requireClassScope()` on the backend matches `section_id`
 * against `division_id` columns. Getting this backwards silently resolves
 * the wrong class, with no error.
 */
export default function ClassScopePicker({
  onSelect,
  size = 'default',
}: {
  onSelect: (scope: ClassMapScope) => void;
  size?: 'default' | 'lg';
}) {
  const isLg = size === 'lg';
  const session = useMemo(() => buildSessionContext(), []);
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');

  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  useEffect(() => {
    setChapterId('');
    if (!standardId || !subjectId) {
      setChapters([]);
      return;
    }
    const subInstituteId = Number(session.subInstituteId);
    if (!subInstituteId) {
      setChapters([]);
      return;
    }
    let cancelled = false;
    setChaptersLoading(true);
    fetchChapterOptions({ subInstituteId, standardId: Number(standardId), subjectId: Number(subjectId) })
      .then((rows) => {
        if (!cancelled) setChapters(rows);
      })
      .catch(() => {
        if (!cancelled) setChapters([]);
      })
      .finally(() => {
        if (!cancelled) setChaptersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [standardId, subjectId, session.subInstituteId]);

  const handleChange = (values: SearchDropdownValues) => {
    setStandardId(single(values.standard));
    setDivisionId(single(values.division));
    setSubjectId(single(values.subject));
  };

  const canExplore = Boolean(standardId && divisionId && subjectId && chapterId);

  return (
    <SectionCard title="Browse scope" icon={Compass} accent="brand" size={size}>
      {/*
       * `@container` here, not `sm:`/`md:`/`xl:` — this card can render in a
       * narrow sidebar column just as easily as centred full-width, and those
       * are viewport breakpoints, not container ones: on a wide monitor with
       * this card squeezed into a narrow panel, `md:`/`xl:` still fire off
       * the *browser's* width and force multi-column anyway, cramming all
       * four fields into a sliver with overlapping labels. `<SearchDropdown>`
       * ships its own `md:grid-cols-2 xl:grid-cols-4` baked in, so those are
       * neutralised below (same breakpoint prefixes, so twMerge drops them)
       * before the `@`-prefixed container variants take over.
       */}
      <div className="@container">
        <SearchDropdown
          fields={['section', 'standard', 'division', 'subject']}
          subInstituteId={session.subInstituteId}
          token={session.token}
          labels={{ section: 'Grade', standard: 'Standard', division: 'Division', subject: 'Subject' }}
          placeholders={{
            section: 'Select grade',
            standard: 'Select standard',
            division: 'Select division',
            subject: 'Select subject',
          }}
          onChange={handleChange}
          className={
            isLg
              ? 'grid grid-cols-1 gap-4 md:grid-cols-1 xl:grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-4'
              : 'grid grid-cols-1 gap-3 md:grid-cols-1 xl:grid-cols-1'
          }
        />
      </div>

      <div className={isLg ? 'mt-4' : 'mt-3'}>
        <label className={`mb-1 block font-medium text-slate-600 ${isLg ? 'text-sm' : 'text-xs'}`}>Chapter</label>
        <Select
          value={chapterId}
          onValueChange={(value) => setChapterId(value ?? '')}
          disabled={!standardId || !subjectId || chaptersLoading}
        >
          <SelectTrigger className={isLg ? 'h-11 w-full text-base' : 'w-full'}>
            {chaptersLoading ? (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </span>
            ) : (
              // `<Select>` has no `items` map, so without an explicit
              // resolver it falls back to showing the raw stored value (the
              // chapter id, e.g. "8677") instead of a label — base-ui only
              // auto-resolves labels from an `items` prop, never by reading
              // the matching `<SelectItem>`'s children back out.
              <SelectValue>
                {(value: unknown) =>
                  chapters.find((chapter) => chapter.id === value)?.name ??
                  (standardId && subjectId ? 'Select chapter' : 'Pick a standard and subject first')
                }
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent>
            {chapters.map((chapter) => (
              <SelectItem key={chapter.id} value={chapter.id}>
                {chapter.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        className={isLg ? 'mt-4 h-11 w-full text-base' : 'mt-3 w-full'}
        disabled={!canExplore}
        onClick={() =>
          onSelect({ standardId, sectionId: divisionId, subjectId, chapterId, syear: session.syear })
        }
      >
        Show class map
      </Button>
    </SectionCard>
  );
}
