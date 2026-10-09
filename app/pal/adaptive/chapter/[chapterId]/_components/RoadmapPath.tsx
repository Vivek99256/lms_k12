'use client';

import React, { useLayoutEffect, useState } from 'react';
import type { AdaptiveConcept } from '@/app/pal/data/pal-diagnostic';

interface InterRowLoop {
  id: string;
  d: string;
}

interface RoadmapPathProps {
  rows: AdaptiveConcept[][];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function RoadmapPath({ rows, containerRef }: RoadmapPathProps) {
  const [loops, setLoops] = useState<InterRowLoop[]>([]);

  const calculateLoops = () => {
    const container = containerRef.current;
    if (!container || rows.length < 2) return;

    const cR = container.getBoundingClientRect();
    const newLoops: InterRowLoop[] = [];

    for (let r = 0; r < rows.length - 1; r++) {
      const currentRow = rows[r];
      const nextRow = rows[r + 1];

      if (!currentRow.length || !nextRow.length) continue;

      const lastConcept = currentRow[currentRow.length - 1];
      const firstConcept = nextRow[0];

      const lastEl = document.getElementById(`concept-node-${lastConcept.conceptId}`);
      const firstEl = document.getElementById(`concept-node-${firstConcept.conceptId}`);

      if (!lastEl || !firstEl) continue;

      const rLast = lastEl.getBoundingClientRect();
      const rFirst = firstEl.getBoundingClientRect();

      const startX = rLast.right - cR.left + 4;
      const startY = (rLast.top + rLast.bottom) / 2 - cR.top;

      const endX = rFirst.left - cR.left - 4;
      const endY = (rFirst.top + rFirst.bottom) / 2 - cR.top;

      const gapY = (rLast.bottom + rFirst.top) / 2 - cR.top;

      // Curve radius
      const curveR = 28;

      // Draw the S-track connecting the right end of row R to the left end of row R+1
      const pathData = [
        `M ${startX} ${startY}`,
        // Curve down into the horizontal row gap
        `C ${startX + curveR} ${startY}, ${startX + curveR} ${gapY}, ${startX} ${gapY}`,
        // Straight line across the gap to the left side
        `L ${endX} ${gapY}`,
        // Curve down into the left edge of the first card of the next row
        `C ${endX - curveR} ${gapY}, ${endX - curveR} ${endY}, ${endX} ${endY}`,
      ].join(' ');

      newLoops.push({
        id: `loop-row-${r}-to-${r + 1}`,
        d: pathData,
      });
    }

    setLoops(newLoops);
  };

  useLayoutEffect(() => {
    calculateLoops();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      calculateLoops();
    });

    observer.observe(container);
    const timer = setTimeout(calculateLoops, 250);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [rows]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="loop-arrow-purple"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#9333ea" />
        </marker>
      </defs>

      {loops.map((loop) => (
        <path
          key={loop.id}
          d={loop.d}
          fill="none"
          stroke="#9333ea"
          strokeWidth="1.75"
          strokeDasharray="4 4"
          strokeLinecap="round"
          markerEnd="url(#loop-arrow-purple)"
          className="transition-all duration-300 opacity-80"
        />
      ))}
    </svg>
  );
}
