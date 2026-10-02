'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { ConceptRoadmapNode } from './ConceptRoadmapNode';
import { RoadmapPath } from './RoadmapPath';
import { ConceptDetailPopover } from './ConceptDetailPopover';
import type { AdaptiveConcept } from '@/app/pal/data/pal-diagnostic';

interface ConceptDiagnosticRoadmapProps {
  concepts: AdaptiveConcept[];
  chapterId: string;
  completedConceptIds: Set<string>;
}

export function ConceptDiagnosticRoadmap({
  concepts,
  chapterId,
  completedConceptIds,
}: ConceptDiagnosticRoadmapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [colsPerRow, setColsPerRow] = useState<number>(3);

  // Active concept inspected in popover
  const [activeConcept, setActiveConcept] = useState<{
    concept: AdaptiveConcept;
    stepNumber: number;
  } | null>(null);

  // Responsive column count based on available container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCols = () => {
      const width = container.offsetWidth;
      if (width >= 720) {
        setColsPerRow(4);
      } else if (width >= 500) {
        setColsPerRow(3);
      } else if (width >= 340) {
        setColsPerRow(2);
      } else {
        setColsPerRow(1);
      }
    };

    updateCols();
    const observer = new ResizeObserver(updateCols);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const isLargeSet = concepts.length > 20;

  // Build rows dynamically based on colsPerRow
  let rows: {
    items: {
      type: 'concept' | 'ellipsis' | 'final';
      concept?: AdaptiveConcept;
      index?: number;
    }[];
  }[] = [];

  if (isLargeSet && !showAll) {
    // Condensed mode (first 3 rows full, 4th row with ellipsis and final concept)
    const row1 = concepts.slice(0, colsPerRow).map((c, i) => ({ type: 'concept' as const, concept: c, index: i }));
    const row2 = concepts.slice(colsPerRow, colsPerRow * 2).map((c, i) => ({ type: 'concept' as const, concept: c, index: i + colsPerRow }));
    const row3 = concepts.slice(colsPerRow * 2, colsPerRow * 3).map((c, i) => ({ type: 'concept' as const, concept: c, index: i + colsPerRow * 2 }));

    // Row 4: remaining items up to colsPerRow - 2, then ellipsis, then final concept
    const r4Count = Math.max(1, colsPerRow - 2);
    const r4Start = colsPerRow * 3;
    const row4Concepts = concepts.slice(r4Start, r4Start + r4Count).map((c, i) => ({
      type: 'concept' as const,
      concept: c,
      index: i + r4Start,
    }));
    const finalConcept = concepts[concepts.length - 1];

    const row4 = [
      ...row4Concepts,
      { type: 'ellipsis' as const },
      { type: 'final' as const, concept: finalConcept, index: concepts.length - 1 },
    ];

    rows = [{ items: row1 }, { items: row2 }, { items: row3 }, { items: row4 }];
  } else {
    // Full mode: all concepts rendered in rows of colsPerRow
    const totalRows = Math.ceil(concepts.length / colsPerRow);
    for (let r = 0; r < totalRows; r++) {
      const rowSlice = concepts.slice(r * colsPerRow, (r + 1) * colsPerRow);
      rows.push({
        items: rowSlice.map((c, i) => ({
          type: r === totalRows - 1 && i === rowSlice.length - 1 ? ('final' as const) : ('concept' as const),
          concept: c,
          index: r * colsPerRow + i,
        })),
      });
    }
  }

  // Extract pure concept items per row for inter-row SVG path calculation
  const pathConceptRows = rows.map((r) =>
    r.items
      .map((item) => item.concept)
      .filter((c): c is AdaptiveConcept => Boolean(c))
  );

  const firstUncompletedIndex = concepts.findIndex(
    (c) => !completedConceptIds.has(String(c.conceptId))
  );

  const getStatus = (concept: AdaptiveConcept, index: number): 'completed' | 'available' | 'locked' => {
    if (completedConceptIds.has(String(concept.conceptId))) {
      return 'completed';
    }
    if (index === firstUncompletedIndex) {
      return 'available';
    }
    return 'locked';
  };

  return (
    <div className="relative rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
      {/* Roadmap Container with SVG Paths */}
      <div ref={containerRef} className="relative w-full space-y-9 sm:space-y-11 py-2">
        {/* SVG Inter-Row Dashed Loops */}
        <RoadmapPath rows={pathConceptRows} containerRef={containerRef} />

        {/* Concept Rows */}
        {rows.map((row, rowIndex) => (
          <div
            key={`roadmap-row-${rowIndex}`}
            className="relative z-10 flex items-center justify-between gap-1 sm:gap-2.5 overflow-x-auto pb-1"
          >
            {row.items.map((item, colIndex) => {
              const isLastInRow = colIndex === row.items.length - 1;

              if (item.type === 'ellipsis') {
                return (
                  <React.Fragment key="ellipsis-node">
                    {/* Ellipsis Node */}
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-xs hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all"
                      title="Click to view all concepts"
                    >
                      <span className="text-base font-bold tracking-widest leading-none">···</span>
                    </button>

                    {/* Arrow between ellipsis and final node */}
                    {!isLastInRow && (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white shadow-xs">
                        <ArrowRight className="h-3 w-3 stroke-[2.5]" />
                      </div>
                    )}
                  </React.Fragment>
                );
              }

              if (!item.concept) return null;

              const concept = item.concept;
              const index = item.index ?? 0;
              const isSelected = activeConcept?.concept.conceptId === concept.conceptId;
              const status = getStatus(concept, index);

              return (
                <React.Fragment key={concept.conceptId}>
                  <div className="flex flex-col items-center shrink-0">
                    <ConceptRoadmapNode
                      concept={concept}
                      index={index}
                      status={status}
                      isSelected={isSelected}
                      onSelect={() => setActiveConcept({ concept, stepNumber: index + 1 })}
                    />

                    {/* Final concept caption badge if it's the very last concept */}
                    {item.type === 'final' && (
                      <span className="mt-1 text-[10px] font-medium text-slate-500">
                        Final concept
                      </span>
                    )}
                  </div>

                  {/* Circular Purple Arrow between adjacent cards */}
                  {!isLastInRow && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white shadow-xs">
                      <ArrowRight className="h-3 w-3 stroke-[2.5]" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>

      {/* Expand/Collapse Toggle Button for large concept sets */}
      {isLargeSet && (
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            {showAll
              ? `Showing all ${concepts.length} concepts in sequential curriculum order`
              : `Showing first ${colsPerRow * 3 + Math.max(1, colsPerRow - 2)} concepts and final concept (${concepts.length} total)`}
          </span>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="flex items-center gap-1 font-semibold text-purple-600 hover:text-purple-700 transition-colors"
          >
            <span>{showAll ? 'Show compact roadmap' : `View all ${concepts.length} concepts`}</span>
            {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* Popover / Dialog Inspection Modal */}
      {activeConcept && (
        <ConceptDetailPopover
          concept={activeConcept.concept}
          stepNumber={activeConcept.stepNumber}
          chapterId={chapterId}
          completed={completedConceptIds.has(String(activeConcept.concept.conceptId))}
          isOpen={Boolean(activeConcept)}
          onClose={() => setActiveConcept(null)}
          onStart={() => router.push(`/pal/adaptive/concept/${activeConcept.concept.conceptId}`)}
        />
      )}
    </div>
  );
}
