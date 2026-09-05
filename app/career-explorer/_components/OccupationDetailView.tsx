'use client';

import { useState } from 'react';
import type { OccupationMainSection } from '../_lib/types';

function truncate(description: string | undefined) {
  if (!description) return '';
  return description.split(' ').slice(0, 4).join(' ') + '...';
}

function SubSectionCard({
  subTitle,
  children,
}: {
  subTitle?: string;
  children: React.ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="relative">
      <div className="md:absolute hidden md:block top-0 mt-[-4px] max-w-[250px] bg-background z-10">
        <h3 className="text-[#0D6EFD] px-[15px] text-center m-auto w-fit font-bold border-b-2 border-[#0D6EFD] leading-none text-[20px] py-[10px]">
          {subTitle}
        </h3>
      </div>
      <h3 className="text-[#0D6EFD] block md:hidden px-[15px] text-center m-auto w-fit font-bold border-b-2 border-[#0D6EFD] leading-none text-[20px] py-[10px]">
        {subTitle}
      </h3>
      <div
        className={`relative border-2 ${showAll ? 'h-[300px] overflow-auto' : 'overflow-hidden h-[300px]'} border-border my-[22px] rounded-[10px] mt-[20px] w-full py-[18px] px-[15px] md:px-[25px]`}
      >
        {children}
        {!showAll && (
          <div
            className="cursor-pointer absolute text-foreground h-[28px] flex justify-end pr-[20px] items-center w-[95%] bg-background bottom-0 text-right"
            onClick={() => setShowAll(true)}
          >
            <h2>Show all</h2>
          </div>
        )}
      </div>
    </div>
  );
}

export function OccupationDetailView({ sections }: { sections: OccupationMainSection[] }) {
  const [expandedIndex, setExpandedIndex] = useState<string[]>([]);

  const handleToggle = (key: string) => {
    setExpandedIndex((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div className="space-y-10">
      {sections.map((section, sectionIndex) => (
        <div key={section.main_id ?? sectionIndex}>
          <h2 className="text-[22px] md:text-[26px] text-foreground font-bold">{section.main_title}</h2>
          {section.main_description && (
            <p className="text-[14px] text-muted-foreground font-normal mt-[10px]">{section.main_description}</p>
          )}
          <div className="my-[20px] grid grid-cols-1 lg:grid-cols-2 gap-y-6 gap-x-4">
            {section.children?.map((sub, subIndex) => (
              <SubSectionCard key={`${sectionIndex}:${subIndex}`} subTitle={sub.sub_title}>
                {sub.children?.map((item, itemIndex) => {
                  const key = `${sectionIndex}:${subIndex}:${itemIndex}`;
                  const isExpanded = expandedIndex.includes(key);
                  return (
                    <div className="py-[5px]" key={item.element_name ?? itemIndex}>
                      <div className="flex justify-between items-center my-1">
                        <label className="text-[16px] font-semibold text-foreground">{item.element_name}</label>
                      </div>
                      <div className="flex gap-[10px] items-center justify-between">
                        <div
                          className="flex items-center justify-between gap-[10px] cursor-pointer w-full"
                          onClick={() => handleToggle(key)}
                        >
                          <h4 className="text-sm text-muted-foreground">{truncate(item.description)}</h4>
                          {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
                          <img
                            className="w-[10px]"
                            src={isExpanded ? '/images/career-explorer/arrow-down.png' : '/images/career-explorer/arrow-up.png'}
                            alt=""
                          />
                        </div>
                        {typeof item.percentage === 'number' && (
                          <div className="w-[40%] bg-muted rounded-full h-2.5">
                            <div className="bg-[#0D6EFD] h-2.5 rounded-full" style={{ width: `${item.percentage}%` }} />
                          </div>
                        )}
                        <input className="w-[15px] h-[15px]" type="radio" readOnly checked={false} />
                      </div>
                      {isExpanded && (
                        <div className="bg-muted my-[10px] rounded-[10px] p-4 mt-4 shadow-md">
                          <p className="text-sm text-foreground">{item.description}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </SubSectionCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
