'use client';

import { useState } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { loadOccupationDetails } from '../_lib/api';
import type { OccupationMainSection, ResultItem } from '../_lib/types';
import { OccupationDetailView } from './OccupationDetailView';

interface ResultsListProps {
  items: ResultItem[];
}

export function ResultsList({ items }: ResultsListProps) {
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

  const [activeItem, setActiveItem] = useState<ResultItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailSections, setDetailSections] = useState<OccupationMainSection[]>([]);

  const toggle = (index: number) => {
    setExpandedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleViewMore = async (item: ResultItem) => {
    setActiveItem(item);
    setDetailError('');
    setDetailSections([]);
    if (!item.onetsoc_code) {
      setDetailError('No occupation code is available for this result.');
      return;
    }
    setDetailLoading(true);
    try {
      setDetailSections(await loadOccupationDetails(item.onetsoc_code));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load occupation details.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (!items.length) {
    return <div className="mt-10 text-sm text-muted-foreground">No results found.</div>;
  }

  return (
    <div>
      <div className="flex justify-between my-[20px] xl:my-[30px]">
        <h2 className="text-[12px] md:text-[20px] 2xl:text-[26px] font-semibold text-foreground">Find Jobs</h2>
        <h2 className="text-[12px] md:text-[20px] 2xl:text-[26px] text-center font-semibold text-foreground">Find Internships</h2>
        <div>
          <h1 className="text-[12px] md:text-[20px] 2xl:text-[26px] text-center font-normal text-foreground border-b-2 border-border">
            Dominant Characteristic
          </h1>
          <div className="flex justify-between">
            <h2 className="text-[12px] md:text-[20px] 2xl:text-[26px] text-center font-semibold text-foreground">Interest</h2>
            <h2 className="text-[12px] md:text-[20px] 2xl:text-[26px] text-center font-semibold text-foreground">Value</h2>
          </div>
        </div>
      </div>
      <div className="border-b-2 border-border border-solid my-[25px]" />
      {items.map((item, index) => {
        const isExpanded = expandedIndices.includes(index);
        const title = item.title ?? '';
        return (
          <div key={`${item.onetsoc_code ?? item.code ?? title}-${index}`} className="flex gap-[25px]">
            <div>
              <h1 className="text-white bg-[#0D6EFD] md:w-[40px] rounded-full md:h-[40px] w-[25px] h-[25px] my-auto text-[14px] md:text-[20px] font-semibold text-center flex items-center justify-center">
                {title.charAt(0)}
              </h1>
            </div>
            <div className="w-full">
              <div className="flex justify-between w-full">
                <div className="w-[55%] xl:w-[60%]">
                  <div className="flex cursor-pointer" onClick={() => toggle(index)}>
                    <h1 className="text-[14px] md:text-[17px] xl:text-[18px] 2xl:text-[20px] text-foreground font-normal w-full">
                      {title}
                    </h1>
                    <ChevronDown className={`ml-3 size-3 mt-[12px] text-muted-foreground transition-transform ${isExpanded ? '-rotate-180' : ''}`} />
                  </div>
                  {isExpanded && (
                    <div>
                      <p className="text-[11px] md:text-[13px] mt-2 xl:text-[16px] w-full text-muted-foreground">{item.description}</p>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90"
                        onClick={() => handleViewMore(item)}
                      >
                        View more
                      </Button>
                    </div>
                  )}
                </div>
                <div className="w-[14px] mt-[7px] h-[14px] 2xl:w-[18px] 2xl:h-[18px] bg-gradient-to-r from-green-500 to-teal-500" />
                <div className="w-[14px] mt-[7px] h-[14px] 2xl:w-[18px] 2xl:h-[18px] bg-gradient-to-r from-blue-500 to-purple-500" />
              </div>
              <div className="border-b-2 border-border border-solid my-[20px]" />
            </div>
          </div>
        );
      })}

      <Dialog open={activeItem !== null} onOpenChange={(open) => { if (!open) setActiveItem(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{activeItem?.title ?? 'Occupation details'}</DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading occupation details…
            </div>
          )}

          {!detailLoading && detailError && (
            <p className="text-sm text-destructive">{detailError}</p>
          )}

          {!detailLoading && !detailError && (
            <div className="space-y-6">
              {activeItem?.description && (
                <p className="text-sm text-muted-foreground">{activeItem.description}</p>
              )}
              <OccupationDetailView sections={detailSections} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
