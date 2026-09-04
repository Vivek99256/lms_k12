'use client';

import type { ClusterItem } from '../_lib/types';

interface ClusterGridProps {
  items: ClusterItem[];
  onSelect: (item: ClusterItem, index: number) => void;
  onAdvice: (item: ClusterItem) => void;
  onExplore: (item: ClusterItem) => void;
}

export function ClusterGrid({ items, onSelect, onAdvice, onExplore }: ClusterGridProps) {
  if (!items.length) return <div className="mt-10 text-sm text-muted-foreground">No results found.</div>;

  return (
    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((item, index) => {
        const label = item.career_cluster ?? item.career_pathway ?? item.title ?? '';
        return (
          <div key={`${item.career_id ?? label}-${index}`} className="flex w-full flex-col">
            <button type="button" onClick={() => onSelect(item, index)} className="relative w-full overflow-hidden text-left transition duration-300 hover:scale-[1.02]">
              {/* eslint-disable-next-line @next/next/no-img-element -- source comes from the ERP API. */}
              <img className="h-auto w-full object-cover" src={item.image} alt={label} />
              <div className="absolute top-0 flex h-[35%] w-full items-center justify-center bg-foreground/80 px-3 text-center text-sm xl:text-base"><h2 className="text-background">{label}</h2></div>
            </button>
            <div className="mt-2 flex flex-col gap-1.5">
              <button type="button" onClick={() => onAdvice(item)} className="w-full bg-[#0D6EFD] px-2 py-1.5 text-center text-sm text-white hover:bg-[#0b5ed7]">Advise from experts</button>
              <button type="button" onClick={() => onExplore(item)} className="w-full bg-[#0D6EFD] px-2 py-1.5 text-center text-sm text-white hover:bg-[#0b5ed7]">Explore more on sector</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}