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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
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
            className="nodrag nopan group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
            aria-expanded={open}
            aria-controls={panelId}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#4F46E5] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-transform duration-200 group-hover:scale-105">
                <Brain size={13} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                Concept Intelligence
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1.5">
              {glance?.difficulty && (
                <span
                  className={`animate-in fade-in rounded-full px-1.5 py-px text-[9.5px] font-medium duration-300 ${difficultyChipClass(glance.difficulty)}`}
                >
                  {capitalize(glance.difficulty)}
                </span>
              )}
              <ChevronRight
                size={14}
                strokeWidth={2.2}
                className={`shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${
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
                  component. */}
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
        <div className="flex items-center gap-1.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
          <Brain size={12} strokeWidth={2.2} aria-hidden />
          <span className="font-semibold uppercase tracking-wide">Concept Intelligence</span>
          <span>— not generated yet for this concept</span>
        </div>
      )}
    </section>
  );
}
