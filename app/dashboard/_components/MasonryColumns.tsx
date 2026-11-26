'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_MIN_COLUMN = 448; // 28rem, the width each column aims for
const DEFAULT_GAP = 16;

/**
 * Panels in as many columns as the width allows, each panel staying in its own column.
 *
 * CSS columns re-balance every time one panel changes height, so a panel that opens (or grows) makes the others jump
 * between columns. Here the panels are dealt out to columns once, so opening one only slides the panels underneath it in
 * the same column, and the other columns do not move at all.
 *
 * Without `weights` they are dealt round-robin by position. With `weights` (a rough height for each child) each child goes
 * to the shortest column so far, which packs short and tall cards together without leaving holes under the short ones.
 */
export function MasonryColumns({ children, weights, minColumn = DEFAULT_MIN_COLUMN, gap = DEFAULT_GAP }: {
  children: React.ReactNode; weights?: number[]; minColumn?: number; gap?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCount(Math.max(1, Math.floor((el.clientWidth + gap) / (minColumn + gap))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [minColumn, gap]);

  const items = React.Children.toArray(children);

  /** Deal the children out to `n` columns: tallest first, each to the shortest column so far; within a column they keep their order. */
  const deal = (n: number, w: number[]) => {
    const load = new Array<number>(n).fill(0);
    const owner = new Array<number>(items.length).fill(0);
    [...items.keys()].sort((x, y) => w[y] - w[x]).forEach((i) => {
      let target = 0;
      for (let c = 1; c < n; c++) if (load[c] < load[target]) target = c;
      owner[i] = target;
      load[target] += w[i];
    });
    const cols: React.ReactNode[][] = Array.from({ length: n }, () => []);
    items.forEach((item, i) => cols[owner[i]].push(item));
    // The empty space this arrangement leaves under the shorter columns.
    const holes = n * Math.max(...load) - load.reduce((sum, x) => sum + x, 0);

    return { cols, holes };
  };

  let columns: React.ReactNode[][];
  if (weights && weights.length === items.length && items.length > 0) {
    // As many columns as fit, as long as the empty space left under the short cards stays small (a quarter of the content or less);
    // otherwise fewer, wider columns. One column never leaves a hole.
    const total = weights.reduce((sum, x) => sum + x, 0);
    let pick = deal(1, weights);
    for (let n = Math.min(count, items.length); n >= 2; n--) {
      const option = deal(n, weights);
      if (option.holes <= total * 0.25) {
        pick = option;
        break;
      }
    }
    columns = pick.cols;
  } else {
    columns = Array.from({ length: count }, () => []);
    items.forEach((item, i) => columns[i % count].push(item));
  }

  return (
    <div ref={ref} className="flex items-start" style={{ gap }}>
      {columns.map((column, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col" style={weights ? { gap } : undefined}>{column}</div>
      ))}
    </div>
  );
}
