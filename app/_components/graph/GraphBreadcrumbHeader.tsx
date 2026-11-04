'use client';

/**
 * The reference's pill-style breadcrumb trail: a green `.label` chip next to
 * a cream `.value` chip, one pair per crumb — e.g. "MODULE · Fees",
 * "VIEW · Payment history". The reference's own `.crumb` is `cursor: pointer`
 * (clicking one jumps back to that step), so a crumb with `onClick` renders
 * as a real button rather than inert text.
 */

import { coherenceTheme } from './coherence-theme';

export interface GraphCrumb {
  label: string;
  value: string;
  onClick?: () => void;
}

export default function GraphBreadcrumbHeader({ crumbs, dark = false }: { crumbs: GraphCrumb[]; dark?: boolean }) {
  if (crumbs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 px-1 py-2">
      {crumbs.map((crumb, index) => {
        const pill = (
          <>
            <span
              className="px-3 py-1.5 uppercase tracking-wide text-white"
              style={{ backgroundColor: dark ? '#1e40af' : coherenceTheme.color.accent, fontFamily: coherenceTheme.font.eyebrow }}
            >
              {crumb.label}
            </span>
            <span
              className="px-3 py-1.5"
              style={dark ? { backgroundColor: 'rgba(255,255,255,0.08)', color: '#f1f5f9' } : { backgroundColor: coherenceTheme.color.bgCream, color: coherenceTheme.color.text }}
            >
              {crumb.value}
            </span>
          </>
        );

        return crumb.onClick ? (
          <button
            key={`${crumb.label}-${index}`}
            type="button"
            onClick={crumb.onClick}
            className="inline-flex cursor-pointer overflow-hidden rounded-sm text-xs font-semibold"
          >
            {pill}
          </button>
        ) : (
          <div key={`${crumb.label}-${index}`} className="inline-flex overflow-hidden rounded-sm text-xs font-semibold">
            {pill}
          </div>
        );
      })}
    </div>
  );
}
