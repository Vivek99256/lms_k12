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
export default function ClassScopePicker({ onSelect }: { onSelect: (scope: ClassMapScope) => void }) {
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
    <SectionCard title="Browse scope" icon={Compass} accent="brand">
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
        className="grid grid-cols-1 gap-3"
      />

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">Chapter</label>
        <Select
          value={chapterId}
          onValueChange={(value) => setChapterId(value ?? '')}
          disabled={!standardId || !subjectId || chaptersLoading}
        >
          <SelectTrigger className="w-full">
            {chaptersLoading ? (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </span>
            ) : (
              <SelectValue placeholder={standardId && subjectId ? 'Select chapter' : 'Pick a standard and subject first'} />
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
        className="mt-3 w-full"
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
