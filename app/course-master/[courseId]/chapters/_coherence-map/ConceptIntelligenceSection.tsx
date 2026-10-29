'use client';

/**
 * Concept Intelligence, directly under the concept it describes.
 *
 * Reuses `ConceptIntelligenceTabs` as-is - the same tabbed panel the
 * Chapter -> Topic -> Concept hierarchy screen opens as a full page. That
 * component already fills "the parent's fixed height... sits flush inside an
 * unpadded card" (see its own file header), so embedding it here is a matter of
 * giving it a bounded height, not rebuilding a second presentation of the same
 * data. No breadcrumb, no concept pager - that chrome belongs to the full-page
 * view, not to a card on a canvas.
 *
 * Collapsed by default: this section sits between the concept's own
 * description and its prerequisite/unlock lists, so opening every concept's
 * eighteen tabs by default would bury those lists on every card.
 *
 * WHY THE PANEL STAYS MOUNTED WHILE COLLAPSED
 * Height animates via a CSS grid-rows trick (0fr -> 1fr) rather than
 * conditionally rendering the panel, because only ONE node on the whole map is
 * ever `expanded` at a time - mounting its intelligence tabs always is cheap,
 * and it means collapsing and reopening a concept keeps whichever tab the
 * reader was on, instead of resetting to Overview every time.
 */

import { useId, useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';

import { ConceptIntelligenceTabs } from '@/components/intelligence/ConceptIntelligenceTabs';

import {
  capitalize,
  conceptGlance,
  difficultyChipClass,
  useConceptIntelligenceEntry,
} from './conceptIntelligence';
import type { FocusNode } from './focusLayout';

/**
 * On-map concepts carry their chapter in `node.ancestry` (the overline the card
 * already renders); off-map concepts carry it as `meta.chapter_name` instead,
 * because they arrive with no parent chain at all. Either way there is a name to
 * read - just from a different place depending on which kind of node this is.
 */
function chapterTitleOf(node: FocusNode): string {
  const fromAncestry = node.ancestry.find((a) => a.type === 'chapter')?.label;
  if (fromAncestry) return fromAncestry;

  const meta = node.meta as Record<string, unknown>;
  return typeof meta.chapter_name === 'string' ? meta.chapter_name : '';
}

export function ConceptIntelligenceSection({ node }: { node: FocusNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const meta = node.meta as Record<string, unknown>;
  const chapterId = typeof meta.chapter_id === 'number' ? meta.chapter_id : null;

  const { entry, loading } = useConceptIntelligenceEntry(chapterId, node.label);

  // No chapter to look up, or still in flight: render nothing rather than a
  // placeholder that would flash and then disappear once the fetch settles.
  if (!chapterId || loading) return null;

  const glance = conceptGlance(entry);

  return (
    <section className="px-4 pt-3">
      {entry ? (
        <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
          <button
            type="button"
            onClick={(event) => {
              // Without this, the click bubbles to the canvas's onPaneClick and
              // collapses the whole concept card back to its resting size right
              // after this section opens - every other button on this card stops
              // propagation for the same reason.
              event.stopPropagation();
              setOpen((v) => !v);
            }}
            className="nodrag nopan group flex w-full items-center justify-between gap-2.5 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-slate-50 px-3.5 py-2.5 text-left transition-colors duration-150 hover:from-emerald-100/80 hover:to-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            aria-expanded={open}
            aria-controls={panelId}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#059669] to-[#0D9488] text-white shadow-xs transition-transform duration-200 group-hover:scale-105">
                <Brain size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12px] font-bold tracking-tight text-slate-800">
                    AI Concept Intelligence
                  </span>
                  <span className="rounded-full bg-emerald-100/80 px-1.5 py-px text-[9px] font-bold text-emerald-800 uppercase tracking-wider">
                    Live
                  </span>
                </div>
                <p className="truncate text-[10.5px] text-slate-500 font-medium">
                  Misconceptions · Pedagogical Strategies · Assessment Questions · Cognitive Depth
                </p>
              </div>
            </span>

            <span className="flex shrink-0 items-center gap-2">
              {glance?.difficulty && (
                <span
                  className={`animate-in fade-in rounded-full px-2 py-0.5 text-[10px] font-bold border duration-300 ${difficultyChipClass(glance.difficulty)}`}
                >
                  {capitalize(glance.difficulty)}
                </span>
              )}
              <span className="hidden sm:inline-block text-[11px] font-semibold text-emerald-700">
                {open ? 'Hide Tabs' : 'View 18 Tabs'}
              </span>
              <ChevronRight
                size={15}
                strokeWidth={2.4}
                className={`shrink-0 text-emerald-700 transition-transform duration-200 motion-reduce:transition-none ${
                  open ? 'rotate-90' : 'rotate-0'
                }`}
                aria-hidden
              />
            </span>
          </button>

          {/* The 0fr/1fr grid-rows trick: animates open AND close smoothly, with no
              JS height measurement and no reflow-on-mount jump. */}
          <div
            id={panelId}
            className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
            style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              {/* ConceptIntelligenceTabs was built for the full-page view, which has no
                  onPaneClick - its tab buttons don't stop propagation themselves.
                  Catching the click once here, at the panel's own boundary, protects
                  every control inside it (tabs, rename) without editing that shared
                  component. Both this card and that page are light-themed now, so no
                  framing is needed to avoid a seam. */}
              <div
                className="nodrag nopan h-[420px] border-t border-slate-200 bg-white"
                onClick={(event) => event.stopPropagation()}
              >
                <ConceptIntelligenceTabs entry={entry} chapterTitle={chapterTitleOf(node)} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
          <Brain size={12} strokeWidth={2.2} aria-hidden />
          <span className="font-semibold uppercase tracking-wide">Concept Intelligence</span>
          <span>— not generated yet for this concept</span>
        </div>
      )}
    </section>
  );
}
