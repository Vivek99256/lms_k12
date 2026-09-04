'use client';

import { useState } from 'react';
import { ChevronRight, Filter } from 'lucide-react';
import type { SelectedFilters, SideMenuSection } from '../_lib/types';

interface EduSideMenuProps {
  sideMenu: SideMenuSection[];
  selectedFilters: SelectedFilters;
  onChange: (filters: SelectedFilters) => void;
}

export function EduSideMenu({ sideMenu, selectedFilters, onChange }: EduSideMenuProps) {
  const [expandedSections, setExpandedSections] = useState<number[]>([]);
  const [expandedSubSections, setExpandedSubSections] = useState<Record<number, number[]>>({});
  const [selectedButton, setSelectedButton] = useState<'expand' | 'collapse' | null>(null);

  const toggleLeaf = (type: string, id: string | number) => {
    const current = selectedFilters[type] ?? [];
    const isExists = current.includes(id);
    const next: SelectedFilters = {
      ...selectedFilters,
      [type]: isExists ? current.filter((data) => data !== id) : [...current, id],
    };
    onChange(next);
  };

  const handleExpandCollapse = (buttonType: 'expand' | 'collapse') => {
    setSelectedButton(buttonType);
    setExpandedSections(buttonType === 'expand' ? sideMenu.map((_, index) => index) : []);
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const toggleSubSection = (
    sectionIndex: number,
    subIndex: number,
    section: SideMenuSection,
    submenu: SideMenuSection
  ) => {
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

  return (
    <div className="px-[10px]">
      <div className="flex items-center mt-10 lg:mt-0 gap-5">
        <div className="bg-card py-[8px] w-full items-center flex justify-center gap-[20px]">
          <Filter className="size-4 text-card-foreground" />
          <h4 className="text-[20px] text-card-foreground font-semibold">Filter</h4>
        </div>
      </div>
      <div className="flex gap-[10px] mt-[30px]">
        <button
          type="button"
          onClick={() => handleExpandCollapse('collapse')}
          className={`text-center py-[8px] cursor-pointer w-[100%] ${
            selectedButton === 'collapse'
              ? 'bg-card text-card-foreground'
              : 'bg-transparent text-white border-2 border-white'
          }`}
        >
          Collapse
        </button>
        <button
          type="button"
          onClick={() => handleExpandCollapse('expand')}
          className={`text-center py-[8px] cursor-pointer w-[100%] ${
            selectedButton === 'expand'
              ? 'bg-card text-card-foreground'
              : 'bg-transparent text-white border-2 border-white'
          }`}
        >
          Expand
        </button>
      </div>
      <div className="my-[35px]">
        {sideMenu.map((section, sectionIndex) => (
          <div key={`${section.element_name}-${sectionIndex}`}>
            <div
              className="flex py-3 gap-4 items-center cursor-pointer"
              onClick={() => toggleSection(sectionIndex)}
            >
              <ChevronRight
                className={`size-3 text-white transition-transform ${
                  expandedSections.includes(sectionIndex) ? 'rotate-90' : ''
                }`}
              />
              <h1 className="xl:text-[18px] font-semibold leading-tight text-card-foreground bg-card p-2 rounded-lg w-full">
                {section.element_name}
              </h1>
            </div>
            {expandedSections.includes(sectionIndex) && (
              <div className="ml-8">
                {section.children?.map((submenu, subIndex) => (
                  <div key={`${submenu.element_name}-${subIndex}`}>
                    <div
                      className="flex py-2 gap-2 items-center cursor-pointer"
                      onClick={() => toggleSubSection(sectionIndex, subIndex, section, submenu)}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={
                          submenu.children
                            ? (expandedSubSections[sectionIndex]?.includes(subIndex) ?? false)
                            : (selectedFilters[submenu.element_type]?.includes(submenu.element_id) ?? false)
                        }
                      />
                      <h1 className="text-[15px] xl:text-[18px] font-semibold leading-tight text-white">
                        {submenu.element_name}
                      </h1>
                    </div>
                    {submenu.children && expandedSubSections[sectionIndex]?.includes(subIndex) && (
                      <div className="bg-card p-[12px] rounded-[12px] my-3">
                        {submenu.children.map((leaf, leafIndex) => (
                          <div
                            key={`${leaf.element_name}-${leafIndex}`}
                            className="py-1 text-card-foreground cursor-pointer"
                            onClick={() => toggleLeaf(leaf.element_type, leaf.element_id)}
                          >
                            <div className="flex justify-between my-1 items-center">
                              <div className="flex gap-3 items-center">
                                <input
                                  type="checkbox"
                                  readOnly
                                  checked={selectedFilters[leaf.element_type]?.includes(leaf.element_id) ?? false}
                                />
                                <h1 className="text-[14px] 2xl:text-[18px]">{leaf.element_name}</h1>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
