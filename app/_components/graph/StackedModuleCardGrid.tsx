'use client';

/**
 * The reference's "MAP" screen: each module as a front card with a stack of
 * tabs visible behind it — the stack depth is the real, live submodule count
 * for that module (GraphModuleBrowser::erpModules()'s `submodule_count`,
 * tenant+rights filtered the same as the submodule list itself), capped at
 * MAX_VISIBLE_LAYERS purely for legibility (a 27-submodule module would
 * otherwise render 27 indistinguishable slivers) — the exact count still
 * shows as the card's subtitle text.
 *
 * Real DOM layers, not a fixed box-shadow trick (ModuleCardGrid's card
 * style): the reference shows distinct rectangle edges with light gaps
 * between them, not a blurred shadow, and the layer count has to vary per
 * card.
 */

import { coherenceTheme } from './coherence-theme';

export interface StackedCard {
  key: string;
  title: string;
  subtitle: string;
  /** The real, live count this card's stack depth is drawn from. */
  count: number;
}

const MAX_VISIBLE_LAYERS = 6;
const LAYER_OFFSET = 5;

export default function StackedModuleCardGrid({
  cards,
  onSelect,
  emptyMessage,
}: {
  cards: StackedCard[];
  onSelect: (key: string) => void;
  emptyMessage?: string;
}) {
  if (cards.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm" style={{ color: coherenceTheme.color.text }}>
        {emptyMessage ?? 'Nothing here yet.'}
      </p>
    );
  }

  // A hover-grown card (hover:scale-150) overflows its own unscaled box by
  // up to (max footprint * 0.5) — with a 6-layer stack that's ~92px wide and
  // ~62px tall (transform doesn't push flex siblings out of the way, so
  // without enough gap a grown card visually crashes into its neighbour;
  // verified live, 32px gap was nowhere near enough for the 27-submodule
  // Institute ERP card next to Reports). Generous gap + outer padding here
  // give every card room to grow without touching another, matching how
  // loosely the reference's own grid is spaced for the same reason.
  return (
    <div className="flex flex-wrap gap-x-28 gap-y-20 p-10">
      {cards.map((card) => {
        const layers = Math.max(1, Math.min(card.count, MAX_VISIBLE_LAYERS));
        const extraLayers = layers - 1;
        const width = coherenceTheme.node.width;
        const height = coherenceTheme.node.height;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelect(card.key)}
            className="relative z-0 text-left hover:z-20 hover:scale-150 focus-visible:z-20 focus-visible:scale-150"
            style={{
              width: width + extraLayers * LAYER_OFFSET,
              height: height + extraLayers * LAYER_OFFSET,
              transformOrigin: 'top left',
              transition: 'transform 0.5s cubic-bezier(0.59, 0.03, 0.43, 0.99)',
            }}
          >
            {/* Furthest-back layer first, so each later element naturally sits on top.
                The whole stack scales together on hover (the button above), not just
                the front card — verified against the reference's own recorded
                behaviour: every layer grows as one unit, none scale independently. */}
            {Array.from({ length: extraLayers }, (_, i) => extraLayers - i).map((depth) => (
              <span
                key={depth}
                aria-hidden="true"
                className="absolute rounded-[2px] border"
                style={{
                  width,
                  height,
                  top: depth * LAYER_OFFSET,
                  left: depth * LAYER_OFFSET,
                  background: coherenceTheme.color.accentAlt,
                  borderColor: coherenceTheme.color.bgPage,
                  opacity: 1 - depth * 0.07,
                }}
              />
            ))}

            <span
              className="absolute flex flex-col items-center justify-center rounded-[2px] border px-3 text-center"
              style={{
                width,
                height,
                top: 0,
                left: 0,
                background: coherenceTheme.color.accent,
                borderColor: coherenceTheme.color.shadowAlt,
                boxShadow: `-2px 2px ${coherenceTheme.color.shadow}, -1px 1px ${coherenceTheme.color.shadow}`,
              }}
            >
              <span
                className="line-clamp-2 text-[14px] font-semibold leading-snug text-white"
                style={{ fontFamily: coherenceTheme.font.heading }}
              >
                {card.title}
              </span>
              <span className="mt-1 text-[11px] text-white/80">{card.subtitle}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
