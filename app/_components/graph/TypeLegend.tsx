'use client';

/**
 * Two legend modes:
 *   - `'source'` (the default, unchanged): the reference's Major/Supporting
 *     dot repurposed for node source — real Neo4j-backed hop (filled) vs
 *     the relational fallback (outline). Every existing caller keeps this.
 *   - `'category'`: the rebuilt centralized explorer's colour-by-label
 *     legend (see graph-category-color.ts) — only the categories actually
 *     present in the current graph, not the whole dictionary.
 */

import { coherenceTheme, sourceDotStyle, type SourceDotKind } from './coherence-theme';
import { categoriesPresent } from './graph-category-color';

const SOURCE_LABEL: Record<SourceDotKind, string> = {
  graph: 'From the graph',
  sql: 'From the relational fallback',
};

export default function TypeLegend({
  variant = 'source',
  entityKeys,
}: {
  variant?: 'source' | 'category';
  /** Category mode only — the entity keys currently on the canvas, so the legend shows only what's present. */
  entityKeys?: Iterable<string>;
}) {
  if (variant === 'category') {
    const present = categoriesPresent(entityKeys ?? []);

    if (present.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-slate-300">
        {present.map(({ color }) => (
          <span key={color.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.dot }} aria-hidden="true" />
            {color.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 px-1 text-xs" style={{ color: coherenceTheme.color.text }}>
      {(Object.keys(sourceDotStyle) as SourceDotKind[]).map((kind) => {
        const dot = sourceDotStyle[kind];
        return (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: dot.filled ? dot.fill : 'transparent',
                border: `2px solid ${dot.fill}`,
              }}
              aria-hidden="true"
            />
            {SOURCE_LABEL[kind]}
          </span>
        );
      })}
    </div>
  );
}
