'use client';

import { useState } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
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
    return <EmptyState title="No results found" description="Try a different filter combination or search term." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-semibold text-foreground">Occupations</h2>
        <span className="text-xs text-muted-foreground">{items.length} result{items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-1">
        {items.map((item, index) => {
          const isExpanded = expandedIndices.includes(index);
          const title = item.title ?? '';
          return (
            <div key={`${item.onetsoc_code ?? item.code ?? title}-${index}`} className="rounded-lg border">
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0D6EFD] text-sm font-semibold text-white">
                  {title.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</span>
                <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && (
                <div className="space-y-3 border-t px-4 py-3">
                  <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewMore(item)}
                    className="border-[#0D6EFD]/20 text-[#0D6EFD] hover:bg-[#0D6EFD]/10 hover:text-[#0D6EFD]"
                  >
                    View details
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
