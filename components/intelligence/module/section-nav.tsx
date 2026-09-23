'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { Brain } from 'lucide-react';

import type { SectionKey } from './contract';

/**
 * The horizontal section navigation shared by every Intelligence screen.
 *
 * ── WHAT IT IS FOR ──────────────────────────────────────────────────────────
 *
 * An Intelligence screen is nine sections deep. Read end to end it is a very
 * long page, and the sections a reader actually came for — the signals, the
 * evidence behind them, the recommendation — are the ones furthest down. This
 * bar makes the sections a module ALREADY DECLARES switchable in place: one is
 * shown, the rest are a click away, and nothing is removed.
 *
 * ── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────
 *
 * IT INVENTS NO SECTIONS. The tabs are exactly the sections the caller passes,
 * which for a contract-driven module is `contract.sections` and for Fees is the
 * eleven sections that screen has always rendered. A module with six sections
 * gets six tabs; there is no filler tab for a section whose data does not exist.
 *
 * IT IS NOT A ROUTER. Selecting a tab is component state — no navigation, no
 * query parameter, no reload — so the year in the LMS header, the payload
 * already fetched and any open drawer all survive a section change.
 *
 * The strip scrolls horizontally rather than wrapping: a module with eleven
 * sections would otherwise become three ragged rows of tabs on a laptop, which
 * costs more vertical space than the sections it was meant to save.
 */

export interface IntelligenceNavSection {
  /** The section's own key — `SectionKey` for a contract, a local id for Fees. */
  key: string;
  /** Short label. Derived from the section that exists; never a new concept. */
  label: string;
}

/**
 * Short nav labels for the nine standard sections.
 *
 * Section TITLES are sentences ("What the Brain sees", "What to consider
 * doing") because they head a section a reader is already looking at. A tab is
 * read at a glance and alongside six others, so it carries the section's noun
 * instead. Neither renames the concept: `findings` is still findings.
 */
export const SECTION_NAV_LABELS: Record<SectionKey, string> = {
  summary: 'Summary',
  position: 'Position',
  breakdowns: 'Breakdowns',
  findings: 'Findings',
  priorities: 'Priorities',
  recommendations: 'Recommendations',
  decisions: 'Decisions',
  dataQuality: 'Data quality',
  learning: 'Learning',
  integration: 'Module Integration',
  workflow: 'Cross-Module Workflow',
};

/** Fees' accent, and the default for a caller that has no accent of its own. */
const DEFAULT_ACCENT = '#5846EA';

export function IntelligenceSectionNav({
  label,
  sections,
  activeKey,
  onSelect,
  accent = DEFAULT_ACCENT,
}: {
  /** The screen this navigates — "Fees Intelligence". */
  label: string;
  sections: IntelligenceNavSection[];
  activeKey: string;
  onSelect: (key: string) => void;
  /**
   * The module's accent. Declared on this element rather than inherited so the
   * bar is correct wherever it is mounted — the Fees screen sets no
   * `--intel-accent` on any ancestor, and an unresolved variable would render
   * the selected tab as invisible text on an invisible chip.
   */
  accent?: string;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Keep the selected tab in view when the strip is scrolled horizontally —
  // otherwise selecting a later section with the keyboard leaves the highlight
  // off-screen. `nearest`/`block: 'nearest'` so the page itself never jumps.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeKey]);

  if (sections.length < 2) return null;

  const style = {
    '--intel-nav-accent': accent,
    '--intel-nav-accent-glow': `${accent}14`,
    '--intel-nav-accent-ring': `${accent}3D`,
  } as CSSProperties;

  return (
    <nav
      style={style}
      aria-label={`${label} sections`}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-center">
        <div
          role="tablist"
          aria-orientation="horizontal"
          className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sections.map((section) => {
            const isActive = section.key === activeKey;

            return (
              <button
                key={section.key}
                ref={isActive ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(section.key)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                  isActive
                    ? 'bg-[color:var(--intel-nav-accent-glow)] text-[color:var(--intel-nav-accent)] shadow-[inset_0_0_0_1px_var(--intel-nav-accent-ring)]'
                    : 'text-[#5F7087] hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
