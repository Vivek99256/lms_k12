'use client';

import { Compass, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { ClusterItem } from '../_lib/types';

interface ClusterGridProps {
  items: ClusterItem[];
  onSelect: (item: ClusterItem, index: number) => void;
  onAdvice: (item: ClusterItem) => void;
  onExplore: (item: ClusterItem) => void;
}

export function ClusterGrid({ items, onSelect, onAdvice, onExplore }: ClusterGridProps) {
  if (!items.length) {
    return <EmptyState title="No results found" description="Try a different filter combination or search term." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((item, index) => {
        const label = item.career_cluster ?? item.career_pathway ?? item.title ?? '';
        return (
          <Card key={`${item.career_id ?? label}-${index}`} size="sm" className="overflow-hidden transition-shadow hover:shadow-md">
            <button type="button" onClick={() => onSelect(item, index)} className="block w-full text-left">
              {/* eslint-disable-next-line @next/next/no-img-element -- source comes from the ERP API. */}
              <img className="h-32 w-full object-cover" src={item.image} alt={label} />
              <CardContent className="pt-3">
                <CardTitle className="truncate">{label}</CardTitle>
              </CardContent>
            </button>
            <CardContent className="flex flex-col gap-1.5 pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAdvice(item)}
                className="border-[#0D6EFD]/20 text-[#0D6EFD] hover:bg-[#0D6EFD]/10 hover:text-[#0D6EFD]"
              >
                <Sparkles />
                Advise from experts
              </Button>
              <Button size="sm" onClick={() => onExplore(item)} className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90">
                <Compass />
                Explore sector
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
