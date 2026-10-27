'use client';

import { useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchDropdown, type SearchDropdownValues, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import SectionCard from './SectionCard';

function single(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : '';
  return value ? String(value) : '';
}

/**
 * Grade → Standard → Subject scope picker for the Knowledge Graph
 * Explorer, built on the same shared <SearchDropdown> StudentPicker.tsx
 * already uses for its own class cascade — not a second dropdown
 * implementation.
 *
 * `section` (labelled "Grade", same as StudentPicker) MUST be in `fields`:
 * SearchDropdown's `standard` options only ever load in response to a
 * `section` selection (see its loadStandards() effect, keyed on
 * formValues.section) — there is no way to fetch standards independently.
 * Omitting `section` leaves the Standard dropdown permanently empty.
 */
export default function CurriculumScopePicker({
  onSelect,
}: {
  onSelect: (scope: { standardId: string; subjectId: string }) => void;
}) {
  const session = useMemo(() => buildSessionContext(), []);
  const [standardId, setStandardId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const handleChange = (values: SearchDropdownValues) => {
    setStandardId(single(values.standard));
    setSubjectId(single(values.subject));
  };

  return (
    <SectionCard title="Browse scope" icon={Compass} accent="brand">
      {/* Always stacked, never side-by-side: this picker is reused docked in a
          260px sidebar column once a scope is chosen, where 3 dropdowns
          across would truncate every label to a couple of characters.
          SearchDropdown's own default className is "grid-cols-1 gap-4
          md:grid-cols-2 xl:grid-cols-4" — cn() uses tailwind-merge, which
          only dedupes within the SAME variant, so a plain "grid-cols-1" here
          does not cancel its md:/xl: columns at wider viewports. Every
          breakpoint it sets has to be overridden explicitly. */}
      <SearchDropdown
        fields={['section', 'standard', 'subject']}
        subInstituteId={session.subInstituteId}
        token={session.token}
        labels={{ section: 'Grade', standard: 'Standard', subject: 'Subject' }}
        placeholders={{ section: 'Select grade', standard: 'Select standard', subject: 'Select subject' }}
        onChange={handleChange}
        className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-1 gap-3"
      />
      <Button
        className="mt-3 w-full"
        disabled={!standardId || !subjectId}
        onClick={() => onSelect({ standardId, subjectId })}
      >
        Explore
      </Button>
    </SectionCard>
  );
}
