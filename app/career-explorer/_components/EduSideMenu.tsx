'use client';

import { useState } from 'react';
import { ChevronDown, Filter, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { SelectedFilters, SideMenuSection } from '../_lib/types';

interface EduSideMenuProps {
  sideMenu: SideMenuSection[];
  selectedFilters: SelectedFilters;
  onChange: (filters: SelectedFilters) => void;
}

/** One accent per top-level filter group (Education Level, Abilities, Interests & Work Values, Work Styles, ...), cycling if there are more. */
const SECTION_ACCENTS = [
  { dot: 'bg-[#0D6EFD]', text: 'text-[#0D6EFD]', badge: 'border-[#0D6EFD]/20 bg-[#0D6EFD]/10 text-[#0D6EFD]' },
  { dot: 'bg-violet-500', text: 'text-violet-600', badge: 'border-violet-200 bg-violet-50 text-violet-700' },
  { dot: 'bg-amber-500', text: 'text-amber-600', badge: 'border-amber-200 bg-amber-50 text-amber-700' },
  { dot: 'bg-emerald-500', text: 'text-emerald-600', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
];

function countSelected(section: SideMenuSection, selectedFilters: SelectedFilters): number {
  if (!section.children) {
    return selectedFilters[section.element_type]?.includes(section.element_id) ? 1 : 0;
  }
  return section.children.reduce((total, child) => total + countSelected(child, selectedFilters), 0);
}

function totalSelected(selectedFilters: SelectedFilters) {
  return Object.values(selectedFilters).reduce((total, ids) => total + ids.length, 0);
}

export function EduSideMenu({ sideMenu, selectedFilters, onChange }: EduSideMenuProps) {
  const [expandedSections, setExpandedSections] = useState<number[]>([0]);
  const [expandedSubSections, setExpandedSubSections] = useState<Record<number, number[]>>({});

  const toggleLeaf = (type: string, id: string | number) => {
    const current = selectedFilters[type] ?? [];
    const isExists = current.includes(id);
    const next: SelectedFilters = {
      ...selectedFilters,
      [type]: isExists ? current.filter((data) => data !== id) : [...current, id],
    };
    onChange(next);
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const toggleSubSection = (sectionIndex: number, subIndex: number, submenu: SideMenuSection) => {
    const isOpen = expandedSubSections[sectionIndex]?.includes(subIndex) ?? false;
    const nextSubs = isOpen
      ? (expandedSubSections[sectionIndex] ?? []).filter((data) => data !== subIndex)
      : [...(expandedSubSections[sectionIndex] ?? []), subIndex];
    setExpandedSubSections({ ...expandedSubSections, [sectionIndex]: nextSubs });

    if (!submenu.children) {
      // Leaf-level submenu: it doubles as a checkable filter directly under the section.
      toggleLeaf(submenu.element_type, submenu.element_id);
    }
  };

  const selectedCount = totalSelected(selectedFilters);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-[#0D6EFD]/10 text-[#0D6EFD]">
            <Filter className="size-3.5" />
          </span>
          Filters
          {selectedCount > 0 && (
            <Badge variant="outline" className="border-[#0D6EFD]/20 bg-[#0D6EFD]/10 text-[#0D6EFD]">{selectedCount}</Badge>
          )}
        </div>
        {selectedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            <RotateCcw />
            Reset
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {sideMenu.map((section, sectionIndex) => {
          const isOpen = expandedSections.includes(sectionIndex);
          const sectionCount = countSelected(section, selectedFilters);
          const accent = SECTION_ACCENTS[sectionIndex % SECTION_ACCENTS.length];
          return (
            <div key={`${section.element_name}-${sectionIndex}`}>
              {sectionIndex > 0 && <Separator className="my-1" />}
              <button
                type="button"
                onClick={() => toggleSection(sectionIndex)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${accent.dot}`} />
                  {section.element_name}
                  {sectionCount > 0 && <Badge variant="outline" className={accent.badge}>{sectionCount}</Badge>}
                </span>
                <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="ml-1 space-y-0.5 border-l pl-3">
                  {section.children?.map((submenu, subIndex) => {
                    const hasChildren = Boolean(submenu.children);
                    const subOpen = expandedSubSections[sectionIndex]?.includes(subIndex) ?? false;
                    const isChecked = selectedFilters[submenu.element_type]?.includes(submenu.element_id) ?? false;

                    return (
                      <div key={`${submenu.element_name}-${subIndex}`}>
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleSubSection(sectionIndex, subIndex, submenu)}
                            aria-expanded={subOpen}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <span>{submenu.element_name}</span>
                            <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${subOpen ? 'rotate-180' : ''}`} />
                          </button>
                        ) : (
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            <Checkbox
                              size="sm"
                              checked={isChecked}
                              onCheckedChange={() => toggleLeaf(submenu.element_type, submenu.element_id)}
                            />
                            {submenu.element_name}
                          </label>
                        )}

                        {hasChildren && subOpen && (
                          <div className="ml-1 space-y-0.5 border-l pl-3">
                            {submenu.children!.map((leaf, leafIndex) => (
                              <label
                                key={`${leaf.element_name}-${leafIndex}`}
                                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Checkbox
                                  size="sm"
                                  checked={selectedFilters[leaf.element_type]?.includes(leaf.element_id) ?? false}
                                  onCheckedChange={() => toggleLeaf(leaf.element_type, leaf.element_id)}
                                />
                                {leaf.element_name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
